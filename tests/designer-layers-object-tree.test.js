import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDesignerLayerTree, STUDIO_LAYERS_VERSION } from '../web/designer-focus-order.js';

test('Layers object tree is derived only from visible Patch Forms and top-level controls', () => {
  const source = `window "Main" as main size 640, 420:\n  text "Heading" at 20, 20 size 180, 28\n  input name at 20, 64 size 220, 36\n  button "Save" as save_button at 20, 112 size 120, 36\n\nwindow "Settings" as settings size 520, 360:\n  checkbox "Enabled" as enabled at 20, 20 size 180, 32\n`;
  const tree = buildDesignerLayerTree(source);
  assert.equal(STUDIO_LAYERS_VERSION, '0.1');
  assert.deepEqual(tree.map(form => form.id), ['main', 'settings']);
  assert.deepEqual(tree[0].controls.map(control => control.type), ['text', 'input', 'button']);
  assert.deepEqual(tree[0].controls.map(control => control.id), [null, 'name', 'save_button']);
  assert.deepEqual(tree[1].controls.map(control => control.id), ['enabled']);
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

test('Layers object tree provides roving keyboard navigation without mutating source', () => {
  const source = fs.readFileSync('web/designer-focus-order.js', 'utf8');
  assert.match(source, /LAYER_NAVIGATION_KEYS = new Set\(\['ArrowUp', 'ArrowDown', 'Home', 'End'\]\)/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /setRovingLayerRow/);
  assert.match(source, /item\.tabIndex = item === row \? 0 : -1/);
  assert.match(source, /Container-child visualization remains a later stage/);
  assert.doesNotMatch(source.slice(source.indexOf('function installLayers'), source.indexOf('function activeFormIndex')), /setSource\(/);
});
