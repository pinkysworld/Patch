import test from 'node:test';
import assert from 'node:assert/strict';
import { copyDesignerControlClipboard } from '../web/designer-control-clipboard-model.js';
import { validateDesignerControlClipboardSemantics } from '../web/designer-control-clipboard-guard.js';
import { listDesignerControls } from '../src/designer.js';

test('semantic clipboard guard accepts the canonical copied control contract', () => {
  const source = `window "Demo" as main:\n  panel as tools:\n    button "Run" as run_tools\n    input query\n`;
  const panel = listDesignerControls(source).find(control => control.type === 'panel');
  const clipboard = copyDesignerControlClipboard(source, panel);
  assert.deepEqual(validateDesignerControlClipboardSemantics(clipboard), clipboard);
});

test('semantic clipboard guard rejects hidden nested ids omitted from external id records', () => {
  const source = `window "Demo" as main:\n  panel as tools:\n    button "Run" as run_tools\n    input query\n`;
  const panel = listDesignerControls(source).find(control => control.type === 'panel');
  const clipboard = copyDesignerControlClipboard(source, panel);
  const forged = JSON.parse(JSON.stringify(clipboard));
  forged.ids = forged.ids.filter(record => record.id !== 'query');
  assert.throws(
    () => validateDesignerControlClipboardSemantics(forged),
    /id records do not exactly match/
  );
});

test('semantic clipboard guard rejects forged control type and extra top-level control source', () => {
  const source = `window "Demo" as main:\n  button "Save" as save\n`;
  const button = listDesignerControls(source)[0];
  const clipboard = copyDesignerControlClipboard(source, button);

  const wrongType = JSON.parse(JSON.stringify(clipboard));
  wrongType.controlType = 'input';
  assert.throws(() => validateDesignerControlClipboardSemantics(wrongType), /does not match parsed/);

  const extra = JSON.parse(JSON.stringify(clipboard));
  extra.lines.push('input hidden_input');
  extra.ids.push({ id: 'hidden_input', type: 'input', line: extra.lines.length - 1 });
  assert.throws(() => validateDesignerControlClipboardSemantics(extra), /exactly one top-level control/);
});

test('semantic clipboard guard parses copied handlers instead of trusting handler strings', () => {
  const source = `window "Demo" as main:\n  button "Save" as save\n\nwhen save clicked:\n  show "saved"\n`;
  const clipboard = copyDesignerControlClipboard(source, listDesignerControls(source)[0]);
  const forged = JSON.parse(JSON.stringify(clipboard));
  forged.handlers[0].lines = ['when save clicked:', 'this is not Patch syntax'];
  assert.throws(() => validateDesignerControlClipboardSemantics(forged), /event handler source is not valid Patch/);
});
