import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = `window "Shapes" as main size 700, 460:
  shape rectangle as rect fill #112233 stroke #445566 stroke-width 3 opacity 0.8 at 24, 24 size 180, 100
  shape rounded as card fill #dbeafe stroke #2563eb stroke-width 2 radius 16 opacity 1 at 224, 24 size 180, 100
  shape ellipse as badge fill #abcdef stroke #123456 stroke-width 4 opacity 0.6 at 24, 160 size 140, 100
  shape line as divider stroke #334455 stroke-width 5 opacity 0.9 at 224, 180 size 240, 40
`;

test('Standalone Window Web exports all Shape Stage 1 kinds as source-backed SVG', () => {
  const built = buildStandaloneWebApp(source, { name: 'ShapeWeb', kind: 'window' });
  assert.equal(built.metadata.shapeStage, 1);
  assert.equal(built.metadata.shapeMode, 'source-backed-svg');
  assert.match(built.html, /PATCH_SHAPE_DESCRIPTORS/);
  assert.match(built.html, /patchShapeElement/);
  assert.match(built.html, /createElementNS\(PATCH_SVG_NS,'svg'\)/);
  assert.match(built.html, /classList\.add\('patch-shape'\)/);
  assert.match(built.html, /"rect":\{"viewBox":"0 0 100 100","element":"rect"/);
  assert.match(built.html, /"card":\{"viewBox":"0 0 100 100","element":"rect"/);
  assert.match(built.html, /"badge":\{"viewBox":"0 0 100 100","element":"ellipse"/);
  assert.match(built.html, /"divider":\{"viewBox":"0 0 100 100","element":"line"/);
  assert.match(built.html, /stroke-width/);
  assert.match(built.html, /vector-effect/);
});

test('generated Shape Web runtime creates the canonical SVG primitive and accessibility label', () => {
  const built = buildStandaloneWebApp(source, { name: 'ShapeRuntime', kind: 'window' });
  const scripts = [...built.html.matchAll(/<script data-patch-window-accessibility>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);

  class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...values) { for (const value of values) this.values.add(value); }
    contains(value) { return this.values.has(value); }
  }
  class FakeElement {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.listeners = {};
      this.attributes = new Map();
      this.dataset = {};
      this.classList = new FakeClassList();
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
    createElementNS(_ns, tag) { return new FakeElement(tag); },
    getElementById(id) { return id === 'output' ? output : null; },
    querySelectorAll() { return []; }
  };
  const context = vm.createContext({ document, console, structuredClone });
  vm.runInContext(`
class PatchAppError extends Error {}
var PROGRAM = [{ kind:'window', body:[{ kind:'uiControl', control:'shape', id:'card' }] }];
var state = new Map();
var rendered = null;
var events = [];
function buildUIItems(nodes) { return nodes.map(node => ({ type:node.control, id:node.id, text:'' })); }
function renderControl(control) { const el = document.createElement('div'); el.textContent = control.text || ''; return el; }
function render() { rendered = renderControl(buildUIItems(PROGRAM[0].body)[0], 'main', 0); }
function safeTrigger() {}
`, context);
  vm.runInContext(scripts[0][1], context, { timeout: 1000 });

  const svg = context.rendered;
  assert.equal(svg.tagName, 'SVG');
  assert.equal(svg.classList.contains('patch-shape'), true);
  assert.equal(svg.getAttribute('viewBox'), '0 0 100 100');
  assert.equal(svg.getAttribute('role'), 'img');
  assert.equal(svg.getAttribute('aria-label'), 'card shape');
  assert.equal(svg.children.length, 1);
  const rect = svg.children[0];
  assert.equal(rect.tagName, 'RECT');
  assert.equal(rect.getAttribute('fill'), '#dbeafe');
  assert.equal(rect.getAttribute('stroke'), '#2563eb');
  assert.equal(rect.getAttribute('stroke-width'), '2');
  assert.equal(rect.getAttribute('rx'), '16');
  assert.equal(rect.getAttribute('vector-effect'), 'non-scaling-stroke');
});
