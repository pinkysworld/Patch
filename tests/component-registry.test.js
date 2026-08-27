import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_COMPONENTS,
  PATCH_COMPONENT_REGISTRY_VERSION,
  listPatchComponents,
  patchComponent,
  patchComponentCategories,
  patchComponentForButton
} from '../src/component-registry.js';

test('component registry exposes the current source-backed Designer families plus Graphics Stage 1', () => {
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.7');
  assert.deepEqual(PATCH_COMPONENTS.map(component => component.type), [
    'text', 'button', 'input', 'checkbox',
    'radio', 'combo', 'listbox', 'slider',
    'table', 'tree', 'tabs', 'panel',
    'picture', 'shape', 'paintbox', 'statusbar', 'timer'
  ]);
  assert.equal(new Set(PATCH_COMPONENTS.map(component => component.buttonId)).size, PATCH_COMPONENTS.length);
});

test('Picture is discoverable with source-backed properties event renderer and target metadata', () => {
  const picture = patchComponent('picture');
  assert.equal(picture.type, 'picture');
  assert.equal(picture.label, 'Picture');
  assert.equal(picture.category, 'Graphics');
  assert.equal(picture.buttonId, 'addPicture');
  assert.equal(picture.visual, true);
  assert.deepEqual(picture.defaultSize, { width: 180, height: 120 });
  assert.deepEqual(picture.properties.map(property => property.name), ['id', 'sourceExpr', 'x', 'y', 'width', 'height']);
  assert.deepEqual(picture.events, [{ name: 'clicked', label: 'OnClick', value: false }]);
  assert.equal(picture.designRenderer, 'picture');
  assert.deepEqual(picture.targetSupport, {
    studio: 'supported', web: 'supported', windows: 'supported', macos: 'supported', linux: 'supported', freebsd: 'unsupported'
  });
  assert.equal(patchComponentForButton('addPicture')?.type, 'picture');
});

test('Shape Stage 1 exposes Studio authoring and Standalone Web without overclaiming native runtime support', () => {
  const shape = patchComponent('shape');
  assert.equal(shape.type, 'shape');
  assert.equal(shape.label, 'Shape');
  assert.equal(shape.category, 'Graphics');
  assert.equal(shape.buttonId, 'addShape');
  assert.equal(shape.visual, true);
  assert.deepEqual(shape.defaultSize, { width: 180, height: 120 });
  assert.deepEqual(shape.properties.map(property => property.name), [
    'id', 'shapeKind', 'fill', 'stroke', 'strokeWidth', 'cornerRadius', 'opacity',
    'x', 'y', 'width', 'height'
  ]);
  assert.deepEqual(shape.events, []);
  assert.equal(shape.designRenderer, 'shape');
  assert.deepEqual(shape.targetSupport, {
    studio: 'authoring', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported'
  });
  assert.equal(patchComponentForButton('addShape')?.type, 'shape');
});

test('PaintBox Stage 1 exposes Studio authoring and Standalone Web while native remains gated', () => {
  const paintbox = patchComponent('paintbox');
  assert.equal(paintbox.type, 'paintbox');
  assert.equal(paintbox.label, 'PaintBox');
  assert.equal(paintbox.category, 'Graphics');
  assert.equal(paintbox.buttonId, 'addPaintbox');
  assert.equal(paintbox.visual, true);
  assert.deepEqual(paintbox.defaultSize, { width: 320, height: 200 });
  assert.deepEqual(paintbox.properties.map(property => property.name), ['id', 'x', 'y', 'width', 'height']);
  assert.deepEqual(paintbox.events, [{ name: 'paint', label: 'OnPaint', value: false }]);
  assert.equal(paintbox.designRenderer, 'paintbox');
  assert.deepEqual(paintbox.targetSupport, {
    studio: 'authoring', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported'
  });
  assert.equal(patchComponentForButton('addPaintbox')?.type, 'paintbox');
});

test('Timer remains nonvisual and carries source-backed property and OnTick contracts', () => {
  const timer = patchComponent('timer');
  assert.equal(timer.visual, false);
  assert.deepEqual(timer.properties.map(property => property.name), ['id', 'interval']);
  assert.deepEqual(timer.events, [{ name: 'ticked', label: 'OnTick', value: false }]);
  assert.equal(patchComponent('button').visual, true);
});

test('component registry descriptors are immutable metadata rather than a second UI model', () => {
  const button = patchComponent('button');
  assert.equal(Object.isFrozen(button), true);
  assert.equal(Object.isFrozen(button.properties), true);
  assert.equal(Object.isFrozen(button.targetSupport), true);
  assert.deepEqual(button.properties.map(property => property.name), ['id', 'textExpr', 'x', 'y', 'width', 'height']);
});

test('component registry supports category discovery without a second mutable model', () => {
  assert.deepEqual(patchComponentCategories(), ['Basic', 'Choices', 'Data', 'Containers', 'Graphics', 'Chrome', 'Nonvisual']);
  assert.deepEqual(listPatchComponents({ category: 'Graphics' }).map(component => component.type), ['picture', 'shape', 'paintbox']);
  assert.equal(patchComponent('missing'), null);
  assert.equal(patchComponentForButton('missing'), null);
});
