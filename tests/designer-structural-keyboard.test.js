import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  nextStructuralOptionIndex,
  structuralShortcut
} from '../web/designer-structural-keyboard.js';

test('structural listbox navigation clamps and supports Home/End', () => {
  assert.equal(nextStructuralOptionIndex(2, 5, 'ArrowUp'), 1);
  assert.equal(nextStructuralOptionIndex(2, 5, 'ArrowDown'), 3);
  assert.equal(nextStructuralOptionIndex(0, 5, 'ArrowUp'), 0);
  assert.equal(nextStructuralOptionIndex(4, 5, 'ArrowDown'), 4);
  assert.equal(nextStructuralOptionIndex(3, 5, 'Home'), 0);
  assert.equal(nextStructuralOptionIndex(1, 5, 'End'), 4);
  assert.equal(nextStructuralOptionIndex(0, 0, 'ArrowDown'), -1);
});

test('structural shortcuts distinguish TreeView hierarchy and Tabs page actions', () => {
  assert.equal(structuralShortcut('tree', 'ArrowUp', true), 'up');
  assert.equal(structuralShortcut('tree', 'ArrowDown', true), 'down');
  assert.equal(structuralShortcut('tree', 'ArrowLeft', true), 'outdent');
  assert.equal(structuralShortcut('tree', 'ArrowRight', true), 'indent');
  assert.equal(structuralShortcut('tree', 'Enter', true), 'focus-label');
  assert.equal(structuralShortcut('nested-tree', 'ArrowRight', true), 'indent');
  assert.equal(structuralShortcut('tabs', 'ArrowUp', true), 'up');
  assert.equal(structuralShortcut('tabs', 'ArrowDown', true), 'down');
  assert.equal(structuralShortcut('tabs', 'ArrowRight', true), null);
  assert.equal(structuralShortcut('tree', 'ArrowUp', false), null);
});

test('Designer data editor installs one keyboard layer covering top-level and nested structures', () => {
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const nested = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');
  const keyboard = fs.readFileSync('web/designer-structural-keyboard.js', 'utf8');

  assert.match(editor, /installDesignerStructuralKeyboard/);
  assert.match(editor, /designer-keyboard-hint/);
  assert.match(nested, /role="listbox" aria-label="Nested TreeView nodes"/);
  assert.match(nested, /data-tabs-structure-editor="table"/);
  assert.match(nested, /data-tabs-close-structure/);
  assert.match(keyboard, /\[data-tabs-tree-action=/);
  assert.match(keyboard, /\[data-tabs-table-action=/);
  assert.match(keyboard, /Control\+Enter Meta\+Enter/);
  assert.match(keyboard, /aria-keyshortcuts/);
  assert.match(keyboard, /requestAnimationFrame/);
});

test('structural editor CSS exposes explicit keyboard focus states', () => {
  const css = fs.readFileSync('web/designer-data-editor.css', 'utf8');
  assert.match(css, /\.designer-tree-node:focus-visible/);
  assert.match(css, /\.designer-tabs-page:focus-visible/);
  assert.match(css, /\.designer-table-editor input:focus-visible/);
  assert.match(css, /\.designer-tabs-structure-editor:focus-within/);
});

test('public Studio build and offline cache include structural keyboard support', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const checkSite = fs.readFileSync('scripts/check-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(buildSite, /'designer-structural-keyboard\.js'/);
  assert.match(checkSite, /Designer structural keyboard accessibility/);
  assert.match(sw, /'\.\/designer-structural-keyboard\.js'/);
});

test('public Help and Documentation expose the keyboard-only structural editor contract', () => {
  const help = fs.readFileSync('web/help.html', 'utf8');
  const docs = fs.readFileSync('web/docs.html', 'utf8');
  const keyboardDoc = fs.readFileSync('docs/STUDIO_KEYBOARD_ACCESSIBILITY.md', 'utf8');

  assert.match(help, /data-structural-keyboard="roving-v1"/);
  assert.match(help, /Ctrl\/Cmd \+ Arrow Up\/Down/);
  assert.match(help, /Escape<\/strong> closes the editor/);
  assert.match(docs, /docs\/STUDIO_KEYBOARD_ACCESSIBILITY\.md/);
  assert.match(keyboardDoc, /Roving selection lists/);
  assert.match(keyboardDoc, /Persistent application state/);
  assert.match(keyboardDoc, /not a WCAG conformance statement/);
});
