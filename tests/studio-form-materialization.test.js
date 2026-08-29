import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_FORM_MATERIALIZATION_MAX_FORMS,
  createStudioFormMaterializationPlan
} from '../src/studio-form-materialization.js';

test('Studio Form materialization keeps exactly one full Form and lightweight sibling shells', () => {
  const plan = createStudioFormMaterializationPlan(4, 2);
  assert.equal(plan.activeIndex, 2);
  assert.deepEqual(plan.modes, ['shell', 'shell', 'full', 'shell']);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.modes));
});

test('Studio Form materialization clamps stale Form selections deterministically', () => {
  assert.deepEqual(createStudioFormMaterializationPlan(3, 99).modes, ['shell', 'shell', 'full']);
  assert.deepEqual(createStudioFormMaterializationPlan(3, -4).modes, ['full', 'shell', 'shell']);
  assert.equal(createStudioFormMaterializationPlan(3, 'not-a-number').activeIndex, 0);
});

test('empty projects have no materialized Form', () => {
  const plan = createStudioFormMaterializationPlan(0, 5);
  assert.equal(plan.activeIndex, -1);
  assert.deepEqual(plan.modes, []);
});

test('Studio Form materialization rejects invalid and unbounded Form counts', () => {
  assert.throws(() => createStudioFormMaterializationPlan(-1), /non-negative integer/);
  assert.throws(() => createStudioFormMaterializationPlan(1.5), /non-negative integer/);
  assert.throws(() => createStudioFormMaterializationPlan(PATCH_STUDIO_FORM_MATERIALIZATION_MAX_FORMS + 1), /at most/);
});
