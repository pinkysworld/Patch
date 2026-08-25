import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_COMPONENTS,
  PATCH_COMPONENT_REGISTRY_VERSION,
  listPatchComponents,
  patchComponent,
  patchComponentCategories
} from '../src/component-registry.js';

test('component registry exposes the current source-backed Designer families plus Picture', () => {
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.1');
  assert.deepEqual(PATCH_COMPONENTS.map(component => component.type), [
    'text', 'button', 'input', 'checkbox',
    'radio', 'combo', 'listbox', 'slider',
    'table', 'tree', 'tabs', 'panel',
    'picture', 'statusbar', 'timer'
  ]);
});

test('Picture is discoverable as a visual Graphics component with the existing default size', () => {
  assert.deepEqual(patchComponent('picture'), {
    type: 'picture',
    label: 'Picture',
    category: 'Graphics',
    visual: true,
    defaultSize: { width: 180, height: 120 }
  });
});

test('Timer remains nonvisual while ordinary controls remain visual', () => {
  assert.equal(patchComponent('timer').visual, false);
  assert.equal(patchComponent('button').visual, true);
});

test('component registry supports category discovery without a second mutable model', () => {
  assert.deepEqual(patchComponentCategories(), ['Basic', 'Choices', 'Data', 'Containers', 'Graphics', 'Chrome', 'Nonvisual']);
  assert.deepEqual(listPatchComponents({ category: 'Graphics' }).map(component => component.type), ['picture']);
  assert.equal(patchComponent('missing'), null);
});
