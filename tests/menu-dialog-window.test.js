import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildNativeGuiIR, flattenNativeGuiMenuItems } from '../src/native-gui-ir.js';
import { encodeNativeGuiPayload, PATCH_SEALED_NATIVE_GUI_VERSION } from '../src/sealed-native-gui.js';

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

test('Window validation registers menu item ids and permits clicked -> dialog only', () => {
  const compiled = compile(source, { name: 'MenuDialogDemo', kind: 'window' });
  const summary = validateWindowRuntimeSupport(compiled);
  assert.equal(summary.menuItems, 1);
  assert.equal(summary.events, 1);
  const invalid = compile('window "Demo":\n  menu "Help":\n    item "About" as about_item\n\nwhen about_item changed:\n  dialog "About", "No"\n', { kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(invalid), /does not support 'changed' on menuItem/);
});

test('Native GUI IR v0.6 stores menus outside geometric controls and lowers dialog action', () => {
  const ir = buildNativeGuiIR(compile(source, { name: 'MenuDialogDemo', kind: 'window' }));
  assert.equal(ir.version, '0.6');
  assert.equal(ir.forms.length, 1);
  assert.equal(ir.forms[0].controls.length, 1);
  assert.deepEqual(ir.forms[0].menus, [{ title: 'Help', items: [{ type: 'menuItem', id: 'about_item', text: 'About' }] }]);
  const items = flattenNativeGuiMenuItems(ir);
  assert.deepEqual(items.map(item => [item.id, item.menuTitle, item.formIndex]), [['about_item', 'Help', 0]]);
  assert.deepEqual(ir.events, [{
    control: 'about_item', event: 'clicked', valueType: null, form: 'main', actions: [{ kind: 'dialog', form: 'main', title: 'About Patch', message: 'Native menus and informational dialogs' }]
  }]);
});

test('sealed native GUI payload v6 carries menu/item/dialog text without Patch source', () => {
  const ir = buildNativeGuiIR(compile(source, { name: 'MenuDialogDemo', kind: 'window' }));
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 6);
  const payload = encodeNativeGuiPayload(ir);
  const text = new TextDecoder().decode(payload);
  for (const marker of ['Help', 'about_item', 'About', 'About Patch', 'Native menus and informational dialogs']) assert.match(text, new RegExp(marker));
  assert.doesNotMatch(text, /when about_item clicked/);
});
