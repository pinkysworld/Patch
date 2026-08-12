import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { compile, PATCH_IR_VERSION } from '../src/compiler.js';
import { validateWindowRuntimeSupport, WindowBuildError } from '../src/window-build.js';

const example = fs.readFileSync(new URL('../examples/result-dialog-window.patch', import.meta.url), 'utf8');

function findNodes(nodes, kind, out = []) {
  for (const node of nodes ?? []) {
    if (node.kind === kind) out.push(node);
    if (node.body) findNodes(node.body, kind, out);
    if (node.thenBody) findNodes(node.thenBody, kind, out);
    if (node.elseBody) findNodes(node.elseBody, kind, out);
  }
  return out;
}

function findOps(nodes, code, out = []) {
  for (const node of nodes ?? []) {
    if (node.code === code) out.push(node);
    if (node.body) findOps(node.body, code, out);
    if (node.then) findOps(node.then, code, out);
    if (node.else) findOps(node.else, code, out);
  }
  return out;
}

test('parser records confirm/open/save result dialogs and their synthetic events', () => {
  const ast = parse(example);
  assert.deepEqual(findNodes(ast, 'confirmDialog').map(node => node.id), ['reset_confirm']);
  assert.deepEqual(findNodes(ast, 'openFileDialog').map(node => node.id), ['open_result']);
  assert.deepEqual(findNodes(ast, 'saveFileDialog').map(node => node.id), ['save_result']);

  const events = findNodes(ast, 'event').map(node => `${node.control}:${node.event}`);
  for (const expected of [
    'reset_confirm:confirmed', 'reset_confirm:cancelled',
    'open_result:chosen', 'open_result:cancelled',
    'save_result:chosen', 'save_result:cancelled'
  ]) assert.ok(events.includes(expected), `missing ${expected}`);
});

test('open file remains distinct from named Form navigation', () => {
  const ast = parse(`window "Main" as main:\n  button "Go" as go\nwhen go clicked:\n  open file "Open" as picker\n  open main`);
  const event = findNodes(ast, 'event')[0];
  assert.equal(event.body[0].kind, 'openFileDialog');
  assert.equal(event.body[0].id, 'picker');
  assert.equal(event.body[1].kind, 'openForm');
  assert.equal(event.body[1].form, 'main');
});

test('confirm requires exactly title and message before its result id', () => {
  assert.throws(
    () => parse(`window "Main":\n  button "Go" as go\nwhen go clicked:\n  confirm "Only title" as answer`),
    error => error instanceof PatchSyntaxError && /needs exactly a title and message/.test(error.message)
  );
});

test('Change IR 0.10 keeps result dialog actions explicit without hidden state', () => {
  const compiled = compile(example, { kind: 'window' });
  assert.equal(PATCH_IR_VERSION, '0.10');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(findOps(compiled.ir.instructions, 'CONFIRM_DIALOG').length, 1);
  assert.equal(findOps(compiled.ir.instructions, 'OPEN_FILE_DIALOG').length, 1);
  assert.equal(findOps(compiled.ir.instructions, 'SAVE_FILE_DIALOG').length, 1);
  assert.ok(compiled.ir.capabilities.includes('ui.dialog-result'));
  assert.ok(compiled.ir.capabilities.includes('ui.confirm-dialog'));
  assert.ok(compiled.ir.capabilities.includes('ui.file-dialog'));
  assert.equal(compiled.ast.filter(node => node.kind === 'create').length, 1, 'result sources must not create hidden Patch state');
});

test('Window validation accepts only the result events each dialog can actually produce', () => {
  const compiled = compile(example, { kind: 'window' });
  const summary = validateWindowRuntimeSupport(compiled);
  assert.equal(summary.resultDialogs, 3);
  assert.equal(summary.events, 9);

  const wrongConfirm = compile(`window "Main":\n  button "Ask" as ask\nwhen ask clicked:\n  confirm "Question", "Continue?" as answer\nwhen answer chosen:\n  show value`, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(wrongConfirm),
    error => error instanceof WindowBuildError && /supports 'confirmed' or 'cancelled'/.test(error.message)
  );

  const wrongFile = compile(`window "Main":\n  button "Open" as open_button\nwhen open_button clicked:\n  open file "Open" as picker\nwhen picker confirmed:\n  show 1`, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(wrongFile),
    error => error instanceof WindowBuildError && /supports 'chosen' or 'cancelled'/.test(error.message)
  );
});

test('result dialog ids share the application UI source namespace', () => {
  const compiled = compile(`window "Main":\n  button "Ask" as answer\nwhen answer clicked:\n  confirm "Question", "Continue?" as answer\nwhen answer confirmed:\n  show 1`, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    error => error instanceof WindowBuildError && /declared more than once/.test(error.message)
  );
});
