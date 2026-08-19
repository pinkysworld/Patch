import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterStructureLabels, structuralEditorSummary } from '../web/designer-structure-ux.js';

test('structural Properties filters are case-insensitive UI-only matching', () => {
  assert.deepEqual(filterStructureLabels(['Compiler', 'Parser', 'Docs'], 'par'), [false, true, false]);
  assert.deepEqual(filterStructureLabels(['Compiler', 'Parser'], '  COMP  '), [true, false]);
  assert.deepEqual(filterStructureLabels(['A', 'B'], ''), [true, true]);
});

test('structural Properties summaries expose the common Table TreeView and Tabs context', () => {
  assert.deepEqual(structuralEditorSummary('table', '3 columns · 2 rows'), {
    label: 'Table', count: '3 columns · 2 rows', quickLabel: 'Add row'
  });
  assert.deepEqual(structuralEditorSummary('tree', '5 nodes'), {
    label: 'TreeView', count: '5 nodes', quickLabel: 'Add node'
  });
  assert.deepEqual(structuralEditorSummary('tabs', '3 pages'), {
    label: 'Tabs', count: '3 pages', quickLabel: 'Add page'
  });
  assert.equal(structuralEditorSummary('button', '1'), null);
});

test('structural Properties polish delegates mutations to existing source-backed actions', () => {
  const ux = fs.readFileSync('web/designer-structure-ux.js', 'utf8');
  assert.match(ux, /clickExisting\('\[data-table-action="add-row"\]'\)/);
  assert.match(ux, /clickExisting\('\[data-tabs-action="add"\]'\)/);
  assert.match(ux, /data-tree-action="add-child"/);
  assert.match(ux, /button\.click\(\)/);
  assert.match(ux, /designerInspectorSource/);
  assert.doesNotMatch(ux, /\bcode\.value\b/);
  assert.doesNotMatch(ux, /\baddDesignerControl\b/);
  assert.doesNotMatch(ux, /\bupdateDesigner(?:TableData|TreeNodes|TabPage)/);
});

test('structural Properties polish covers filters empty states accessibility and observer idempotence', () => {
  const ux = fs.readFileSync('web/designer-structure-ux.js', 'utf8');
  const css = fs.readFileSync('web/designer-structure-ux.css', 'utf8');
  assert.match(ux, /Filter page controls/);
  assert.match(ux, /Filter pages/);
  assert.match(ux, /Filter nested nodes/);
  assert.match(ux, /No rows yet/);
  assert.match(ux, /Add first row/);
  assert.match(ux, /aria-live="polite"/);
  assert.match(ux, /overview\.dataset\.signature === signature/);
  assert.match(css, /designer-structure-overview/);
  assert.match(css, /designer-structure-filter/);
  assert.match(css, /designer-structure-empty/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test('public Studio and offline PWA package structural Properties polish', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-structure-ux\.js'/);
  assert.match(build, /'designer-structure-ux\.js'/);
  assert.match(build, /'designer-structure-ux\.css'/);
  assert.match(sw, /'\.\/designer-structure-ux\.js'/);
  assert.match(sw, /'\.\/designer-structure-ux\.css'/);
});
