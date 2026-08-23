import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PatchInterpreter } from '../src/interpreter.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

class FakeElement {
  constructor(tag = 'div', id = null) {
    this.tagName = tag;
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.textContent = '';
    this.value = '';
    this.placeholder = '';
    this.className = '';
    this.hidden = false;
    this._innerHTML = '';
    this._paragraph = null;
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
    this._paragraph = this._innerHTML.includes('<p') ? new FakeElement('p') : null;
  }
  get innerHTML() { return this._innerHTML; }
  querySelector(selector) {
    if (selector === 'p') return this._paragraph ??= new FakeElement('p');
    return null;
  }
}

function executeWindowHtml(html) {
  const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'standalone Window HTML should contain one inline runtime script');
  const app = new FakeElement('main', 'app');
  const output = new FakeElement('pre', 'output');
  const document = {
    getElementById(id) { return id === 'app' ? app : id === 'output' ? output : null; },
    createElement(tag) { return new FakeElement(tag); }
  };
  vm.runInNewContext(match[1], { document, structuredClone, console }, { timeout: 1000 });
  return { app, output };
}

function findByTag(root, tag) {
  if (root.tagName === tag) return root;
  for (const child of root.children ?? []) {
    const found = findByTag(child, tag);
    if (found) return found;
  }
  return null;
}

function allText(root) {
  return [root.textContent, ...(root.children ?? []).flatMap(allText)].filter(Boolean);
}

test('Window Web runtime matches interpreter for sequential operations inside one semantic change', () => {
  const source = `create number score = 1

change score:
  add 1
  set = score * 2

window "State check":
  text "Score: {score}"

show score`;

  const expected = new PatchInterpreter().run(source);
  assert.deepEqual(expected.output, ['4']);
  assert.equal(expected.state.score, 4);

  const built = buildStandaloneWebApp(source, { name: 'StateCheck', kind: 'window' });
  const executed = executeWindowHtml(built.html);
  assert.equal(executed.output.textContent, expected.output.join('\n'));
  assert.ok(allText(executed.app).includes('Score: 4'));
});

test('Window Web runtime enforces declared create types like the interpreter', () => {
  const source = `create number score = "wrong"

window "Bad type":
  text "Score: {score}"`;
  assert.throws(() => new PatchInterpreter().run(source), /score must start as a number/);

  const built = buildStandaloneWebApp(source, { name: 'BadType', kind: 'window' });
  const executed = executeWindowHtml(built.html);
  assert.match(executed.app.querySelector('p').textContent, /score must start as a number/);
});

test('Window Web runtime rejects inherited Thing paths and keeps Things prototype-free', () => {
  const source = `create thing player:
  name = "Ada"

change player:
  set name = "Alex"

window "Player":
  text "Name: {player.name}"

show player.name
show player.constructor`;
  assert.throws(() => new PatchInterpreter().run(source), /player\.constructor/);

  const built = buildStandaloneWebApp(source, { name: 'ThingProto', kind: 'window' });
  assert.match(built.html, /Object\.create\(null\)/);
  const executed = executeWindowHtml(built.html);
  assert.match(executed.app.querySelector('p').textContent, /player\.constructor/);
});

test('Window Web runtime compares Things structurally regardless of field insertion order', () => {
  const source = `create thing left:
  name = "Ada"
  score = 1

create thing right:
  score = 1
  name = "Ada"

create list players = []

change players:
  add left

change players:
  remove right

window "Equal":
  text "ready"

show left == right
show players`;

  const expected = new PatchInterpreter().run(source);
  assert.deepEqual(expected.output, ['true', '']);
  assert.deepEqual(expected.state.players, []);

  const built = buildStandaloneWebApp(source, { name: 'ThingEqual', kind: 'window' });
  assert.doesNotMatch(built.html, /JSON\.stringify\(a\)===JSON\.stringify\(b\)/);
  const executed = executeWindowHtml(built.html);
  assert.equal(executed.output.textContent, expected.output.join('\n'));
});

test('Window Web runtime rejects writes to missing thing fields like the interpreter', () => {
  const source = `create thing player:
  score = 1

change player:
  set missing = 2

window "Player":
  text "Score: {player.score}"`;
  assert.throws(() => new PatchInterpreter().run(source), /no field called 'missing'/);

  const built = buildStandaloneWebApp(source, { name: 'MissingField', kind: 'window' });
  const executed = executeWindowHtml(built.html);
  assert.match(executed.app.querySelector('p').textContent, /no field called 'missing'/);
});

test('built Counter Window executes button clicked events and rerenders state', () => {
  const source = `create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1`;

  const built = buildStandaloneWebApp(source, { name: 'Counter', kind: 'window' });
  const executed = executeWindowHtml(built.html);
  assert.ok(allText(executed.app).includes('Count: 0'));
  const button = findByTag(executed.app, 'button');
  assert.ok(button);
  assert.equal(button.listeners.click.length, 1);
  button.listeners.click[0]();
  assert.ok(allText(executed.app).includes('Count: 1'));
});

test('Window builds reject parsed event forms that are not wired consistently across targets', () => {
  const source = `window "Broken":
  button "Bad" as bad

when bad changed:
  show 1`;

  assert.throws(
    () => buildStandaloneWebApp(source, { name: 'BadEventPair', kind: 'window' }),
    /support 'clicked' on buttons\/menu items and 'changed' on inputs\/checkboxes\/combos\/listboxes\/radios/
  );
});

test('Window builds reject event handlers for sources that do not exist', () => {
  const source = `window "Broken":
  text "Hello"

when missing clicked:
  show 1`;

  assert.throws(
    () => buildStandaloneWebApp(source, { name: 'BrokenEvent', kind: 'window' }),
    /refers to a control, menu item or result dialog that is not defined/
  );
});

test('Window builds reject duplicate UI ids before target packaging', () => {
  const source = `window "Duplicate":
  button "One" as action
  button "Two" as action`;

  assert.throws(
    () => buildStandaloneWebApp(source, { name: 'DuplicateIds', kind: 'window' }),
    /UI id 'action' is declared more than once/
  );
});
