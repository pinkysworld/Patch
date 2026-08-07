import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchInterpreter } from '../src/interpreter.js';
import { changesConflict, composeChanges, invertChange, applySemanticOperations } from '../src/change.js';

function run(src) { return new PatchInterpreter().run(src); }

test('create and show number', () => { assert.deepEqual(run('create number x = 10\nshow x').output, ['10']); });
test('basic change is recorded', () => {
  const r=run('create number score = 0\nchange score:\n  add 1\nshow score');
  assert.equal(r.state.score,1); assert.equal(r.history.length,1); assert.equal(r.history[0].operations[0].op,'addNumber');
});
test('list add and remove', () => {
  const r=run('create list fruits = apple, banana\nchange fruits:\n  add orange\n  remove banana\nshow fruits');
  assert.deepEqual(r.state.fruits,['apple','orange']);
});
test('thing fields change independently', () => {
  const r=run('create thing player:\n  score = 1\n  lives = 3\nchange player:\n  add 2 to score\n  remove 1 from lives');
  assert.deepEqual(r.state.player,{score:3,lives:2}); assert.deepEqual(r.history[0].operations.map(x=>x.field),['score','lives']);
});
test('if and else', () => { assert.deepEqual(run('create number age = 8\nif age < 10:\n  show "child"\nelse:\n  show "older"').output,['child']); });
test('repeat changes state', () => { assert.equal(run('create number x = 0\nrepeat 4:\n  change x:\n    add 2').state.x,8); });
test('undo restores state and redo replays', () => {
  const r=run('create number x = 1\nchange x called bump:\n  add 4\nundo bump\nshow x\nredo\nshow x');
  assert.deepEqual(r.output,['1','5']); assert.equal(r.state.x,5);
});
test('list undo restores removed item at original index', () => {
  const r=run('create list x = a, b, c\nchange x:\n  remove b\nundo\nshow x'); assert.deepEqual(r.state.x,['a','b','c']);
});
test('preview does not commit', () => {
  const r=run('create number x = 3\npreview:\n  change x:\n    add 7\nshow x');
  assert.equal(r.state.x,3); assert.match(r.output[0],/preview x: 3 -> 10/); assert.equal(r.output.at(-1),'3');
});
test('history is visible', () => {
  const r=run('create number x = 0\nchange x:\n  add 1\nchange x:\n  add 2\nhistory x'); assert.match(r.output[0],/c1:/); assert.match(r.output[1],/c2:/);
});
test('watch reports each committed state transition', () => {
  const r=run('create number x = 0\nwatch x\nchange x:\n  add 2'); assert.deepEqual(r.output,['watching x','watch x: 0 -> 2']);
});
test('functions can receive simple values', () => {
  const r=run('make greet(name):\n  show "Hi " + name\ndo greet("Ada")'); assert.deepEqual(r.output,['Hi Ada']);
});
test('all mutations after creation are represented as change records', () => {
  const r=run('create number x = 0\nrepeat 3:\n  change x:\n    add 1'); assert.equal(r.history.length,3); assert.equal(r.state.x,3);
});
test('inverse change returns to prior state', () => {
  const r=run('create number x = 2\nchange x:\n  add 5'); const c=r.history[0]; const inv=invertChange(c); assert.equal(applySemanticOperations(c.after,inv.operations),2);
});
test('consecutive changes compose', () => {
  const r=run('create number x = 0\nchange x:\n  add 1\nchange x:\n  add 2'); const c=composeChanges(r.history[0],r.history[1]); assert.equal(applySemanticOperations(c.before,c.operations),3);
});
test('independent object fields do not conflict from same base', () => {
  const a={target:'p',baseVersion:0,operations:[{op:'set',field:'name',value:'A'}]}; const b={target:'p',baseVersion:0,operations:[{op:'set',field:'score',value:2}]}; assert.equal(changesConflict(a,b),false);
});
test('competing writes to same field conflict', () => {
  const a={target:'p',baseVersion:0,operations:[{op:'set',field:'score',value:1}]}; const b={target:'p',baseVersion:0,operations:[{op:'set',field:'score',value:2}]}; assert.equal(changesConflict(a,b),true);
});
test('numeric additions commute for conflict analysis', () => {
  const a={target:'p',baseVersion:0,operations:[{op:'addNumber',field:'score',value:1}]}; const b={target:'p',baseVersion:0,operations:[{op:'addNumber',field:'score',value:2}]}; assert.equal(changesConflict(a,b),false);
});
test('friendly error for mutation without change', () => { assert.throws(()=>run('create number x = 1\nx = 2'),/Field declarations/); });
test('change cannot target unknown value', () => { assert.throws(()=>run('change missing:\n  add 1'),/does not exist/); });
