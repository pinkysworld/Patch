import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { PATCH_WINDOW_WEB_ACCESSIBILITY_VERSION } from '../src/window-web-accessibility.js';

const windowSource = `create text name = "Mia"
create text mode = "Basic"
create text choice = "One"
create text item = "One"

window "Settings" as main size 640, 520:
  input name
  radio "Basic", "Advanced", "Expert" as mode at 24, 72 size 240, 90
  combo "One", "Two", "Three" as choice at 300, 72 size 180, 34
  listbox "One", "Two", "Three" as item at 300, 120 size 180, 100
  tabs as pages at 24, 250 size 456, 190:
    tab "General":
      text "General settings"
    tab "Advanced":
      text "Advanced settings"

when mode changed:
  change mode:
    set = value
`;

test('Standalone Window Web build advertises the generated accessibility baseline', () => {
  const built = buildStandaloneWebApp(windowSource, { name: 'AccessibleSettings', kind: 'window' });
  assert.equal(built.metadata.accessibilityVersion, PATCH_WINDOW_WEB_ACCESSIBILITY_VERSION);
  assert.match(built.html, /data-patch-window-accessibility/);
  assert.match(built.html, /id="output" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(built.html, /patch-radio-group/);
  assert.match(built.html, /role','radiogroup'/);
  assert.match(built.html, /aria-controls/);
  assert.match(built.html, /aria-labelledby/);
  assert.match(built.html, /ArrowLeft/);
  assert.match(built.html, /ArrowRight/);
  assert.match(built.html, /Home/);
  assert.match(built.html, /End/);
  assert.match(built.html, /prefers-reduced-motion/);
  assert.match(built.html, /forced-colors:active/);
});

test('generated accessibility runtime restores missing standalone Radio rendering and changed events', () => {
  const built = buildStandaloneWebApp(windowSource, { name: 'RadioRuntime', kind: 'window' });
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
      this.className = '';
      this.value = '';
      this.checked = false;
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
  const context = vm.createContext({ document, console });
  vm.runInContext(`
var rendered = null;
var triggered = [];
function renderControl(control) { const el = document.createElement('div'); el.textContent = control.text || ''; return el; }
function render() { rendered = renderControl({ type:'radio', id:'mode', options:['Basic','Advanced','Expert'], value:'Basic' }, 'main', 0); }
function safeTrigger(control,event,payload) { triggered.push({ control, event, payload }); }
`, context);
  vm.runInContext(scripts[0][1], context, { timeout: 1000 });

  const rendered = context.rendered;
  assert.equal(rendered.tagName, 'FIELDSET');
  assert.equal(rendered.attributes.get('role'), 'radiogroup');
  const legend = rendered.children.find(child => child.tagName === 'LEGEND');
  assert.ok(legend);
  assert.equal(rendered.attributes.get('aria-labelledby'), legend.id);
  const labels = rendered.children.filter(child => child.tagName === 'LABEL');
  assert.equal(labels.length, 3);
  const advanced = labels[1].children.find(child => child.tagName === 'INPUT');
  assert.ok(advanced);
  assert.equal(advanced.type, 'radio');
  advanced.checked = true;
  advanced.listeners.change[0]();
  assert.equal(context.triggered.length, 1);
  assert.equal(context.triggered[0].control, 'mode');
  assert.equal(context.triggered[0].event, 'changed');
  assert.equal(context.triggered[0].payload.value, 'Advanced');
});

test('generated tab baseline uses roving focus and preserves focus after activation', () => {
  const built = buildStandaloneWebApp(windowSource, { name: 'TabsA11y', kind: 'window' });
  assert.match(built.html, /tab\.tabIndex=tab\.getAttribute\?\.\('aria-selected'\)==='true'\?0:-1/);
  assert.match(built.html, /panel\.setAttribute\?\.\('aria-labelledby'/);
  assert.match(built.html, /event\.preventDefault\(\)/);
  assert.match(built.html, /rebuiltTabs\[next\]\?\.focus\?\.\(\)/);
});

test('generated controls receive accessible names where native HTML labels are absent', () => {
  const built = buildStandaloneWebApp(windowSource, { name: 'ControlNames', kind: 'window' });
  assert.match(built.html, /control\?\.type==='input'.*aria-label/s);
  assert.match(built.html, /control\?\.type==='combo'.*aria-label/s);
  assert.match(built.html, /control\?\.type==='listbox'.*aria-label/s);
});

test('Standalone Console Web output also exposes a live status and keyboard focus baseline', () => {
  const built = buildStandaloneWebApp('show 1\n', { name: 'ConsoleA11y', kind: 'console' });
  assert.match(built.html, /id="output" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(built.html, /button:focus-visible/);
  assert.match(built.html, /forced-colors:active/);
  assert.match(built.html, /prefers-reduced-motion:reduce/);
});

test('Window accessibility module is part of content-addressed site builds and offline cache', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
  const webapp = fs.readFileSync('src/webapp.js', 'utf8');
  assert.match(buildSite, /'window-web-accessibility\.js'/);
  assert.match(serviceWorker, /'\.\.\/src\/window-web-accessibility\.js'/);
  assert.match(webapp, /from '\.\/window-web-accessibility\.js'/);
  assert.match(webapp, /enhanceStandaloneWindowWebApp/);
});
