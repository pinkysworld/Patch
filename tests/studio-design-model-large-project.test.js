import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildStudioDesignModel } from '../src/studio-design-model.js';
import { createStudioDesignSnapshotCache } from '../src/studio-design-cache.js';
import {
  STUDIO_STRESS_CONTROLS_PER_FORM,
  STUDIO_STRESS_FORMS,
  buildStudioLargeProjectFixture
} from '../scripts/benchmark-studio-large-project.js';

test('Workshop Desk design model is declaration-only and preserves the six Form surface', () => {
  const source = fs.readFileSync('examples/workshop-desk.patch', 'utf8');
  const model = buildStudioDesignModel(source);

  assert.equal(model.ui.length, 6);
  assert.deepEqual(model.ui.map(form => form.id), [
    'main',
    'settings',
    'details',
    'inventory',
    'customer_profile',
    'diagnostics'
  ]);
  assert.equal(model.ui[0].visible, true);
  assert.ok(model.ui.slice(1).every(form => form.visible === false));
  assert.equal(model.state.heartbeat, 0);
  assert.equal(model.state.ticket_total, 40);
  assert.equal(model.state.ticket_state, 'Open');
  assert.ok(model.declarationCount > 20);
  assert.ok(model.skippedCount >= 0);
});

test('10-Form / 200-control design snapshot stays within the bounded design-model contract', () => {
  const source = buildStudioLargeProjectFixture();
  const cache = createStudioDesignSnapshotCache({ capacity: 2 });
  const first = cache.get(source);
  const second = cache.get(source);

  assert.equal(first, second);
  assert.equal(first.ui.length, STUDIO_STRESS_FORMS);
  const controls = first.ui.reduce((total, form) => total + form.controls.length, 0);
  assert.equal(controls, STUDIO_STRESS_FORMS * STUDIO_STRESS_CONTROLS_PER_FORM);
  assert.deepEqual(cache.stats(), {
    hits: 1,
    misses: 1,
    evictions: 0,
    entries: 1,
    capacity: 2
  });
});
