import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildStandaloneWebApp } from '../src/webapp.js';

class FakeElement {
  constructor(tag = 'div', id = '') {
    this.tagName = String(tag).toUpperCase();
    this.id = id;
    this.children = [];
    this.listeners = new Map();
    this.parentNode = null;
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.placeholder = '';
    this.hidden = false;
    this.type = '';
    this._innerHTML = '';
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }
  get innerHTML() { return this._innerHTML; }
  append(...children) { for (const child of children) this.appendChild(child); }
  appendChild(child) {
    if (child && typeof child === 'object') child.parentNode = this;
    this.children.push(child);
    return child;
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  dispatch(name) {
    const event = { type: name, target: this, currentTarget: this };
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
  querySelector(selector) {
    if (selector.startsWith('#')) return find(this, node => node.id === selector.slice(1));
    return find(this, node => node.tagName?.toLowerCase() === selector.toLowerCase());
  }
}

function find(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children ?? []) {
    if (!child || typeof child !== 'object') continue;
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

function all(root, predicate, out = []) {
  if (predicate(root)) out.push(root);
  for (const child of root.children ?? []) if (child && typeof child === 'object') all(child, predicate, out);
  return out;
}

function executeWindowHtml(html) {
  const app = new FakeElement('main', 'app');
  const output = new FakeElement('pre', 'output');
  const run = new FakeElement('button', 'run');
  const ids = new Map([['app', app], ['output', output], ['run', run]]);
  const document = {
    getElementById(id) { return ids.get(id) ?? null; },
    querySelector(selector) { return selector.startsWith('#') ? ids.get(selector.slice(1)) ?? null : null; },
    createElement(tag) { return new FakeElement(tag); },
    body: new FakeElement('body')
  };
  const context = vm.createContext({
    document,
    console,
    structuredClone,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    Map,
    Set,
    Error
  });
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.ok(scripts.length, 'generated Window HTML must contain an inline runtime script');
  for (const source of scripts) vm.runInContext(source, context, { timeout: 2000 });
  return { app, output, run };
}

function currentInput(app) {
  const inputs = all(app, node => node.tagName === 'INPUT');
  assert.equal(inputs.length, 1, 'expected exactly one rendered Patch input');
  return inputs[0];
}

function visibleTexts(app) {
  return all(app, node => node.tagName === 'P').map(node => node.textContent);
}

test('generated Window Web changed event remains transient without Patch change', () => {
  const source = `create text name = ""

window "Hello":
  input name

when name changed:
  show value`;
  const built = buildStandaloneWebApp(source, { name: 'TransientInput', kind: 'window' });
  const runtime = executeWindowHtml(built.html);

  const before = currentInput(runtime.app);
  assert.equal(before.value, '');
  before.value = 'Mia';
  before.dispatch('input');

  // The handler observed Mia, but because it did not execute `change name`,
  // the rerender is still derived from persistent Patch state (empty string).
  assert.equal(currentInput(runtime.app).value, '');
  assert.match(runtime.output.textContent, /Mia/);
});

test('generated Window Web changed event persists only through semantic change', () => {
  const source = `create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value`;
  const built = buildStandaloneWebApp(source, { name: 'PersistentInput', kind: 'window' });
  assert.equal(built.metadata.projectKind, 'window');
  const runtime = executeWindowHtml(built.html);

  const before = currentInput(runtime.app);
  before.value = 'Mia';
  before.dispatch('input');

  assert.equal(currentInput(runtime.app).value, 'Mia');
  assert.ok(visibleTexts(runtime.app).includes('Hello Mia'));
});
