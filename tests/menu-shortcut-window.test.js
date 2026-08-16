import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import {
  parseMenuShortcut,
  parseMenuShortcutExpression,
  menuShortcutPlatformDisplay
} from '../src/menu-shortcut.js';
import {
  buildNativeGuiIRV09,
  validateNativeGuiIRV09,
  flattenNativeGuiMenuItemsV09
} from '../src/native-gui-ir-v09.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import { emitWin32GuiCppV10 } from '../src/win32-gui-v10.js';
import { emitAppKitGuiObjCppV10 } from '../src/appkit-gui-v10.js';
import { emitGtkGuiCppV10 } from '../src/gtk-gui-v10.js';

const source = fs.readFileSync('examples/menu-shortcut-window.patch', 'utf8');

test('parser records menu separators and portable shortcut expressions', () => {
  const ast = parse(source);
  const window = ast.find(node => node.kind === 'window');
  const menu = window.body.find(node => node.kind === 'menu');
  assert.deepEqual(menu.body.map(entry => entry.kind), ['menuItem', 'menuSeparator', 'menuItem']);
  assert.equal(menu.body[0].id, 'guide_item');
  assert.equal(menu.body[0].shortcutExpr, '"Primary+G"');
  assert.equal(menu.body[2].id, 'about_item');
  assert.equal(menu.body[2].shortcutExpr, '"F1"');
});

test('parser rejects malformed separator placement', () => {
  assert.throws(
    () => parse('window "Bad":\n  menu "File":\n    separator\n    item "Open" as open_item\n'),
    /separator must appear between clickable items/i
  );
  assert.throws(
    () => parse('window "Bad":\n  menu "File":\n    item "Open" as open_item\n    separator\n'),
    /separator must appear between clickable items/i
  );
  assert.throws(
    () => parse('window "Bad":\n  menu "File":\n    item "Open" as open_item\n    separator\n    separator\n    item "Save" as save_item\n'),
    /separators cannot appear next to each other/i
  );
});

test('portable menu shortcut grammar is canonical and platform-aware', () => {
  assert.deepEqual(parseMenuShortcut('Primary+Shift+S'), {
    primary: true,
    shift: true,
    alt: false,
    key: 'S',
    display: 'Primary+Shift+S'
  });
  assert.equal(parseMenuShortcutExpression('"F12"').display, 'F12');
  assert.equal(menuShortcutPlatformDisplay(parseMenuShortcut('Primary+Alt+G'), 'win32'), 'Ctrl+Alt+G');
  assert.equal(menuShortcutPlatformDisplay(parseMenuShortcut('Primary+Alt+G'), 'appkit'), 'Command+Option+G');
  assert.throws(() => parseMenuShortcut('Ctrl+S'), /Unsupported menu shortcut part 'Ctrl'/);
  assert.throws(() => parseMenuShortcut('Primary+S+Q'), /exactly one key/i);
  assert.throws(() => parseMenuShortcut('Shift+Shift+S'), /repeats the 'Shift'/i);
});

