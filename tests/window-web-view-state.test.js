import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp, resolveStandaloneListboxSelection } from '../src/webapp.js';
import { buildStandaloneWindowWebApp } from '../src/window-webapp.js';

const source = `create text name = "Ada"
create list fruit = ["Banana"]

window "Desk" as main:
  tabs as pages:
    tab "Write":
      input name
    tab "Pick":
      listbox "Apple", "Banana", "Cherry" as fruit
  button "Next" as next

when name changed:
  change name:
    set = value

when fruit changed:
  show value

when next clicked:
  change fruit:
    set = ["Cherry"]
`;

function dataKey(attr) {
  return attr.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function matches(node, selector) {
  if (!node || typeof node !== 'object') return false;
  if (selector.includes(',')) return selector.split(',').some(part => matches(node, part.trim()));
  const attr = /^\[([^\]]+)\]$/.exec(selector);
  if (!attr) return false;
  const name = attr[1];
  if (name.startsWith('data-')) return node.dataset?.[dataKey(name)] !== undefined && node.dataset[dataKey(name)] !== '';
  return node.attributes?.has(name) === true;
}

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.id = '';
    this.hidden = false;
    this.type = this.tagName === 'BUTTON' ? 'button' : '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.multiple = false;
    this.selected = false;
    this.size = 0;
    this.tabIndex = 0;
    this.disabled = false;
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  appendChild(node) {
    if (typeof node === 'string' || typeof node === 'number') {
      this.textContent += String(node);
      return node;
    }
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name.startsWith('data-')) return this.dataset[dataKey(name)] ?? null;
    return this.attributes.get(name) ?? null;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML ?? '';
  }

  get selectedOptions() {
    return this.children.filter(child => child?.tagName === 'OPTION' && child.selected);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const out = [];
    const visit = node => {
      for (const child of node.children || []) {
        if (!child || typeof child !== 'object') continue;
        if (matches(child, selector)) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  querySelector(selector) {
    if (selector.includes(',')) {
      for (const part of selector.split(',')) {
        const found = this.querySelector(part.trim());
        if (found) return found;
      }
      return null;
    }
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

function executeRuntime(html) {
  const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'standalone Window HTML should contain the generated runtime');
  const app = new FakeElement('main');
  const output = new FakeElement('pre');
  const scrollingElement = { scrollTop: 0, scrollLeft: 0 };
  const document = {
    activeElement: null,
    scrollingElement,
    documentElement: scrollingElement,
    getElementById(id) {
      if (id === 'app') return app;
      if (id === 'output') return output;
      return null;
    },
    createElement(tag) {
      const el = new FakeElement(tag);
      el.ownerDocument = document;
      return el;
    }
  };
  app.ownerDocument = document;
  vm.runInNewContext(match[1], { document, structuredClone, console }, { timeout: 1000 });
  return { app, output, document };
}

function walk(root, predicate, out = []) {
  if (predicate(root)) out.push(root);
  for (const child of root.children || []) {
    if (child && typeof child === 'object') walk(child, predicate, out);
  }
  return out;
}

function dispatch(el, type) {
  for (const listener of el.listeners[type] || []) listener({ type, target: el });
}

test('resolveStandaloneListboxSelection keeps a transient selection only while the model is unchanged', () => {
  assert.deepEqual(
    resolveStandaloneListboxSelection(['Banana', 'Mango'], ['Apple', 'Cherry'], ['Banana', 'Mango']),
    { model: ['Banana', 'Mango'], selected: ['Apple', 'Cherry'] }
  );
  assert.deepEqual(
    resolveStandaloneListboxSelection(['Banana', 'Mango'], ['Apple', 'Cherry'], ['Cherry']),
    { model: ['Cherry'], selected: ['Cherry'] }
  );
  assert.deepEqual(
    resolveStandaloneListboxSelection(undefined, ['Apple'], ['Banana']),
    { model: ['Banana'], selected: ['Banana'] }
  );
  assert.deepEqual(
    resolveStandaloneListboxSelection(['Banana'], 'Apple', ['Banana']),
    { model: ['Banana'], selected: ['Banana'] }
  );
});

test('standalone window runtime snapshots focus, caret, and scroll around render', () => {
  const compiled = compile(source, { name: 'Desk', kind: 'window' });
  const base = buildStandaloneWindowWebApp(compiled, 'Desk');
  assert.match(base.html, /function capturePatchView\(\)/);
  assert.match(base.html, /function restorePatchView\(view\)/);
  assert.match(base.html, /function render\(\)\{const view=capturePatchView\(\);const models=buildUI\(\);appEl\.innerHTML='';/);
  assert.match(base.html, /restorePatchView\(view\);\}/);
  assert.match(base.html, /selectionStart/);
  assert.match(base.html, /selectionEnd/);
  assert.match(base.html, /scrollTop/);
  assert.match(base.html, /data-patch-control-id/);
  assert.match(base.html, /data-patch-scroll-id/);
  assert.match(base.html, /tabSelections\.set\(key,index\);render\(\)/);

  const built = buildStandaloneWebApp(source, { name: 'Desk', kind: 'window' });
  assert.match(built.html, /function capturePatchView\(\)/);
  assert.match(built.html, /restorePatchView\(view\)/);
  assert.ok(built.html.includes(resolveStandaloneListboxSelection.toString()));
  assert.match(built.html, /resolveStandaloneListboxSelection\(listboxSelectionModels\.get\(key\),listboxSelections\.get\(key\),control\.value\)/);
  assert.match(built.html, /listboxSelections\.set\(key,\[\.\.\.selected\]\)/);
  assert.match(built.html, /listboxSelectionModels\.set\(key,\[\.\.\.choice\.model\]\)/);
  assert.doesNotMatch(built.html, /listboxSelections\.has\(key\)\?listboxSelections\.get\(key\)/);
  assert.match(built.html, /className=control\.buttonPresentation==='link'\?'patch-button patch-linklabel':'patch-button'/);
});

test('generated runtime restores input caret and scroll, and a changed list replaces a stale listbox cache', () => {
  const built = buildStandaloneWebApp(source, { name: 'Desk', kind: 'window' });
  const runtime = executeRuntime(built.html);
  const input = walk(runtime.app, node => node.tagName === 'INPUT')[0];
  const body = walk(runtime.app, node => node.className === 'body')[0];
  assert.ok(input);
  assert.equal(input.dataset.patchControlId, 'name');
  assert.equal(input.dataset.patchFocusKey, 'name');
  assert.equal(body.dataset.patchScrollId, 'main:body');

  input.focus();
  input.value = 'Ada!';
  input.selectionStart = 2;
  input.selectionEnd = 4;
  input.scrollTop = 9;
  body.scrollTop = 30;
  body.scrollLeft = 4;
  runtime.document.scrollingElement.scrollTop = 40;
  runtime.document.scrollingElement.scrollLeft = 2;
  dispatch(input, 'input');

  const nextInput = walk(runtime.app, node => node.tagName === 'INPUT')[0];
  const nextBody = walk(runtime.app, node => node.className === 'body')[0];
  assert.equal(nextInput.value, 'Ada!');
  assert.equal(runtime.document.activeElement, nextInput);
  assert.equal(nextInput.selectionStart, 2);
  assert.equal(nextInput.selectionEnd, 4);
  assert.equal(nextInput.scrollTop, 9);
  assert.equal(nextBody.scrollTop, 30);
  assert.equal(nextBody.scrollLeft, 4);
  assert.equal(runtime.document.scrollingElement.scrollTop, 40);
  assert.equal(runtime.document.scrollingElement.scrollLeft, 2);

  const tabs = walk(runtime.app, node => node.className === 'patch-tab-button');
  assert.equal(tabs.length, 2);
  tabs[1].focus();
  dispatch(tabs[1], 'click');
  const picked = walk(runtime.app, node => node.className === 'patch-tab-button' && node.getAttribute('aria-selected') === 'true');
  assert.equal(picked.length, 1);
  assert.equal(runtime.document.activeElement, picked[0]);
  assert.equal(picked[0].dataset.patchFocusKey, 'pages:tab:1');

  const select = walk(runtime.app, node => node.tagName === 'SELECT')[0];
  assert.ok(select);
  assert.equal(select.multiple, true);
  const option = value => select.children.find(child => child.value === value);
  assert.equal(option('Banana').selected, true);
  option('Apple').selected = true;
  option('Banana').selected = false;
  option('Cherry').selected = true;
  select.scrollTop = 15;
  dispatch(select, 'change');

  const kept = walk(runtime.app, node => node.tagName === 'SELECT')[0];
  const keptOption = value => kept.children.find(child => child.value === value);
  assert.equal(keptOption('Apple').selected, true);
  assert.equal(keptOption('Banana').selected, false);
  assert.equal(keptOption('Cherry').selected, true);
  assert.equal(kept.scrollTop, 15);

  kept.scrollTop = 18;
  const next = walk(runtime.app, node => node.tagName === 'BUTTON' && node.textContent === 'Next')[0];
  next.focus();
  dispatch(next, 'click');
  const changed = walk(runtime.app, node => node.tagName === 'SELECT')[0];
  const changedOption = value => changed.children.find(child => child.value === value);
  assert.equal(changedOption('Apple').selected, false);
  assert.equal(changedOption('Banana').selected, false);
  assert.equal(changedOption('Cherry').selected, true);
  assert.equal(changed.scrollTop, 18);
  assert.equal(runtime.document.activeElement.tagName, 'BUTTON');
  assert.equal(runtime.document.activeElement.textContent, 'Next');
});
