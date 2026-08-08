import test from 'node:test';
import assert from 'node:assert/strict';
import { compileToC99, PATCH_C99_VERSION } from '../src/c99.js';

test('C99 backend lowers protected numeric recipes and range guards', () => {
  const source = `create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
show score
`;
  const built = compileToC99(source, { name: 'Reward', kind: 'console' });
  assert.equal(built.metadata.version, PATCH_C99_VERSION);
  assert.match(built.source, /static double patch_state_score = 0\.0;/);
  assert.match(built.source, /static void patch_recipe_reward\(double patch_arg_bonus\)/);
  assert.match(built.source, /patch_arg_bonus < 0\.0 \|\| patch_arg_bonus > 5\.0/);
  assert.match(built.source, /patch_state_score \+= patch_arg_bonus \* 2\.0;/);
  assert.match(built.source, /patch_change_number\(0,/);
  assert.match(built.source, /patch_recipe_reward\(4\.0\);/);
  assert.match(built.source, /patch_show_number\(patch_state_score\);/);
});

test('C99 backend keeps literal arithmetic in double semantics', () => {
  const source = `create number half = 1 / 2
show half
`;
  const built = compileToC99(source, { kind: 'console' });
  assert.match(built.source, /patch_state_half = 1\.0 \/ 2\.0;/);
});

test('C99 backend lowers if and literal repeat with Patch count', () => {
  const source = `create number total = 0
repeat 3:
  if count <= 2:
    change total:
      add count
show total
`;
  const built = compileToC99(source, { kind: 'console' });
  assert.match(built.source, /for \(int patch_count_0 = 1; patch_count_0 <= 3; \+\+patch_count_0\)/);
  assert.match(built.source, /if \(patch_count_0 <= 2\.0\)/);
  assert.match(built.source, /patch_state_total \+= patch_count_0;/);
});

test('C99 backend conservatively rejects constructs outside direct numeric subset', () => {
  const source = `create text greeting = "hello"
show greeting
`;
  assert.throws(() => compileToC99(source, { kind: 'console' }), /direct numeric Wasm subset|only numeric create/i);
});
