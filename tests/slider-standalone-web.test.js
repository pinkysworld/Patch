import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = `create number volume = 25

window "Mixer" as main size 520, 240:
  slider 0..100 as volume step 5 at 24, 40 size 360, 48
  text "Volume: {volume}"

when volume changed:
  change volume:
    set = value
`;

test('Standalone Window Web builds Slider Stage 1 without widening native GUI v1.3', () => {
  const built = buildStandaloneWebApp(source, { name: 'SliderWeb', kind: 'window' });
  assert.equal(built.metadata.sliderStage, 1);
  assert.equal(built.metadata.sliderMode, 'transient-number');
  assert.match(built.html, /control\?\.type==='slider'/);
  assert.match(built.html, /input\.type='range'/);
  assert.match(built.html, /input\.min=String\(control\.min\)/);
  assert.match(built.html, /input\.max=String\(control\.max\)/);
  assert.match(built.html, /input\.step=String\(control\.step\?\?1\)/);
  assert.match(built.html, /Number\(input\.value\)/);
  assert.match(built.html, /finite numeric event-local value/);
});

test('generated Slider Web runtime emits numeric changed values and keeps input display live', () => {
  const built = buildStandaloneWebApp(source, { name: 'SliderRuntime', kind: 'window' });
  const scripts = [...built.html.matchAll(/<script data-patch-window-accessibility>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);

  class FakeElement {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.listeners = {};
      this.attributes = new Map();
      this.dataset = {};
      this.textContent = '';
      this.value = '';
      this.className = '';
      this.tabIndex = 0;
      this.id = '';
    }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); return node; }
    addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    focus() { this.focused = true; }
  }

  const output = new FakeElement('pre');
  const document = {
    createElement(tag) { return new FakeElement(tag); },
    getElementById(id) { return id === 'output' ? output : null; },
    querySelectorAll() { return []; }
  };
  const context = vm.createContext({ document, console, structuredClone });
  vm.runInContext(`
class PatchAppError extends Error {}
var state = new Map([['volume', 25]]);
var rendered = null;
var triggered = [];
function controlType(id) { return id === 'volume' ? 'slider' : null; }
function buildUIItems(nodes) { return nodes.map(node => ({ type:node.control, id:node.id, value:state.get(node.id) ?? '' })); }
function renderControl(control) { const el = document.createElement('div'); el.textContent = control.text || ''; return el; }
function trigger(control,event,payload) { triggered.push({ control, event, payload }); return payload; }
function safeTrigger(control,event,payload) { return trigger(control,event,payload); }
function render() {
  const model = buildUIItems([{ kind:'uiControl', control:'slider', id:'volume', min:0, max:100, step:5 }])[0];
  rendered = renderControl(model, 'main', 0);
}
`, context);
  vm.runInContext(scripts[0][1], context, { timeout: 1000 });

  const rendered = context.rendered;
  assert.equal(rendered.tagName, 'LABEL');
  const input = rendered.children.find(child => child.tagName === 'INPUT');
  const value = rendered.children.find(child => child.tagName === 'OUTPUT');
  assert.ok(input);
  assert.ok(value);
  assert.equal(input.type, 'range');
  assert.equal(input.min, '0');
  assert.equal(input.max, '100');
  assert.equal(input.step, '5');
  assert.equal(input.value, '25');

  input.value = '40';
  input.listeners.input[0]();
  assert.equal(value.textContent, '40');
  input.listeners.change[0]();
  assert.equal(context.triggered.length, 1);
  assert.equal(context.triggered[0].control, 'volume');
  assert.equal(context.triggered[0].event, 'changed');
  assert.equal(context.triggered[0].payload.value, 40);

  assert.throws(
    () => context.trigger('volume', 'changed', { value: '40' }),
    /finite numeric event-local value/
  );
});
