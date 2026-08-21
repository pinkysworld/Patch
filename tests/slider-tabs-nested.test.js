import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import {
  addDesignerTabPageControl,
  listDesignerTabPageControls,
  removeDesignerTabPageControl,
  supportedDesignerTabControlTypes
} from '../src/designer-tabs-nested.js';

const base = `window "Settings" as main size 640, 420:
  tabs as settings at 24, 24 size 500, 320:
    tab "General":
      text "General"
    tab "Audio":
      text "Audio"
`;

function tabs(source = base) {
  return listDesignerControls(source).find(control => control.type === 'tabs');
}

test('Slider is a first-class supported nested Tabs control', () => {
  assert.ok(supportedDesignerTabControlTypes().includes('slider'));
  const source = addDesignerTabPageControl(base, tabs(), 1, 'slider');
  assert.match(source, /tab "Audio":\n      text "Audio"\n      slider 0\.\.100 as slider_1 step 1/);
  assert.doesNotMatch(source, /slider 0\.\.100 as slider_1 step 1 at/);
  assert.doesNotThrow(() => parse(source));

  const slider = listDesignerTabPageControls(source, tabs(source), 1).find(control => control.type === 'slider');
  assert.ok(slider);
  assert.equal(slider.id, 'slider_1');
  assert.equal(slider.min, 0);
  assert.equal(slider.max, 100);
  assert.equal(slider.step, 1);
});

test('nested Slider ids share the global Designer id namespace', () => {
  const source = `window "Settings":
  slider 0..10 as slider_1
  tabs as settings:
    tab "General":
      text "General"
    tab "Audio":
      text "Audio"
`;
  const next = addDesignerTabPageControl(source, tabs(source), 1, 'slider');
  assert.match(next, /slider 0\.\.100 as slider_2 step 1/);
});

test('removing nested Slider removes its complete source line and handler', () => {
  let source = addDesignerTabPageControl(base, tabs(), 1, 'slider');
  source += `\nwhen slider_1 changed:\n  show value\n`;
  const control = listDesignerTabPageControls(source, tabs(source), 1).find(item => item.type === 'slider');
  const next = removeDesignerTabPageControl(source, tabs(source), 1, control.controlIndex);
  assert.doesNotMatch(next, /slider 0\.\.100 as slider_1/);
  assert.doesNotMatch(next, /when slider_1 changed:/);
  assert.doesNotThrow(() => parse(next));
});
