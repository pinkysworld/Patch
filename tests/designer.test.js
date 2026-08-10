import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  renameDesignerButton,
  updateDesignerControl
} from '../src/designer.js';

test('designer adds controls inside the first window before event handlers', () => {
  const source = `create number count = 0\n\nwindow "Counter":\n  text "Count"\n\nwhen add clicked:\n  change count:\n    add 1\n`;
  const next = addDesignerControl(source, 'button');
  assert.match(next, /window "Counter":\n  text "Count"\n  button "Button" as button_1 at 24, 72 size 120, 36\n\nwhen add clicked:/);
});

test('designer can create an auto-named window when none exists', () => {
  const next = addDesignerControl('create number count = 0\n', 'input');
  assert.match(next, /window "My App" as form_1 size 640, 420:\n  input input_1 at 24, 24 size 220, 36/);
});

test('designer generates unique control ids', () => {
  let source = `window "App":\n  button "One" as button_1\n`;
  source = addDesignerControl(source, 'button');
  assert.match(source, /button "Button" as button_2 at 24, 72 size 120, 36/);
});

test('designer lists source-backed controls with stable window/control coordinates', () => {
  const source = `window "One":\n  text "Hello"\n  button "Save" as save_button\n\nwindow "Two":\n  input name_input\n`;
  assert.deepEqual(listDesignerControls(source), [
    { windowIndex: 0, controlIndex: 0, line: 2, type: 'text', id: null, textExpr: '"Hello"', options: null, x: null, y: null, width: null, height: null },
    { windowIndex: 0, controlIndex: 1, line: 3, type: 'button', id: 'save_button', textExpr: '"Save"', options: null, x: null, y: null, width: null, height: null },
    { windowIndex: 1, controlIndex: 0, line: 6, type: 'input', id: 'name_input', textExpr: null, options: null, x: null, y: null, width: null, height: null }
  ]);
});

test('designer edits button expression and renames matching event headers', () => {
  const source = `window "App":\n  button "Old" as save_button\n\nwhen save_button clicked:\n  show 1\n`;
  const next = updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, {
    id: 'commit_button',
    textExpr: '"Commit"'
  });
  assert.match(next, /button "Commit" as commit_button/);
  assert.match(next, /when commit_button clicked:/);
  assert.doesNotMatch(next, /save_button/);
});

test('designer edits text expressions without introducing a hidden form model', () => {
  const source = `create text name = "Mia"\nwindow "App":\n  text "Hello " + name\n`;
  const next = updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, { textExpr: '"Welcome " + name' });
  assert.match(next, /text "Welcome " \+ name/);
});

test('designer rejects duplicate and invalid control ids', () => {
  const source = `window "App":\n  button "A" as button_a\n  button "B" as button_b\n`;
  assert.throws(
    () => updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, { id: 'button_b' }),
    /already used/
  );
  assert.throws(
    () => updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, { id: 'not valid' }),
    /not a valid Patch name/
  );
});

test('designer removes a control and its associated event block', () => {
  const source = `create number count = 0\n\nwindow "App":\n  button "Add" as add_button\n  text "Count"\n\nwhen add_button clicked:\n  change count:\n    add 1\n\nshow count\n`;
  const next = removeDesignerControl(source, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(next, /add_button/);
  assert.doesNotMatch(next, /change count/);
  assert.match(next, /text "Count"/);
  assert.match(next, /show count/);
});

test('designer renames button text without changing its id', () => {
  const source = `window "App":\n  button "Old" as save_button\n`;
  const next = renameDesignerButton(source, 'save_button', 'Save now');
  assert.match(next, /button "Save now" as save_button/);
});
