import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  clearDesignerSelection,
  currentDesignerSelection,
  designerSelectionForControl,
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

test('control-to-selection mapping gives ordinary controls and Tabs the core adapter', () => {
  assert.deepEqual(designerSelectionForControl({ type: 'button', windowIndex: 0, controlIndex: 2, id: 'save' }), {
    windowIndex: 0,
    controlIndex: 2,
    adapter: 'core',
    id: 'save'
  });
  assert.equal(designerSelectionForControl({ type: 'tabs', windowIndex: 1, controlIndex: 0, id: 'settings' })?.adapter, 'core');
  assert.equal(designerSelectionForControl({ type: 'table', windowIndex: 0, controlIndex: 3, id: 'people' })?.adapter, 'table');
  assert.equal(designerSelectionForControl({ type: 'tree', windowIndex: 0, controlIndex: 4, id: 'files' })?.adapter, 'tree');
  assert.equal(designerSelectionForControl({ type: 'tree', windowIndex: 0, controlIndex: 4 }, 'core')?.adapter, 'core');
});

test('shared Designer selection state is one adapter-aware store per canvas', () => {
  const canvas = fakeCanvas();
  rememberDesignerSelection(canvas, { windowIndex: 0, controlIndex: 2, adapter: 'core', id: 'save' }, { emit: false });
  assert.equal(currentDesignerSelection(canvas, 'core')?.id, 'save');

  rememberDesignerSelection(canvas, { windowIndex: 0, controlIndex: 3, adapter: 'table', id: 'people' }, { emit: false });
  assert.equal(currentDesignerSelection(canvas, 'core'), null, 'Table replaces the prior core selection in the one shared store');
  assert.equal(currentDesignerSelection(canvas, 'table')?.id, 'people');

  rememberDesignerSelection(canvas, { windowIndex: 1, controlIndex: 0, adapter: 'tree', id: 'files' }, { emit: false });
  assert.equal(currentDesignerSelection(canvas, 'table'), null, 'TreeView replaces the prior Table selection');
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

test('ordinary controls and Tabs are bridged into the same selection store and event boundary', () => {
  const core = fs.readFileSync('web/designer-core-selection.js', 'utf8');
  const shared = fs.readFileSync('web/designer-selection.js', 'utf8');
  const index = fs.readFileSync('web/index.html', 'utf8');

  assert.match(core, /CORE_TOOL_TYPES/);
  for (const type of ['text', 'button', 'input', 'checkbox', 'radio', 'combo', 'listbox', 'tabs']) {
    assert.match(core, new RegExp(`'${type}'`));
  }
  assert.match(core, /designerSelectionForControl\(control, 'core'\)/);
  assert.match(core, /selectDesignerElement/);
  assert.match(core, /decorateDesignerAdapterElement/);
  assert.match(core, /DESIGNER_SELECTION_EVENT/);
  assert.match(core, /pendingToolAdd/);
  assert.match(shared, /if \(control\) return;/, 'the canvas bridge must not clear selection merely because a core control was clicked');
  assert.match(index, /\.\/designer-core-selection\.js/);
});

test('shared selection is also the normal Properties Apply/Delete/Source boundary', () => {
  const core = fs.readFileSync('web/designer-core-selection.js', 'utf8');
  assert.match(core, /installSharedInspectorBridge/);
  assert.match(core, /captureInspectorApply/);
  assert.match(core, /captureInspectorDelete/);
  assert.match(core, /captureInspectorSource/);
  assert.match(core, /applySharedInspector/);
  assert.match(core, /populateSharedInspector/);
  assert.match(core, /updateDesignerControl\(code\.value, selection, changes\)/);
  assert.match(core, /removeDesignerControl\(code\.value, selection\)/);
  assert.match(core, /event\.stopImmediatePropagation\(\)/, 'shared capture handlers must win over legacy adapter/property fallbacks');
  assert.match(core, /designerSelectionForControl\(updated, selection\.adapter\)/, 'renames must preserve the active adapter identity');
});

test('core selection bridge is additive migration, not a false claim that the playground mirror is already removed', () => {
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  const core = fs.readFileSync('web/designer-core-selection.js', 'utf8');
  const doc = fs.readFileSync('docs/STUDIO_SELECTION_ARCHITECTURE.md', 'utf8');
  assert.match(playground, /let designerSelection = null;/);
  assert.match(core, /legacySelected/);
  assert.match(core, /rememberDesignerSelection\(canvas, selection, \{ emit: false \}\)/);
  assert.match(doc, /private `designerSelection` mirror/);
  assert.match(doc, /not as total removal of every historical selection implementation/);
});

test('public Studio packaging and docs include shared Designer selection and the core bridge', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const checkSite = fs.readFileSync('scripts/check-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  const docs = fs.readFileSync('web/docs.html', 'utf8');
  assert.match(buildSite, /'designer-selection\.js'/);
  assert.match(buildSite, /'designer-core-selection\.js'/);
  assert.match(checkSite, /Core Designer selection bridge/);
  assert.match(sw, /'\.\/designer-selection\.js'/);
  assert.match(sw, /'\.\/designer-core-selection\.js'/);
  assert.match(docs, /docs\/STUDIO_SELECTION_ARCHITECTURE\.md/);
});
