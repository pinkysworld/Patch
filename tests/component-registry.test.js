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

test('component registry exposes the current source-backed Designer families plus Picture', () => {
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.2');
  assert.deepEqual(PATCH_COMPONENTS.map(component => component.type), [
    'text', 'button', 'input', 'checkbox',
    'radio', 'combo', 'listbox', 'slider',
    'table', 'tree', 'tabs', 'panel',
    'picture', 'statusbar', 'timer'
  ]);
  assert.equal(new Set(PATCH_COMPONENTS.map(component => component.buttonId)).size, PATCH_COMPONENTS.length);
});

test('Picture is discoverable as a visual Graphics component with source-backed tool and event metadata', () => {
  assert.deepEqual(patchComponent('picture'), {
    type: 'picture',
    label: 'Picture',
    category: 'Graphics',
    buttonId: 'addPicture',
    visual: true,
    defaultSize: { width: 180, height: 120 },
    events: [{ name: 'clicked', label: 'OnClick', value: false }]
  });
  assert.equal(patchComponentForButton('addPicture')?.type, 'picture');
});

test('Timer remains nonvisual and carries its source-backed OnTick contract', () => {
  assert.equal(patchComponent('timer').visual, false);
  assert.deepEqual(patchComponent('timer').events, [{ name: 'ticked', label: 'OnTick', value: false }]);
  assert.equal(patchComponent('button').visual, true);
});

test('component registry supports category discovery without a second mutable model', () => {
  assert.deepEqual(patchComponentCategories(), ['Basic', 'Choices', 'Data', 'Containers', 'Graphics', 'Chrome', 'Nonvisual']);
  assert.deepEqual(listPatchComponents({ category: 'Graphics' }).map(component => component.type), ['picture']);
  assert.equal(patchComponent('missing'), null);
  assert.equal(patchComponentForButton('missing'), null);
});
