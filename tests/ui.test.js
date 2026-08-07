import test from 'node:test';
import assert from 'node:assert/strict';
import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';

const counter = `create number count = 0

window "Counter":
  text "Count: {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1`;

test('window application compiles with UI capability', () => {
  const { ir } = compile(counter, { name: 'Counter', kind: 'window' });
  assert.equal(ir.project.kind, 'window');
  assert.ok(ir.capabilities.includes('ui.window'));
  assert.equal(ir.instructions[1].code, 'WINDOW');
  assert.equal(ir.instructions[2].code, 'EVENT');
});

test('interpreter exposes virtual window model', () => {
  const runtime = new PatchInterpreter();
  const result = runtime.run(counter);
  assert.equal(result.ui.length, 1);
  assert.equal(result.ui[0].title, 'Counter');
  assert.equal(result.ui[0].controls[0].text, 'Count: 0');
  assert.equal(result.ui[0].controls[1].id, 'add_button');
});

test('button event changes state and rerenders bound text', () => {
  const runtime = new PatchInterpreter();
  runtime.run(counter);
  const result = runtime.trigger('add_button', 'clicked');
  assert.equal(result.state.count, 1);
  assert.equal(result.ui[0].controls[0].text, 'Count: 1');
  assert.equal(result.history.length, 1);
});
