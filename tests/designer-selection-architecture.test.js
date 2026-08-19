import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  clearDesignerSelection,
  currentDesignerSelection,
  normalizeDesignerSelection,
  rememberDesignerSelection,
  sameDesignerSelection
} from '../web/designer-selection.js';

function fakeCanvas() {
  return {
    querySelectorAll() { return []; },
    dispatchEvent() { return true; },
    addEventListener() {}
  };
}

test('shared Designer selections normalize and use adapter/location identity', () => {
  assert.deepEqual(normalizeDesignerSelection({ windowIndex: '1', controlIndex: '2', adapter: 'tree', id: 'files' }), {
    windowIndex: 1,
    controlIndex: 2,
    adapter: 'tree',
    id: 'files'
  });
  assert.equal(normalizeDesignerSelection({ windowIndex: -1, controlIndex: 0, adapter: 'tree' }), null);
  assert.equal(normalizeDesignerSelection({ windowIndex: 0, controlIndex: 0, adapter: '' }), null);
  assert.equal(sameDesignerSelection(
    { windowIndex: 0, controlIndex: 3, adapter: 'table', id: 'before' },
    { windowIndex: 0, controlIndex: 3, adapter: 'table', id: 'after' }
  ), true, 'renaming an id must not change selection identity');
  assert.equal(sameDesignerSelection(
    { windowIndex: 0, controlIndex: 3, adapter: 'table' },
    { windowIndex: 0, controlIndex: 3, adapter: 'tree' }
  ), false);
});

test('shared Designer selection state is one adapter-aware store per canvas', () => {
  const canvas = fakeCanvas();
  rememberDesignerSelection(canvas, { windowIndex: 0, controlIndex: 2, adapter: 'table', id: 'people' }, { emit: false });
  assert.deepEqual(currentDesignerSelection(canvas, 'table'), {
    windowIndex: 0,
    controlIndex: 2,
    adapter: 'table',
    id: 'people'
  });
  assert.equal(currentDesignerSelection(canvas, 'tree'), null);

  rememberDesignerSelection(canvas, { windowIndex: 1, controlIndex: 0, adapter: 'tree', id: 'files' }, { emit: false });
  assert.equal(currentDesignerSelection(canvas, 'table'), null, 'TreeView replaces the prior Table special-adapter selection');
  assert.equal(currentDesignerSelection(canvas, 'tree')?.id, 'files');

  clearDesignerSelection(canvas, { adapter: 'tree', emit: false });
  assert.equal(currentDesignerSelection(canvas), null);
});

test('Table and TreeView adapters no longer keep parallel private selection state', () => {
  const table = fs.readFileSync('web/table-stage1.js', 'utf8');
  const tree = fs.readFileSync('web/tree-designer.js', 'utf8');
  const shared = fs.readFileSync('web/designer-selection.js', 'utf8');

  for (const source of [table, tree]) {
    assert.match(source, /from '\.\/designer-selection\.js'/);
    assert.match(source, /installDesignerSelectionBridge/);
    assert.match(source, /currentDesignerSelection/);
    assert.match(source, /selectDesignerElement/);
  }
  assert.doesNotMatch(table, /let selectedTable\b/);
  assert.doesNotMatch(tree, /let selectedTree\b/);
  assert.doesNotMatch(table, /function sameSelection\b/);
  assert.doesNotMatch(tree, /function sameSelection\b/);
  assert.match(shared, /patch-designer-selection-change/);
  assert.match(shared, /data-patch-designer-adapter|patchDesignerAdapter/);
});

test('public Studio packaging includes the shared Designer selection module', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(buildSite, /'designer-selection\.js'/);
  assert.match(sw, /'\.\/designer-selection\.js'/);
});
