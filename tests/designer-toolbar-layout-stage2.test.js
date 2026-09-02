import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('web/designer-ux.css', 'utf8');

test('Designer toolbar hierarchy 0.2 groups existing source-backed surfaces without adding command logic', () => {
  assert.match(css, /Designer toolbar hierarchy 0\.2/);
  assert.match(css, /#designer \.designer-toolbar > \.designer-component-palette/);
  assert.match(css, /#designer \.designer-toolbar > \.designer-context-group/);
  assert.match(css, /#designer \.designer-toolbar > \.forms-toolbar-group/);
  assert.match(css, /forms-toolbar-group\[data-patch-compact-forms="true"\][\s\S]*min-height: 32px/);
  assert.match(css, /forms-toolbar-group\[data-patch-compact-forms="true"\] > label:first-child::before[\s\S]*content: "Form"/);
  assert.doesNotMatch(css, /code\.value|addDesignerControl|removeDesignerControl|localStorage|sessionStorage/);
});

test('Grid reads as a compact View control while preserving the existing 8px source-neutral canvas grid', () => {
  assert.match(css, /#designer \.designer-grid-toggle[\s\S]*min-width: 54px/);
  assert.match(css, /#designer \.designer-grid-toggle::before[\s\S]*content: "▦"/);
  assert.match(css, /designer-grid-toggle\[aria-pressed="true"\]/);
  assert.match(css, /#designerCanvas\[data-designer-grid="8"\]/);
  assert.match(css, /background-size: 8px 8px/);
});

test('Toolbar groups reflow deliberately on tablet and small-screen Designer widths', () => {
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*designer-context-group[\s\S]*order: 8/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*forms-toolbar-group\[data-patch-compact-forms="true"\][\s\S]*order: 9/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*designer-grid-toggle[\s\S]*58px/);
  assert.match(css, /@media \(forced-colors: active\)/);
});
