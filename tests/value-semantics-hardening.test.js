import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deepEqual, lookupPath, ExpressionError } from '../src/expression.js';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { applySemanticOperations, clone } from '../src/change.js';

test('Patch structural equality is independent of object key insertion order', () => {
  assert.equal(deepEqual({ name: 'Ada', stats: { score: 3, lives: 2 } }, { stats: { lives: 2, score: 3 }, name: 'Ada' }), true);
  assert.equal(deepEqual([1, { x: 2 }], [1, { x: 2 }]), true);
  assert.equal(deepEqual([1, 2], [2, 1]), false);
});

test('Patch structural equality handles NaN and distinguishes missing fields', () => {
  assert.equal(deepEqual(Number.NaN, Number.NaN), true);
  assert.equal(deepEqual(0, -0), true);
  assert.equal(deepEqual({ value: undefined }, {}), false);
});

test('expression paths never walk inherited object properties', () => {
  const inherited = Object.create({ constructor: 'not-patch-state' });
  inherited.safe = 1;
  const state = new Map([['thing', inherited]]);
  assert.equal(lookupPath({ state, locals: {} }, ['thing', 'safe']), 1);
  assert.throws(() => lookupPath({ state, locals: {} }, ['thing', 'constructor']), ExpressionError);
});

test('parser rejects prototype-meta names wherever a Thing field can be declared or changed', () => {
  for (const name of ['__proto__', 'prototype', 'constructor']) {
    assert.throws(() => parse(`create thing record:\n  ${name} = 1\n`), error => error instanceof PatchSyntaxError && error.message.includes(name));
    assert.throws(() => parse(`create thing record:\n  safe = 1\nchange record:\n  set ${name} = 2\n`), error => error instanceof PatchSyntaxError && error.message.includes(name));
    assert.throws(() => parse(`allow edit:\n  record.${name} may set\n`), error => error instanceof PatchSyntaxError && error.message.includes(name));
  }
});

test('Things start without an Object prototype and remain source-readable', () => {
  const runtime = new PatchInterpreter();
  const result = runtime.run('create thing player:\n  name = "Ada"\n  score = 1\nshow player.name\n');
  assert.equal(Object.getPrototypeOf(runtime.state.get('player')), null);
  assert.deepEqual(result.output, ['Ada']);
});

test('clone preserves a true null prototype on Thing records', () => {
  const thing = Object.create(null);
  thing.name = 'Ada';
  thing.nested = Object.create(null);
  thing.nested.score = 1;
  const copied = clone(thing);
  assert.notEqual(copied, thing);
  assert.equal(Object.getPrototypeOf(copied), null);
  assert.equal(Object.getPrototypeOf(copied.nested), null);
  assert.equal(copied.name, 'Ada');
  assert.equal(copied.nested.score, 1);
  assert.equal(Object.getPrototypeOf(clone({ op: 'set', field: 'score', value: 1 })), Object.prototype);
  assert.deepEqual(clone([1, { x: 2 }]), [1, { x: 2 }]);
});

test('applySemanticOperations keeps Thing records prototype-free', () => {
  const before = Object.create(null);
  before.name = 'Ada';
  before.score = 1;
  const after = applySemanticOperations(before, [{ op: 'set', field: 'score', value: 2 }]);
  assert.equal(Object.getPrototypeOf(after), null);
  assert.equal(after.score, 2);
  assert.equal(after.name, 'Ada');
  assert.equal(Object.getPrototypeOf(before), null);

  const clearedField = applySemanticOperations(after, [{ op: 'clear', field: 'score' }]);
  assert.equal(Object.getPrototypeOf(clearedField), null);
  assert.equal(clearedField.score, 0);

  const cleared = applySemanticOperations(after, [{ op: 'clear' }]);
  assert.equal(Object.getPrototypeOf(cleared), null);
  assert.deepEqual(Object.keys(cleared), []);
});

test('Things keep a null prototype after field change, clear and undo', () => {
  const runtime = new PatchInterpreter();
  runtime.run('create thing player:\n  name = "Ada"\n  score = 1\nchange player:\n  set score = 2\n');
  assert.equal(Object.getPrototypeOf(runtime.state.get('player')), null);
  assert.equal(runtime.state.get('player').score, 2);
  assert.equal(runtime.state.get('player').constructor, undefined);

  runtime.run('change player:\n  clear score\n', { reset: false });
  assert.equal(Object.getPrototypeOf(runtime.state.get('player')), null);
  assert.equal(runtime.state.get('player').score, 0);

  runtime.run('undo\n', { reset: false });
  assert.equal(Object.getPrototypeOf(runtime.state.get('player')), null);
  assert.equal(runtime.state.get('player').score, 2);

  runtime.run('change player:\n  clear\n', { reset: false });
  assert.equal(Object.getPrototypeOf(runtime.state.get('player')), null);
  assert.deepEqual(Object.keys(runtime.state.get('player')), []);
});

test('list remove and preview reuse the same structural equality contract', () => {
  const runtime = new PatchInterpreter();
  const removed = runtime.run('create list values = [[1, 2], [3, 4]]\nchange values:\n  remove [1, 2]\nshow values\n');
  assert.deepEqual(removed.state.values, [[3, 4]]);

  const preview = runtime.run('create number value = 0 / 0\npreview:\n  change value:\n    set = 0 / 0\n', { reset: true });
  assert.ok(preview.output.includes('preview no changes'));
});

test('standalone Window Web runtime uses structural equality, not JSON serialization', () => {
  const source = fs.readFileSync(new URL('../src/window-webapp.js', import.meta.url), 'utf8');
  assert.match(source, /Object\.keys\(a\)\.sort\(\)/);
  assert.match(source, /Number\.isNaN\(a\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(a\)===JSON\.stringify\(b\)/);
});

test('Window event-local values reuse the prototype-preserving semantic clone', () => {
  const source = fs.readFileSync(new URL('../src/window-events.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ clone \} from '\.\/change\.js'/);
  assert.match(source, /value: clone\(payload\.value\)/);
  assert.doesNotMatch(source, /structuredClone\(payload\.value\)/);
});

test('change-analysis clones signatures with the prototype-preserving semantic clone', () => {
  const source = fs.readFileSync(new URL('../src/change-analysis.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ clone \} from '\.\/change\.js'/);
  assert.doesNotMatch(source, /JSON\.parse\(JSON\.stringify\(value\)\)/);
});
