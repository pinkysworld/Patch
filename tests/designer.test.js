import test from 'node:test';
import assert from 'node:assert/strict';
import { addDesignerControl, renameDesignerButton } from '../src/designer.js';

test('designer adds controls inside the first window before event handlers', () => {
  const source = `create number count = 0\n\nwindow "Counter":\n  text "Count"\n\nwhen add clicked:\n  change count:\n    add 1\n`;
  const next = addDesignerControl(source, 'button');
  assert.match(next, /window "Counter":\n  text "Count"\n\n  button "Button" as button_1\nwhen add clicked:/);
});

test('designer can create a window when none exists', () => {
  const next = addDesignerControl('create number count = 0\n', 'input');
  assert.match(next, /window "My App":\n  input input_1/);
});

test('designer generates unique control ids', () => {
  let source = `window "App":\n  button "One" as button_1\n`;
  source = addDesignerControl(source, 'button');
  assert.match(source, /button "Button" as button_2/);
});

test('designer renames button text without changing its id', () => {
  const source = `window "App":\n  button "Old" as save_button\n`;
  const next = renameDesignerButton(source, 'save_button', 'Save now');
  assert.match(next, /button "Save now" as save_button/);
});
