import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';

const source = fs.readFileSync('examples/menu-dialog-window.patch', 'utf8');

test('parser records Window menu, menu item and informational dialog action', () => {
  const ast = parse(source);
  const window = ast.find(node => node.kind === 'window');
  const menu = window.body.find(node => node.kind === 'menu');
  assert.ok(menu);
  assert.equal(menu.titleExpr, '"Help"');
  assert.deepEqual(menu.body.map(item => [item.kind, item.id, item.textExpr]), [['menuItem', 'about_item', '"About"']]);
  const event = ast.find(node => node.kind === 'event');
  assert.equal(event.control, 'about_item');
  assert.equal(event.event, 'clicked');
  assert.deepEqual(event.body[0], { kind: 'dialog', titleExpr: '"About Patch"', messageExpr: '"Native menus and informational dialogs"', line: 7 });
});

test('menus require items and dialog requires exactly title and message', () => {
  assert.throws(() => parse('window "Demo":\n  menu "Help":\n'), /Expected an indented block|menu needs at least one item/i);
  assert.throws(() => parse('window "Demo":\n  menu "Help":\n    text "No"\n'), /menu can only contain items/i);
  assert.throws(() => parse('window "Demo":\n  button "About" as about\n\nwhen about clicked:\n  dialog "Only title"\n'), /dialog needs exactly a title and message/i);
});

test('Change IR keeps menu/dialog explicit without changing Change IR 0.10', () => {
  const compiled = compile(source, { name: 'MenuDialogDemo', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.menu'));
  assert.ok(compiled.ir.capabilities.includes('ui.dialog'));
  const window = compiled.ir.instructions.find(item => item.code === 'WINDOW');
  const menu = window.body.find(item => item.code === 'MENU');
  assert.equal(menu.body[0].code, 'MENU_ITEM');
  const event = compiled.ir.instructions.find(item => item.code === 'EVENT');
  assert.equal(event.body[0].code, 'DIALOG');
});

test('Window runtimes fail closed until Menu/Dialog native parity is implemented', () => {
  const compiled = compile(source, { name: 'MenuDialogDemo', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    /about_item.*not defined|event .*about_item.*refers to a control/i
  );
  assert.throws(
    () => buildNativeGuiIR(compiled),
    /about_item.*not defined|event .*about_item.*refers to a control/i
  );
});
