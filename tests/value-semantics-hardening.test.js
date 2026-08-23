import test from 'node:test';
import assert from 'node:assert/strict';
import { deepEqual, lookupPath, ExpressionError } from '../src/expression.js';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { PatchInterpreter } from '../src/interpreter.js';

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

test('list remove and preview reuse the same structural equality contract', () => {
  const runtime = new PatchInterpreter();
  const removed = runtime.run('create list values = [[1, 2], [3, 4]]\nchange values:\n  remove [1, 2]\nshow values\n');
  assert.deepEqual(removed.state.values, [[3, 4]]);

  const preview = runtime.run('create number value = 0 / 0\npreview:\n  change value:\n    set = 0 / 0\n', { reset: true });
  assert.ok(preview.output.includes('preview no changes'));
});
