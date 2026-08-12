import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildNativeGuiIR, flattenNativeGuiMenuItems } from '../src/native-gui-ir.js';
import { encodeNativeGuiPayload, PATCH_SEALED_NATIVE_GUI_VERSION } from '../src/sealed-native-gui.js';
import { emitWin32GuiCpp } from '../src/win32-gui.js';
import { emitAppKitGuiObjCpp } from '../src/appkit-gui.js';
import { emitGtkGuiCpp } from '../src/gtk-gui.js';

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

test('Window validation and Native GUI IR 0.7 model Menu/Dialog parity explicitly', () => {
  const compiled = compile(source, { name: 'MenuDialogDemo', kind: 'window' });
  const support = validateWindowRuntimeSupport(compiled);
  assert.equal(support.menuItems, 1);
  const ir = buildNativeGuiIR(compiled);
  assert.equal(ir.version, '0.7');
  assert.deepEqual(ir.forms[0].menus, [{ title: 'Help', items: [{ type: 'menuItem', id: 'about_item', text: 'About' }] }]);
  assert.deepEqual(flattenNativeGuiMenuItems(ir).map(item => [item.id, item.formIndex, item.menuIndex, item.itemIndex]), [['about_item', 0, 0, 0]]);
  assert.deepEqual(ir.events, [{
    control: 'about_item',
    event: 'clicked',
    valueType: null,
    form: 'main',
    actions: [{ kind: 'dialog', form: 'main', title: 'About Patch', message: 'Native menus and informational dialogs' }]
  }]);
});

test('sealed native payload v7 includes menu/dialog strings', () => {
  const ir = buildNativeGuiIR(compile(source, { name: 'MenuDialogDemo', kind: 'window' }));
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 7);
  const payload = encodeNativeGuiPayload(ir);
  const text = new TextDecoder().decode(payload);
  for (const marker of ['Help', 'about_item', 'About', 'About Patch', 'Native menus and informational dialogs']) assert.ok(text.includes(marker));
});

test('all direct native emitters use real platform Menu/Dialog primitives', () => {
  const ir = buildNativeGuiIR(compile(source, { name: 'MenuDialogDemo', kind: 'window' }));
  const win = emitWin32GuiCpp(ir);
  for (const marker of ['CreateMenu', 'CreatePopupMenu', 'AppendMenuW', 'SetMenu', 'WM_COMMAND', 'MessageBoxW']) assert.ok(win.includes(marker));
  const mac = emitAppKitGuiObjCpp(ir);
  for (const marker of ['NSMenu', 'NSMenuItem', 'setMainMenu', 'sendAction', 'NSAlert']) assert.ok(mac.includes(marker));
  const gtk = emitGtkGuiCpp(ir);
  for (const marker of ['gtk_menu_bar_new', 'gtk_menu_item_new_with_label', '"activate"', 'gtk_message_dialog_new', 'gtk_dialog_run']) assert.ok(gtk.includes(marker));
});
