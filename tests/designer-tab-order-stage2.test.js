import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { listDesignerControls } from '../src/designer.js';
import {
  buildWindowLayoutPolicyManifest,
  readWindowLayoutPolicy,
  readWindowTabOrder,
  resolveWindowTabOrders,
  setWindowTabOrder
} from '../src/window-layout-policy.js';
import {
  clearDesignerTabOrder,
  listDesignerTabOrder,
  reorderDesignerTabOrder,
  setDesignerLayoutPolicy
} from '../web/designer-layout-policy.js';
import { reorderDesignerControl } from '../web/designer-z-order-model.js';

test('TabOrder and responsive layout metadata can coexist before one control', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @layout anchor left right top\n  # @taborder 2\n  input name at 24, 24 size 220, 36\n  button "Save" as save at 24, 76 size 120, 36\n`;
  const controls = listDesignerControls(source);
  assert.equal(readWindowTabOrder(source, controls[0].line), 2);
  assert.deepEqual(readWindowLayoutPolicy(source, controls[0].line), { kind: 'anchor', edges: ['left', 'right', 'top'] });

  const changedLayout = setDesignerLayoutPolicy(source, controls[0].line, { kind: 'dock', side: 'top' });
  const changedControl = listDesignerControls(changedLayout)[0];
  assert.equal(readWindowTabOrder(changedLayout, changedControl.line), 2);
  assert.deepEqual(readWindowLayoutPolicy(changedLayout, changedControl.line), { kind: 'dock', side: 'top' });

  const changedTabOrder = setWindowTabOrder(changedLayout, changedControl.line, 5);
  const finalControl = listDesignerControls(changedTabOrder)[0];
  assert.equal(readWindowTabOrder(changedTabOrder, finalControl.line), 5);
  assert.deepEqual(readWindowLayoutPolicy(changedTabOrder, finalControl.line), { kind: 'dock', side: 'top' });
});

test('independent TabOrder reorder leaves visible control source order and z-order unchanged', () => {
  const source = `window "Demo" as main size 640, 420:\n  input first at 24, 24 size 200, 36\n  text "Decoration" at 24, 70 size 180, 30\n  button "Second" as second at 24, 112 size 120, 36\n  input third at 24, 164 size 200, 36\n`;
  const beforeDeclarations = listDesignerControls(source).map(control => control.id ?? control.textExpr);
  const second = listDesignerTabOrder(source, 0).find(control => control.id === 'second');
  const result = reorderDesignerTabOrder(source, second, 'earlier');
  assert.equal(result.moved, true);
  assert.deepEqual(listDesignerControls(result.source).map(control => control.id ?? control.textExpr), beforeDeclarations);
  assert.deepEqual(listDesignerTabOrder(result.source, 0).map(control => control.id), ['second', 'first', 'third']);
  assert.match(result.source, /# @taborder 0\n  button "Second" as second/);
  assert.match(result.source, /# @taborder 1\n  input first/);
});

test('reset removes explicit TabOrder metadata and restores source-derived focus order', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @taborder 1\n  input first at 24, 24 size 200, 36\n  # @taborder 0\n  button "Second" as second at 24, 76 size 120, 36\n`;
  assert.deepEqual(listDesignerTabOrder(source, 0).map(control => control.id), ['second', 'first']);
  const reset = clearDesignerTabOrder(source, 0);
  assert.doesNotMatch(reset, /@taborder/);
  assert.deepEqual(listDesignerTabOrder(reset, 0).map(control => control.id), ['first', 'second']);
});

test('compiler layout manifest validates duplicate TabOrder and attaches valid metadata to AST controls', () => {
  const valid = `window "Demo" as main size 640, 420:\n  # @taborder 1\n  input first at 24, 24 size 200, 36\n  # @taborder 0\n  button "Second" as second at 24, 76 size 120, 36\n`;
  const compiled = compile(valid);
  assert.equal(compiled.windowLayoutPolicy.windows[0].controls[0].tabOrder, 1);
  assert.equal(compiled.windowLayoutPolicy.windows[0].controls[1].tabOrder, 0);
  assert.equal(compiled.ast[0].body[0].tabOrder, 1);
  assert.equal(compiled.ast[0].body[1].tabOrder, 0);

  const duplicate = `window "Demo" as main size 640, 420:\n  # @taborder 0\n  input first at 24, 24 size 200, 36\n  # @taborder 0\n  button "Second" as second at 24, 76 size 120, 36\n`;
  assert.throws(() => compile(duplicate), /TabOrder 0 is duplicated/i);
});

test('z-order moves stacked layout and TabOrder directives with their control', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @layout anchor left top\n  # @taborder 1\n  button "Back" as back at 24, 24 size 120, 36\n  # @taborder 0\n  button "Front" as front at 24, 76 size 120, 36\n`;
  const moved = reorderDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, 'front');
  assert.equal(moved.moved, true);
  assert.match(moved.source, /# @taborder 0\n  button "Front" as front[\s\S]*# @layout anchor left top\n  # @taborder 1\n  button "Back" as back/);
  const back = listDesignerControls(moved.source).find(control => control.id === 'back');
  assert.deepEqual(readWindowLayoutPolicy(moved.source, back.line), { kind: 'anchor', edges: ['left', 'top'] });
  assert.equal(readWindowTabOrder(moved.source, back.line), 1);
});

test('TabOrder Stage 2 Studio surface is packaged through existing responsive layout module', () => {
  const policy = fs.readFileSync('web/designer-layout-policy.js', 'utf8');
  const responsive = fs.readFileSync('web/designer-responsive-layout.js', 'utf8');
  assert.match(policy, /Tab Order · Stage 2/);
  assert.match(policy, /# @taborder N/);
  assert.match(policy, /does not move controls in source or change z-order/);
  assert.match(policy, /Ctrl\/Cmd\+↑\/↓ changes TabOrder/);
  assert.match(policy, /reorderDesignerTabOrder/);
  assert.match(policy, /clearDesignerTabOrder/);
  assert.match(responsive, /from '\.\/designer-layout-policy\.js'/);
});

test('effective TabOrder fills unspecified slots deterministically around explicit values', () => {
  const source = `window "Demo" as main size 640, 420:\n  input first at 24, 24 size 200, 36\n  # @taborder 0\n  button "Pinned" as pinned at 24, 76 size 120, 36\n  input third at 24, 128 size 200, 36\n`;
  const controls = listDesignerControls(source).filter(control => control.id);
  const order = resolveWindowTabOrders(source, controls);
  assert.deepEqual(order.map(control => [control.id, control.tabOrder]), [['pinned', 0], ['first', 1], ['third', 2]]);
  const manifest = buildWindowLayoutPolicyManifest(source, compile(source).ast);
  assert.equal(manifest.windows[0].controls[1].tabOrder, 0);
});
