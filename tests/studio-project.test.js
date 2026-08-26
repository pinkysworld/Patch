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
  composeStudioProjectSource,
  createRecoverySnapshot,
  mapStudioProjectLine,
  parseRecoverySnapshots,
  parseStoredStudioProject,
  parseStudioProjectBundle,
  serializeRecoverySnapshots,
  serializeStudioProjectBundle,
  studioStateFromBundle,
  validateStudioProjectBundle
} from '../src/studio-project.js';

const LOGO_RESOURCE = Object.freeze({
  id: 'app.logo',
  path: 'resources/logo.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

test('Studio project bundle v4 round-trips source resources and centralized build settings deterministically', () => {
  const bundle = buildStudioProjectBundle({
    name: 'Counter',
    kind: 'window',
    code: 'window "Counter":\n  text "Hello"\n',
    resources: [LOGO_RESOURCE],
    buildTarget: 'native-macos',
    nativeBuildMode: 'prebuilt'
  });
  assert.equal(bundle.format, PATCH_STUDIO_PROJECT_FORMAT);
  assert.equal(bundle.version, 4);
  assert.equal(bundle.version, PATCH_STUDIO_PROJECT_VERSION);
  assert.deepEqual(bundle.project, {
    name: 'Counter',
    kind: 'window',
    entry: 'main.patch',
    build: { target: 'native-macos', nativeMode: 'prebuilt' }
  });
  assert.deepEqual(bundle.resources, [LOGO_RESOURCE]);
  const serialized = serializeStudioProjectBundle(bundle);
  assert.deepEqual(parseStudioProjectBundle(serialized), bundle);
  assert.deepEqual(studioStateFromBundle(bundle), {
    name: 'Counter',
    kind: 'window',
    entry: 'main.patch',
    files: [{ path: 'main.patch', content: 'window "Counter":\n  text "Hello"\n' }],
    resources: [LOGO_RESOURCE],
    code: 'window "Counter":\n  text "Hello"\n',
    buildTarget: 'native-macos',
    nativeBuildMode: 'prebuilt'
  });
});

test('Studio project v4 preserves multiple Patch sources and composes only source files entry-first', () => {
  const bundle = buildStudioProjectBundle({
    name: 'SplitForms',
    kind: 'window',
    entry: 'main.patch',
    files: [
      { path: 'forms/settings.patch', content: 'window "Settings" as settings:\n  text "Settings"\n' },
      { path: 'main.patch', content: 'create text title = "Patch"\n' },
      { path: 'recipes/reset.patch', content: 'make reset():\n  return\n' }
    ],
    resources: [LOGO_RESOURCE]
  });
  assert.equal(bundle.files.length, 3);
  assert.equal(bundle.resources.length, 1);
  assert.deepEqual(bundle.files.map(file => file.path), ['forms/settings.patch', 'main.patch', 'recipes/reset.patch']);
  const composition = composeStudioProjectSource(bundle);
  assert.deepEqual(composition.files, ['main.patch', 'forms/settings.patch', 'recipes/reset.patch']);
  assert.match(composition.source, /^create text title/);
  assert.doesNotMatch(composition.source, /patch-resource/);
  assert.match(composition.source, /window "Settings"/);
  assert.equal(mapStudioProjectLine(composition, composition.segments[1].startLine)?.path, 'forms/settings.patch');
  assert.deepEqual(parseStudioProjectBundle(serializeStudioProjectBundle(bundle)), bundle);
});

test('Studio project v1 v2 and v3 migrate explicitly to v4 with empty resources', () => {
  const source = 'window "Legacy":\n  text "Hello"\n';
  const v1 = {
    format: PATCH_STUDIO_PROJECT_FORMAT,
    version: 1,
    project: { name: 'LegacyV1', kind: 'window', entry: 'main.patch' },
    files: [{ path: 'main.patch', content: source }]
  };
  const v2 = {
    format: PATCH_STUDIO_PROJECT_FORMAT,
    version: 2,
    project: { name: 'LegacyV2', kind: 'window', entry: 'main.patch', build: { target: 'portable', nativeMode: 'local' } },
    files: [{ path: 'main.patch', content: source }]
  };
  const v3 = {
    format: PATCH_STUDIO_PROJECT_FORMAT,
    version: 3,
    project: { name: 'LegacyV3', kind: 'window', entry: 'main.patch', build: { target: 'web', nativeMode: 'prebuilt' } },
    files: [
      { path: 'main.patch', content: source },
      { path: 'forms/other.patch', content: 'window "Other":\n  text "Other"\n' }
    ]
  };
  const migratedV1 = validateStudioProjectBundle(v1);
  assert.equal(migratedV1.version, 4);
  assert.deepEqual(migratedV1.resources, []);
  assert.deepEqual(migratedV1.project.build, {
    target: PATCH_STUDIO_DEFAULT_BUILD_TARGET,
    nativeMode: PATCH_STUDIO_DEFAULT_NATIVE_BUILD_MODE
  });
  const migratedV2 = validateStudioProjectBundle(v2);
  assert.equal(migratedV2.version, 4);
  assert.deepEqual(migratedV2.resources, []);
  assert.deepEqual(migratedV2.project.build, { target: 'portable', nativeMode: 'local' });
  const migratedV3 = validateStudioProjectBundle(v3);
  assert.equal(migratedV3.version, 4);
  assert.equal(migratedV3.files.length, 2);
  assert.deepEqual(migratedV3.resources, []);
});

test('historical v2 layout remains fail-closed for multiple files', () => {
  const v2 = {
    format: PATCH_STUDIO_PROJECT_FORMAT,
    version: 2,
    project: { name: 'InvalidV2', kind: 'window', entry: 'main.patch', build: { target: 'web', nativeMode: 'prebuilt' } },
    files: [
      { path: 'main.patch', content: 'create number x = 1\n' },
      { path: 'other.patch', content: 'show x\n' }
    ]
  };
  assert.throws(() => validateStudioProjectBundle(v2), error => error.code === 'STUDIO_PROJECT_UNSUPPORTED_LAYOUT');
});

test('Studio project validator rejects unknown future schemas instead of guessing', () => {
  const bundle = buildStudioProjectBundle({ name: 'Future', kind: 'console', code: 'show 1\n' });
  assert.throws(
    () => validateStudioProjectBundle({ ...bundle, version: PATCH_STUDIO_PROJECT_VERSION + 1 }),
    error => error.code === 'STUDIO_PROJECT_FUTURE_VERSION'
  );
});

test('Studio project v4 rejects invalid centralized build settings and resource metadata', () => {
  const base = buildStudioProjectBundle({ name: 'Safe', kind: 'console', code: 'show 1\n' });
  assert.throws(
    () => validateStudioProjectBundle({ ...base, project: { ...base.project, build: { ...base.project.build, target: 'mystery' } } }),
    error => error.code === 'STUDIO_PROJECT_BUILD_TARGET'
  );
  assert.throws(
    () => validateStudioProjectBundle({ ...base, project: { ...base.project, build: { ...base.project.build, nativeMode: 'magic' } } }),
    error => error.code === 'STUDIO_PROJECT_NATIVE_MODE'
  );
  assert.throws(
    () => validateStudioProjectBundle({ ...base, resources: [{ ...LOGO_RESOURCE, path: '../logo.png' }] }),
    error => error.code === 'STUDIO_RESOURCE_PATH'
  );
});

test('Studio project validator rejects path traversal duplicates missing entry and non-Patch source files', () => {
  const base = buildStudioProjectBundle({ name: 'Safe', kind: 'console', code: 'show 1\n' });
  assert.throws(() => validateStudioProjectBundle({ ...base, files: [{ path: '../main.patch', content: 'show 1' }] }), /inside the project|invalid/i);
  assert.throws(() => validateStudioProjectBundle({ ...base, files: [...base.files, ...base.files] }), /more than once/i);
  assert.throws(() => validateStudioProjectBundle({ ...base, project: { ...base.project, entry: 'other.patch' } }), /not present/i);
  assert.throws(() => buildStudioProjectBundle({ name: 'NoText', kind: 'console', files: [{ path: 'README.md', content: 'nope' }], entry: 'README.md' }), error => error.code === 'STUDIO_PROJECT_FILE_TYPE');
});

test('legacy local Studio state migrates into v4 and preserves legacy build settings when present', () => {
  const migrated = parseStoredStudioProject(JSON.stringify({
    name: 'Legacy',
    kind: 'window',
    code: 'window "Legacy":\n',
    buildTarget: 'native-windows',
    nativeBuildMode: 'local'
  }));
  assert.equal(migrated.format, PATCH_STUDIO_PROJECT_FORMAT);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.project.name, 'Legacy');
  assert.equal(migrated.project.build.target, 'native-windows');
  assert.equal(migrated.project.build.nativeMode, 'local');
  assert.equal(migrated.files[0].path, 'main.patch');
  assert.deepEqual(migrated.resources, []);
});

test('recovery snapshots migrate embedded v1 projects to v4', () => {
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
  assert.equal(parsed[0].project.version, 4);
  assert.deepEqual(parsed[0].project.resources, []);
  assert.deepEqual(parsed[0].project.project.build, { target: 'web', nativeMode: 'prebuilt' });
});

test('recovery snapshots preserve all v4 project files and resources and stay bounded newest-first', () => {
  let snapshots = [];
  for (let i = 0; i < PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS + 2; i += 1) {
    const bundle = buildStudioProjectBundle({
      name: `P${i}`,
      kind: 'console',
      files: [
        { path: 'main.patch', content: `create number x = ${i}\n` },
        { path: 'extra.patch', content: 'show x\n' }
      ],
      resources: [{ ...LOGO_RESOURCE, id: `app.logo${i}`, path: `resources/logo${i}.png` }],
      buildTarget: i % 2 ? 'web' : 'portable'
    });
    snapshots = addRecoverySnapshot(snapshots, bundle, new Date(Date.UTC(2026, 0, 1, 0, i, 0)));
  }
  assert.equal(snapshots.length, PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS);
  assert.equal(snapshots[0].project.project.name, `P${PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS + 1}`);
  assert.equal(snapshots[0].project.files.length, 2);
  assert.equal(snapshots[0].project.resources.length, 1);
  const duplicate = addRecoverySnapshot(snapshots, snapshots[0].project, new Date(Date.UTC(2026, 0, 1, 1, 0, 0)));
  assert.equal(duplicate.length, PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS);
  assert.equal(duplicate.filter(item => item.project.project.name === snapshots[0].project.project.name).length, 1);
});

test('recovery parser ignores corrupt slots but preserves valid snapshots', () => {
  const project = buildStudioProjectBundle({ name: 'Good', kind: 'console', code: 'show 1\n', resources: [LOGO_RESOURCE] });
  const snapshot = createRecoverySnapshot(project, new Date('2026-08-12T09:00:00Z'));
  const encoded = JSON.stringify([snapshot, { nope: true }]);
  const parsed = parseRecoverySnapshots(encoded);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].project.project.name, 'Good');
  assert.equal(parsed[0].project.resources[0].id, 'app.logo');
  assert.deepEqual(parseRecoverySnapshots(serializeRecoverySnapshots(parsed)), parsed);
});
