import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import { buildWindowTabOrderManifest } from '../src/window-layout-policy.js';
import {
  DESIGNER_CONTROL_CLIPBOARD_FORMAT,
  DESIGNER_CONTROL_CLIPBOARD_VERSION,
  copyDesignerControlClipboard,
  normalizeDesignerControlClipboard,
  parseDesignerControlClipboard,
  pasteDesignerControlClipboard,
  serializeDesignerControlClipboard
} from '../web/designer-control-clipboard-model.js';

function selected(source, type, windowIndex = 0) {
  const control = listDesignerControls(source).find(item => item.windowIndex === windowIndex && item.type === type);
  assert.ok(control, `${type} control should exist`);
  return { windowIndex: control.windowIndex, controlIndex: control.controlIndex };
}

test('control clipboard 0.1 copies only the selected metadata block, control source and handlers', () => {
  const source = `window "One" as one size 420, 300:\n  # ordinary note belongs to the Form, not the Button\n  # @layout anchor left top\n  # @taborder 0\n  # @locked\n  button "Save" as save at 20, 20 size 100, 32\n  # @layout dock bottom\n  statusbar "Ready" as status\n\nwhen save clicked:\n  show "saved"\n`;
  const clipboard = copyDesignerControlClipboard(source, selected(source, 'button'));
  assert.equal(clipboard.format, DESIGNER_CONTROL_CLIPBOARD_FORMAT);
  assert.equal(clipboard.version, DESIGNER_CONTROL_CLIPBOARD_VERSION);
  assert.equal(clipboard.controlType, 'button');
  assert.deepEqual(clipboard.lines, [
    '# @layout anchor left top',
    '# @taborder 0',
    '# @locked',
    'button "Save" as save at 20, 20 size 100, 32'
  ]);
  assert.deepEqual(clipboard.ids.map(record => record.id), ['save']);
  assert.equal(clipboard.handlers.length, 1);
  assert.deepEqual(clipboard.handlers[0].lines, ['when save clicked:', '  show "saved"']);
  assert.equal(clipboard.lines.some(line => line.includes('ordinary note')), false);
  assert.equal(clipboard.lines.some(line => line.includes('statusbar')), false);
  assert.equal(clipboard.lines.some(line => line.includes('dock bottom')), false);
});

test('clipboard serializes as a closed versioned JSON contract and rejects unknown fields', () => {
  const source = `window "One" as one:\n  button "Save" as save\n`;
  const clipboard = copyDesignerControlClipboard(source, selected(source, 'button'));
  const encoded = serializeDesignerControlClipboard(clipboard);
  assert.deepEqual(parseDesignerControlClipboard(encoded), clipboard);
  assert.throws(
    () => normalizeDesignerControlClipboard({ ...JSON.parse(encoded), command: 'anything' }),
    /field 'command' is not supported/
  );
  assert.throws(() => parseDesignerControlClipboard('{bad json'), /valid Patch control JSON/);
});

test('cross-Form paste remaps project-wide ids, copied handlers and colliding TabOrder while preserving layout metadata', () => {
  const source = `window "One" as one size 420, 300:\n  # @layout anchor left top\n  # @taborder 0\n  # @locked\n  button "Save" as save at 20, 20 size 100, 32\n  # @layout dock bottom\n  statusbar "Ready" as status\n\nwhen save clicked:\n  show "saved"\n\nwindow "Two" as two size 420, 300:\n  # @taborder 0\n  input target at 30, 30 size 160, 32\n`;
  const clipboard = copyDesignerControlClipboard(source, selected(source, 'button'));
  const result = pasteDesignerControlClipboard(source, clipboard, { windowIndex: 1 });
  assert.doesNotThrow(() => parse(result.source));
  assert.deepEqual(result.idMap, { save: 'button_1' });
  assert.match(result.source, /window "Two"[\s\S]*# @layout anchor left top\n  # @taborder 1\n  # @locked\n  button "Save" as button_1 at 20, 20 size 100, 32/);
  assert.match(result.source, /when button_1 clicked:\n  show "saved"/);
  const manifest = buildWindowTabOrderManifest(result.source, parse(result.source));
  assert.deepEqual(manifest.windows[1].controls.map(control => control.tabOrder), [0, 1]);
});

test('pasting into another project preserves original ids when the namespace is free', () => {
  const origin = `window "Origin" as origin:\n  button "Save" as save at 10, 10 size 100, 32\n\nwhen save clicked:\n  show "saved"\n`;
  const target = `window "Target" as target size 400, 260:\n  text "Empty" at 20, 20 size 120, 24\n`;
  const clipboard = copyDesignerControlClipboard(origin, selected(origin, 'button'));
  const result = pasteDesignerControlClipboard(target, clipboard, { windowIndex: 0 });
  assert.deepEqual(result.idMap, { save: 'save' });
  assert.match(result.source, /button "Save" as save at 26, 26 size 100, 32/);
  assert.match(result.source, /when save clicked:/);
  assert.doesNotThrow(() => parse(result.source));
});

test('Panel clipboard remaps nested ids and nested event targets as one source-backed unit', () => {
  const source = `window "One" as one size 520, 340:\n  panel as tools at 20, 20 size 240, 150:\n    text "Grouped"\n    button "Run" as run_tools\n    input query\n\nwhen run_tools clicked:\n  show "run"\n\nwindow "Two" as two size 520, 340:\n  text "Target" at 20, 20 size 120, 24\n`;
  const clipboard = copyDesignerControlClipboard(source, selected(source, 'panel'));
  assert.deepEqual(clipboard.ids.map(record => record.id), ['tools', 'run_tools', 'query']);
  const result = pasteDesignerControlClipboard(source, clipboard, { windowIndex: 1, offset: false });
  assert.doesNotThrow(() => parse(result.source));
  assert.equal(result.idMap.tools, 'panel_1');
  assert.equal(result.idMap.run_tools, 'button_1');
  assert.equal(result.idMap.query, 'input_1');
  assert.match(result.source, /panel as panel_1 at 20, 20 size 240, 150:\n    text "Grouped"\n    button "Run" as button_1\n    input input_1/);
  assert.match(result.source, /when button_1 clicked:\n  show "run"/);
});

test('same-Form fixed-position paste offsets geometry and allocates a non-conflicting TabOrder', () => {
  const source = `window "Main" as main size 420, 300:\n  # @taborder 0\n  button "Save" as save at 20, 20 size 100, 32\n`;
  const clipboard = copyDesignerControlClipboard(source, selected(source, 'button'));
  const result = pasteDesignerControlClipboard(source, clipboard, { windowIndex: 0 });
  assert.match(result.source, /# @taborder 1\n  button "Save" as button_1 at 36, 36 size 100, 32/);
  assert.doesNotThrow(() => parse(result.source));
});

test('malformed external clipboard records fail before source mutation', () => {
  const source = `window "Main" as main:\n  button "Save" as save\n`;
  const clipboard = copyDesignerControlClipboard(source, selected(source, 'button'));
  const malformed = JSON.parse(serializeDesignerControlClipboard(clipboard));
  malformed.ids[0].line = 999;
  assert.throws(() => pasteDesignerControlClipboard(source, malformed, { windowIndex: 0 }), /outside the copied control/);
  assert.equal(listDesignerControls(source).length, 1);
});
