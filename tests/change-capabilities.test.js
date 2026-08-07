import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { ChangeCapabilityError } from '../src/change-analysis.js';

test('compiler infers a semantic change signature for a recipe', () => {
  const source = `make reward(player):\n  change player:\n    add 5 to score`;
  const { ir } = compile(source);
  const [effect] = ir.changeSignatures.reward.changes;
  assert.equal(effect.path, 'player.score');
  assert.equal(effect.operation, 'increase');
  assert.equal(effect.amount, 5);
  assert.equal(effect.staticAmount, true);
});

test('allow accepts an increase within its declared maximum', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score`;
  const { ir } = compile(source);
  assert.equal(ir.changeCapabilities.reward[0].operation, 'increase');
  assert.equal(ir.changeCapabilities.reward[0].maxAmount, 10);
  assert.ok(ir.capabilities.includes('change.capabilities'));
});

test('allow rejects a semantic operation that is not permitted', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    set score = 999`;
  assert.throws(() => compile(source), err => {
    assert.ok(err instanceof ChangeCapabilityError);
    assert.match(err.message, /does not permit/i);
    return true;
  });
});

test('allow rejects an increase above a declared maximum', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 25 to score`;
  assert.throws(() => compile(source), /above the allowed maximum of 10/);
});

test('bounded capability rejects a dynamic amount it cannot prove', () => {
  const source = `allow reward:\n  player.score may add up to 10\n\nmake reward(player, bonus):\n  change player:\n    add bonus to score`;
  assert.throws(() => compile(source), /cannot prove it stays within the allowed maximum of 10/);
});

test('transitive recipe effects are substituted and checked', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake add_points(target):\n  change target:\n    add 5 to score\n\nmake reward(player):\n  do add_points(player)`;
  const { ir } = compile(source);
  const [effect] = ir.changeSignatures.reward.changes;
  assert.equal(effect.path, 'player.score');
  assert.equal(effect.via, 'add_points');
});

test('interpreter treats allow declarations as compile-time policy', () => {
  const source = `create thing player:\n  score = 0\n\nallow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score\n\ndo reward(player)\nshow player.score`;
  compile(source);
  const result = new PatchInterpreter().run(source);
  assert.equal(result.output.at(-1), '5');
  assert.equal(result.state.player.score, 5);
});
