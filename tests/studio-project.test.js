import test from 'node:test';
import assert from 'node:assert/strict';
import {
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

test('Studio project bundle v1 round-trips one main.patch source deterministically', () => {
  const bundle = buildStudioProjectBundle({ name: 'Counter', kind: 'window', code: 'window "Counter":\n  text "Hello"\n' });
  assert.equal(bundle.format, PATCH_STUDIO_PROJECT_FORMAT);
  assert.equal(bundle.version, PATCH_STUDIO_PROJECT_VERSION);
  assert.deepEqual(bundle.project, { name: 'Counter', kind: 'window', entry: 'main.patch' });
  const serialized = serializeStudioProjectBundle(bundle);
  assert.deepEqual(parseStudioProjectBundle(serialized), bundle);
  assert.deepEqual(studioStateFromBundle(bundle), { name: 'Counter', kind: 'window', code: 'window "Counter":\n  text "Hello"\n' });
});

test('Studio project validator rejects unknown future schemas instead of guessing', () => {
  const bundle = buildStudioProjectBundle({ name: 'Future', kind: 'console', code: 'show 1\n' });
  assert.throws(
    () => validateStudioProjectBundle({ ...bundle, version: PATCH_STUDIO_PROJECT_VERSION + 1 }),
    error => error.code === 'STUDIO_PROJECT_FUTURE_VERSION'
  );
});

test('Studio project validator rejects path traversal, duplicates and missing entry files', () => {
  const base = buildStudioProjectBundle({ name: 'Safe', kind: 'console', code: 'show 1\n' });
  assert.throws(() => validateStudioProjectBundle({ ...base, files: [{ path: '../main.patch', content: 'show 1' }] }), /inside the project|invalid/i);
  assert.throws(() => validateStudioProjectBundle({ ...base, files: [...base.files, ...base.files] }), /more than once/i);
  assert.throws(() => validateStudioProjectBundle({ ...base, project: { ...base.project, entry: 'other.patch' } }), /not present/i);
});

test('legacy local Studio state migrates into the versioned project bundle', () => {
  const migrated = parseStoredStudioProject(JSON.stringify({ name: 'Legacy', kind: 'window', code: 'window "Legacy":\n' }));
  assert.equal(migrated.format, PATCH_STUDIO_PROJECT_FORMAT);
  assert.equal(migrated.project.name, 'Legacy');
  assert.equal(migrated.files[0].path, 'main.patch');
});

test('recovery snapshots stay bounded, newest-first and de-duplicate identical projects', () => {
  let snapshots = [];
  for (let i = 0; i < PATCH_STUDIO_MAX_RECOVERY_SNAPSHOTS + 2; i += 1) {
    const bundle = buildStudioProjectBundle({ name: `P${i}`, kind: 'console', code: `show ${i}\n` });
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
