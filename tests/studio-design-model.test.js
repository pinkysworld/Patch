import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_DESIGN_MODEL_VERSION,
  PatchStudioDesignModelError,
  buildStudioDesignModel
} from '../src/studio-design-model.js';

test('Studio design model preserves initial declarations without executing changes or calls', () => {
  const source = `create number count = 1
create text status = "Initial"

make expensive():
  repeat 100000:
    change count:
      add 1

change count:
  add 99

do expensive()

window "Counter {count}" as main:
  text "{status} {count}"
`;

  const model = buildStudioDesignModel(source);
  assert.equal(model.version, PATCH_STUDIO_DESIGN_MODEL_VERSION);
  assert.equal(model.state.count, 1);
  assert.equal(model.state.status, 'Initial');
  assert.equal(model.ui.length, 1);
  assert.equal(model.ui[0].title, 'Counter 1');
  assert.equal(model.ui[0].controls[0].text, 'Initial 1');
  assert.deepEqual(model.skipped.map(item => item.kind), ['change', 'call']);
});

test('Studio design model does not run conditional, repeat, preview or Form visibility actions', () => {
  const source = `create boolean flag = true
create text label = "Safe"

if flag:
  change label:
    set = "Executed"

repeat 3:
  change label:
    set = "Repeated"

preview:
  change label:
    set = "Previewed"

window "Main {label}" as main:
  text "{label}"
window "Settings" as settings:
  text "Settings"
open settings
close main
`;

  const model = buildStudioDesignModel(source);
  assert.equal(model.state.label, 'Safe');
  assert.equal(model.ui[0].visible, true);
  assert.equal(model.ui[1].visible, false);
  assert.equal(model.ui[0].title, 'Main Safe');
  assert.deepEqual(model.skipped.map(item => item.kind), ['if', 'repeat', 'preview', 'openForm', 'closeForm']);
});

test('Studio design model retains event and recipe metadata without invoking handlers', () => {
  const source = `create number count = 0
window "Counter" as main:
  button "Add" as add_button

make add_one():
  change count:
    add 1

when add_button clicked:
  do add_one()
`;

  const model = buildStudioDesignModel(source);
  assert.equal(model.state.count, 0);
  assert.equal(model.declarationCount, 4);
  assert.equal(model.skippedCount, 0);
});

test('Studio design model enforces an explicit top-level node budget', () => {
  assert.throws(
    () => buildStudioDesignModel('create number a = 1\ncreate number b = 2', { maxTopLevelNodes: 1 }),
    error => error instanceof PatchStudioDesignModelError && error.code === 'STUDIO_DESIGN_MODEL_BUDGET'
  );
});

test('Studio design model output is immutable', () => {
  const model = buildStudioDesignModel('window "App" as main:\n  text "Hello"');
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.ui), true);
  assert.equal(Object.isFrozen(model.ui[0]), true);
  assert.equal(Object.isFrozen(model.ui[0].controls), true);
});
