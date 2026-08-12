import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_DEFAULT_BUILD_TARGET,
  PATCH_STUDIO_DEFAULT_NATIVE_BUILD_MODE,
  PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS,
  PATCH_STUDIO_PROJECT_FORMAT,
  PATCH_STUDIO_PROJECT_VERSION,
  addRecoverySnapshot,
  buildStudioProjectBundle,
  createRecoverySnapshot,
  parseRecoverySnapshots,
  parseStoredStudioProject,
  parseStudioProjectBundle,
  serializeRecoverySnapshots,
  serializeStudioProjectBundle,
  studioStateFromBundle,
  validateStudioProjectBundle
} from '../src/studio-project.js';

test('Studio project bundle v2 round-trips source and centralized build settings deterministically', () => {
  const bundle = buildStudioProjectBundle({
    name: 'Counter',
    kind: 'window',
    code: 'window "Counter":\n  text "Hello"\n',
    buildTarget: 'native-macos',
    nativeBuildMode: 'prebuilt'
  });
  assert.equal(bundle.format, PATCH_STUDIO_PROJECT_FORMAT);
  assert.equal(bundle.version, 2);
  assert.equal(bundle.version, PATCH_STUDIO_PROJECT_VERSION);
  assert.deepEqual(bundle.project, {
    name: 'Counter',
    kind: 'window',
    entry: 'main.patch',
    build: { target: 'native-macos', nativeMode: 'prebuilt' }
  });
  const serialized = serializeStudioProjectBundle(bundle);
  assert.deepEqual(parseStudioProjectBundle(serialized), bundle);
  assert.deepEqual(studioStateFromBundle(bundle), {
    name: 'Counter',
    kind: 'window',
    code: 'window "Counter":\n  text "Hello"\n',
    buildTarget: 'native-macos',
    nativeBuildMode: 'prebuilt'
  });
});

test('Studio project v1 migrates explicitly to v2 with historical UI defaults', () => {
  const v1 = {
    format: PATCH_STUDIO_PROJECT_FORMAT,
    version: 1,
    project: { name: 'LegacyV1', kind: 'window', entry: 'main.patch' },
    files: [{ path: 'main.patch', content: 'window "Legacy":\n  text "Hello"\n' }]
  };
  const migrated = validateStudioProjectBundle(v1);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.project.build, {
    target: PATCH_STUDIO_DEFAULT_BUILD_TARGET,
    nativeMode: PATCH_STUDIO_DEFAULT_NATIVE_BUILD_MODE
  });
  assert.deepEqual(studioStateFromBundle(v1), {
    name: 'LegacyV1',
    kind: 'window',
    code: 'window "Legacy":\n  text "Hello"\n',
    buildTarget: 'web',
    nativeBuildMode: 'prebuilt'
  });
});

test('Studio project validator rejects unknown future schemas instead of guessing', () => {
  const bundle = buildStudioProjectBundle({ name: 'Future', kind: 'console', code: 'show 1\n' });
  assert.throws(
    () => validateStudioProjectBundle({ ...bundle, version: PATCH_STUDIO_PROJECT_VERSION + 1 }),
    error => error.code === 'STUDIO_PROJECT_FUTURE_VERSION'
  );
});

test('Studio project v2 rejects invalid centralized build settings', () => {
  const base = buildStudioProjectBundle({ name: 'Safe', kind: 'console', code: 'show 1\n' });
  assert.throws(
    () => validateStudioProjectBundle({ ...base, project: { ...base.project, build: { ...base.project.build, target: 'mystery' } } }),
    error => error.code === 'STUDIO_PROJECT_BUILD_TARGET'
  );
  assert.throws(
    () => validateStudioProjectBundle({ ...base, project: { ...base.project, build: { ...base.project.build, nativeMode: 'magic' } } }),
    error => error.code === 'STUDIO_PROJECT_NATIVE_MODE'
  );
});

test('Studio project validator rejects path traversal, duplicates and missing entry files', () => {
  const base = buildStudioProjectBundle({ name: 'Safe', kind: 'console', code: 'show 1\n' });
  assert.throws(() => validateStudioProjectBundle({ ...base, files: [{ path: '../main.patch', content: 'show 1' }] }), /inside the project|invalid/i);
  assert.throws(() => validateStudioProjectBundle({ ...base, files: [...base.files, ...base.files] }), /more than once/i);
  assert.throws(() => validateStudioProjectBundle({ ...base, project: { ...base.project, entry: 'other.patch' } }), /not present/i);
});

test('legacy local Studio state migrates into v2 and preserves legacy build settings when present', () => {
  const migrated = parseStoredStudioProject(JSON.stringify({
    name: 'Legacy',
    kind: 'window',
    code: 'window "Legacy":\n',
    buildTarget: 'native-windows',
    nativeBuildMode: 'local'
  }));
  assert.equal(migrated.format, PATCH_STUDIO_PROJECT_FORMAT);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.project.name, 'Legacy');
  assert.equal(migrated.project.build.target, 'native-windows');
  assert.equal(migrated.project.build.nativeMode, 'local');
  assert.equal(migrated.files[0].path, 'main.patch');
});

test('recovery snapshots migrate embedded v1 projects to v2', () => {
  const v1Project = {
    format: PATCH_STUDIO_PROJECT_FORMAT,
    version: 1,
    project: { name: 'RecoveredV1', kind: 'console', entry: 'main.patch' },
    files: [{ path: 'main.patch', content: 'show 7\n' }]
  };
  const encoded = JSON.stringify([{
    format: 'patch-studio-recovery',
    version: 1,
    savedAt: '2026-08-12T09:00:00.000Z',
    project: v1Project
  }]);
  const parsed = parseRecoverySnapshots(encoded);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].project.version, 2);
  assert.deepEqual(parsed[0].project.project.build, { target: 'web', nativeMode: 'prebuilt' });
});

test('recovery snapshots stay bounded, newest-first and de-duplicate identical projects', () => {
  let snapshots = [];
  for (let i = 0; i < PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS + 2; i += 1) {
    const bundle = buildStudioProjectBundle({ name: `P${i}`, kind: 'console', code: `show ${i}\n`, buildTarget: i % 2 ? 'web' : 'portable' });
    snapshots = addRecoverySnapshot(snapshots, bundle, new Date(Date.UTC(2026, 0, 1, 0, i, 0)));
  }
  assert.equal(snapshots.length, PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS);
  assert.equal(snapshots[0].project.project.name, `P${PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS + 1}`);
  const duplicate = addRecoverySnapshot(snapshots, snapshots[0].project, new Date(Date.UTC(2026, 0, 1, 1, 0, 0)));
  assert.equal(duplicate.length, PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS);
  assert.equal(duplicate.filter(item => item.project.project.name === snapshots[0].project.project.name).length, 1);
});

test('recovery parser ignores corrupt slots but preserves valid snapshots', () => {
  const project = buildStudioProjectBundle({ name: 'Good', kind: 'console', code: 'show 1\n' });
  const snapshot = createRecoverySnapshot(project, new Date('2026-08-12T09:00:00Z'));
  const encoded = JSON.stringify([snapshot, { nope: true }]);
  const parsed = parseRecoverySnapshots(encoded);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].project.project.name, 'Good');
  assert.deepEqual(parseRecoverySnapshots(serializeRecoverySnapshots(parsed)), parsed);
});