test('Change IR 0.10 keeps menu separator and shortcut structure explicit', () => {
  const compiled = compile(source, { name: 'MenuShortcutDemo', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.menu-separator'));
  assert.ok(compiled.ir.capabilities.includes('ui.menu-shortcut'));
  const window = compiled.ir.instructions.find(item => item.code === 'WINDOW');
  const menu = window.body.find(item => item.code === 'MENU');
  assert.deepEqual(menu.body.map(item => item.code), ['MENU_ITEM', 'MENU_SEPARATOR', 'MENU_ITEM']);
  assert.equal(menu.body[0].shortcutExpr, '"Primary+G"');
});

test('shared runtime preflight fails closed unless Native GUI 1.0 is explicitly selected', () => {
  const compiled = compile(source, { name: 'MenuShortcutDemo', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    /Native GUI IR 0\.9 \/ direct AOT backend 1\.0/i
  );
  const support = validateWindowRuntimeSupport(compiled, { allowMenuDecorations: true });
  assert.equal(support.menuItems, 2);
  assert.equal(support.menuSeparators, 1);
  assert.equal(support.menuShortcuts, 2);
});

test('menu shortcuts are unique across the whole application', () => {
  const duplicate = compile(`window "One" as one:\n  menu "File":\n    item "Save" as save_one shortcut "Primary+S"\n\nwindow "Two" as two:\n  menu "File":\n    item "Save" as save_two shortcut "Primary+S"\n`, { name: 'DuplicateShortcuts', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(duplicate, { allowMenuDecorations: true }),
    /already used by 'save_one' in this application/i
  );
});

test('Native GUI IR 0.9 preserves Table-capable 0.8 structure plus menu decorations', () => {
  const compiled = compile(source, { name: 'MenuShortcutDemo', kind: 'window' });
  const ir = buildNativeGuiIRV09(compiled);
  assert.equal(ir.version, '0.9');
  assert.deepEqual(ir.forms[0].menus[0].items, [
    {
      type: 'menuItem',
      id: 'guide_item',
      text: 'Guide',
      shortcut: { primary: true, shift: false, alt: false, key: 'G', display: 'Primary+G' }
    },
    { type: 'menuSeparator' },
    {
      type: 'menuItem',
      id: 'about_item',
      text: 'About',
      shortcut: { primary: false, shift: false, alt: false, key: 'F1', display: 'F1' }
    }
  ]);
  assert.deepEqual(flattenNativeGuiMenuItemsV09(ir).map(item => item.id), ['guide_item', 'about_item']);
  assert.equal(validateNativeGuiIRV09(ir), ir);
});

test('Native GUI build plan selects backend 1.0 automatically for decorated menus', () => {
  const compiled = compile(source, { name: 'MenuShortcutDemo', kind: 'window' });
  const plan = buildNativeGuiPlan(compiled);
  assert.equal(plan.tier, 'menu-v10');
  assert.equal(plan.gui.version, '0.9');
  assert.equal(plan.features.menuSeparators, true);
  assert.equal(plan.features.menuShortcuts, true);
});

test('Win32 backend 1.0 emits native separators and ACCEL dispatch', () => {
  const ir = buildNativeGuiIRV09(compile(source, { name: 'MenuShortcutDemo', kind: 'window' }));
  const cpp = emitWin32GuiCppV10(ir);
  for (const marker of [
    'backend 1.0', 'MF_SEPARATOR', 'CreateAcceleratorTableW', 'TranslateAcceleratorW',
    'FCONTROL', "'G'", 'VK_F1', 'Guide\\tCtrl+G'
  ]) assert.ok(cpp.includes(marker), marker);
  assert.equal(cpp.includes('__patch_v09_separator_'), false);
});

test('AppKit backend 1.0 emits NSMenu separator and key equivalents', () => {
  const ir = buildNativeGuiIRV09(compile(source, { name: 'MenuShortcutDemo', kind: 'window' }));
  const cpp = emitAppKitGuiObjCppV10(ir);
  for (const marker of [
    'backend 1.0', '[NSMenuItem separatorItem]', 'keyEquivalent:@"g"',
    'NSEventModifierFlagCommand', 'NSF1FunctionKey'
  ]) assert.ok(cpp.includes(marker), marker);
  assert.equal(cpp.includes('__patch_v09_separator_'), false);
});

test('GTK backend 1.0 emits GtkSeparatorMenuItem and accelerator group', () => {
  const ir = buildNativeGuiIRV09(compile(source, { name: 'MenuShortcutDemo', kind: 'window' }));
  const cpp = emitGtkGuiCppV10(ir);
  for (const marker of [
    'backend 1.0', 'gtk_separator_menu_item_new', 'gtk_accel_group_new',
    'gtk_widget_add_accelerator', 'GDK_CONTROL_MASK', 'GDK_KEY_g', 'GDK_KEY_F1'
  ]) assert.ok(cpp.includes(marker), marker);
  assert.equal(cpp.includes('__patch_v09_separator_'), false);
});
