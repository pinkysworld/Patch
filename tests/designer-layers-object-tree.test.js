import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDesignerLayerTree, STUDIO_LAYERS_VERSION } from '../web/designer-focus-order.js';

test('Layers object tree is derived only from visible Patch Forms and top-level controls', () => {
  const source = `window "Main" as main size 640, 420:\n  text "Heading" at 20, 20 size 180, 28\n  input name at 20, 64 size 220, 36\n  button "Save" as save_button at 20, 112 size 120, 36\n\nwindow "Settings" as settings size 520, 360:\n  checkbox "Enabled" as enabled at 20, 20 size 180, 32\n`;
  const tree = buildDesignerLayerTree(source);
  assert.equal(STUDIO_LAYERS_VERSION, '0.2');
  assert.deepEqual(tree.map(form => form.id), ['main', 'settings']);
  assert.deepEqual(tree[0].controls.map(control => control.type), ['text', 'input', 'button']);
  assert.deepEqual(tree[0].controls.map(control => control.id), [null, 'name', 'save_button']);
  assert.deepEqual(tree[1].controls.map(control => control.id), ['enabled']);
  assert.deepEqual(tree[0].controls.map(control => control.children), [[], [], []]);
});

test('Layers object tree exposes real Panel children and Tabs pages with nested controls', () => {
  const source = `window "Demo" as main size 720, 520:\n  panel as details at 24, 24 size 300, 170:\n    text "Inside"\n    button "Action" as panel_action\n  tabs as settings at 24, 220 size 500, 260:\n    tab "General":\n      input name\n      button "Save" as save\n    tab "Advanced":\n      tree as files:\n        node "Root"\n`;
  const tree = buildDesignerLayerTree(source);
  const panel = tree[0].controls.find(control => control.id === 'details');
  const tabs = tree[0].controls.find(control => control.id === 'settings');

  assert.deepEqual(panel.children.map(child => child.type), ['text', 'button']);
  assert.deepEqual(panel.children.map(child => child.id), [null, 'panel_action']);
  assert.ok(panel.children.every(child => child.kind === 'panel-child' && child.parentControlIndex === panel.controlIndex));
  assert.ok(panel.children.every(child => Number.isInteger(child.line)));

  assert.equal(tabs.pages.length, 2);
  assert.deepEqual(tabs.pages.map(page => page.titleExpr), ['"General"', '"Advanced"']);
  assert.deepEqual(tabs.pages[0].controls.map(control => control.type), ['input', 'button']);
  assert.deepEqual(tabs.pages[0].controls.map(control => control.id), ['name', 'save']);
  assert.deepEqual(tabs.pages[1].controls.map(control => control.type), ['tree']);
  assert.ok(tabs.pages.every(page => page.kind === 'tab-page' && page.parentControlIndex === tabs.controlIndex));
  assert.ok(tabs.pages.flatMap(page => page.controls).every(control =>
    control.kind === 'tab-control' &&
    control.parentControlIndex === tabs.controlIndex &&
    Number.isInteger(control.pageIndex) &&
    Number.isInteger(control.nestedControlIndex)
  ));
});

test('Layers UI reuses canonical Designer selection and active Form materialization', () => {
  const source = fs.readFileSync('web/designer-focus-order.js', 'utf8');
  assert.match(source, /id = 'designerLayers'/);
  assert.match(source, /Layers · Object Tree/);
  assert.match(source, /role="tree" aria-label="Patch Forms and controls"/);
  assert.match(source, /role="treeitem" aria-level=/);
  assert.match(source, /currentDesignerSelection\(canvas\)/);
  assert.match(source, /designerSelectionForControl\(control\)/);
  assert.match(source, /selectDesignerElement\(canvas, element, selection, \{ reason: 'layers-object-tree' \}\)/);
  assert.match(source, /formSelect\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => select\(2\)\)/);
});

test('Layers hierarchy reuses Panel and Tabs editors for nested rows', () => {
  const source = fs.readFileSync('web/designer-focus-order.js', 'utf8');
  assert.match(source, /listDesignerPanels/);
  assert.match(source, /listDesignerTabPages/);
  assert.match(source, /listDesignerTabPageControls/);
  assert.match(source, /data-parent-control-index/);
  assert.match(source, /data-child-index/);
  assert.match(source, /data-page-index/);
  assert.match(source, /data-nested-control-index/);
  assert.match(source, /#designerPanelChildList/);
  assert.match(source, /\.designer-tabs-page\[data-tab-page-index=/);
  assert.match(source, /\.designer-tabs-control-row\[data-tabs-control-index=/);
  assert.match(source, /aria-level="3"/);
  assert.match(source, /aria-level="4"/);
  assert.doesNotMatch(source, /Container-child visualization remains a later stage/);
});

test('Layers object tree provides roving keyboard navigation without mutating source', () => {
  const source = fs.readFileSync('web/designer-focus-order.js', 'utf8');
  assert.match(source, /LAYER_NAVIGATION_KEYS = new Set\(\['ArrowUp', 'ArrowDown', 'Home', 'End'\]\)/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /setRovingLayerRow/);
  assert.match(source, /item\.tabIndex = item === row \? 0 : -1/);
  assert.match(source, /Panel children and Tabs pages\/controls are derived from visible Patch source/);
  assert.doesNotMatch(source.slice(source.indexOf('function installLayers'), source.indexOf('function activeFormIndex')), /setSource\(/);
});
