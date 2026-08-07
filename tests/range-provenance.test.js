import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { inferNumericRange } from '../src/range-analysis.js';

test('interval analysis handles arithmetic over declared ranges', () => {
  assert.deepEqual(inferNumericRange('bonus * 2 + 1', { bonus: { min: 0, max: 5 } }), { min: 1, max: 11 });
});

test('bounded recipe parameter proves a dynamic change capability', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..10):\n  change player:\n    add bonus to score`;
  const { ir } = compile(source);
  const effect = ir.changeSignatures.reward.changes[0];
  assert.equal(effect.operation, 'increase');
  assert.deepEqual(effect.amountRange, { min: 0, max: 10 });
  assert.equal(effect.rangeProven, true);
  assert.ok(ir.capabilities.includes('change.range-analysis'));
});

test('range arithmetic is checked against capability maximum', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..5):\n  change player:\n    add bonus * 2 to score`;
  assert.doesNotThrow(() => compile(source));
});

test('range arithmetic rejects a possible capability overflow', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..6):\n  change player:\n    add bonus * 2 to score`;
  assert.throws(() => compile(source), /up to 12, above the allowed maximum of 10/);
});

test('runtime enforces ranged recipe parameters', () => {
  const source = `make reward(bonus number 0..10):\n  show bonus\n\ndo reward(11)`;
  assert.throws(() => new PatchInterpreter().run(source), /expects 'bonus' to be a number from 0 to 10/);
});

test('why target explains recipe provenance', () => {
  const source = `create number score = 0\n\nmake reward():\n  change score:\n    add 5\n\ndo reward()\nwhy score`;
  const result = new PatchInterpreter().run(source);
  assert.match(result.output.join('\n'), /why score: 1 committed change/);
  assert.match(result.output.join('\n'), /because recipe reward/);
});

test('why condition finds the change that first made it true', () => {
  const source = `create number score = 0\nchange score:\n  add 5\nchange score:\n  add 10\nwhy score > 10`;
  const result = new PatchInterpreter().run(source);
  assert.match(result.output.at(-1), /c2 made it true/);
  assert.match(result.output.at(-1), /5 -> 15/);
});

test('GUI event provenance records event and recipe causes', () => {
  const source = `create number score = 0\nwindow "Game":\n  button "Bonus" as bonus\n\nmake reward():\n  change score:\n    add 5\n\nwhen bonus clicked:\n  do reward()`;
  const runtime = new PatchInterpreter();
  runtime.run(source);
  const result = runtime.trigger('bonus');
  assert.deepEqual(result.history[0].cause.map(c => c.kind), ['event', 'recipe']);
});
