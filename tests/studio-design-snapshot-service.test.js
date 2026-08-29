import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_DESIGN_SNAPSHOTS_VERSION,
  clearStudioDesignSnapshots,
  getStudioDesignerControls,
  getStudioDesignerDescriptors,
  getStudioDesignerWindows,
  getStudioDesignSnapshot,
  studioDesignSnapshotStats
} from '../web/studio-design-snapshots.js';

const SOURCE = `create number count = 0

window "Main" as main size 420, 240:
  text "Count: {count}" at 24, 24 size 220, 32
  button "Add" as add_button at 24, 72 size 120, 38

when add_button clicked:
  change count:
    add 1`;

test('shared Studio design service reuses the exact source revision', () => {
  clearStudioDesignSnapshots();
  const firstDesign = getStudioDesignSnapshot(SOURCE);
  const secondDesign = getStudioDesignSnapshot(SOURCE);
  const firstDescriptors = getStudioDesignerDescriptors(SOURCE);
  const secondDescriptors = getStudioDesignerDescriptors(SOURCE);

  assert.equal(PATCH_STUDIO_DESIGN_SNAPSHOTS_VERSION, '0.1');
  assert.strictEqual(secondDesign, firstDesign);
  assert.strictEqual(secondDescriptors, firstDescriptors);
  assert.strictEqual(getStudioDesignerWindows(SOURCE), firstDescriptors.windows);
  assert.strictEqual(getStudioDesignerControls(SOURCE), firstDescriptors.controls);

  const stats = studioDesignSnapshotStats();
  assert.equal(stats.design.misses, 1);
  assert.ok(stats.design.hits >= 1);
  assert.equal(stats.descriptors.misses, 1);
  assert.ok(stats.descriptors.hits >= 3);
});

test('source changes invalidate design and descriptor revisions together', () => {
  clearStudioDesignSnapshots();
  const before = getStudioDesignSnapshot(SOURCE);
  const beforeDescriptors = getStudioDesignerDescriptors(SOURCE);
  const changed = SOURCE.replace('count = 0', 'count = 7');
  const after = getStudioDesignSnapshot(changed);
  const afterDescriptors = getStudioDesignerDescriptors(changed);

  assert.notStrictEqual(after, before);
  assert.notStrictEqual(afterDescriptors, beforeDescriptors);
  assert.equal(after.state.count, 7);
});

test('shared design service remains declaration-only for application behavior', () => {
  clearStudioDesignSnapshots();
  const snapshot = getStudioDesignSnapshot(`${SOURCE}\n\ndo dangerous():\n  change count:\n    add 99`);
  assert.equal(snapshot.state.count, 0);
  assert.ok(snapshot.skipped.some(item => item.kind === 'call'));
});

test('descriptor snapshots are immutable read models', () => {
  clearStudioDesignSnapshots();
  const descriptors = getStudioDesignerDescriptors(SOURCE);
  assert.ok(Object.isFrozen(descriptors));
  assert.ok(Object.isFrozen(descriptors.windows));
  assert.ok(Object.isFrozen(descriptors.controls));
  assert.ok(Object.isFrozen(descriptors.controls[0]));
});
