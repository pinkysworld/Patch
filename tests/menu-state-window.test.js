import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import {
  buildNativeGuiIRV10,
  validateNativeGuiIRV10,
  flattenNativeGuiMenuItemsV10
} from '../src/native-gui-ir-v10.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import { emitWin32GuiCppV11 } from '../src/win32-gui-v11.js';
import { emitAppKitGuiObjCppV11 } from '../src/appkit-gui-v11.js';
import { emitGtkGuiCppV11 } from '../src/gtk-gui-v11.js';

const source = fs.readFileSync('examples/menu-state-window.patch', 'utf8');

test('parser records source-backed enabled and checked MenuItem bindings', () => {
  const ast = parse(source);
  const window = ast.find(node => node.kind === 'window');
  const menu = window.body.find(node => node.kind === 'menu');
  assert.deepEqual(menu.body.map(item => item.kind), ['menuItem', 'menuItem', 'menuSeparator', 'menuItem']);
  assert.deepEqual(
    {
      id: menu.body[1].id,
      enabledState: menu.body[1].enabledState,
      checkedState: menu.body[1].checkedState,
      shortcutExpr: menu.body[1].shortcutExpr
    },
    { id: 'advanced_action', enabledState: 'advanced', checkedState: null, shortcutExpr: '"Primary+E"' }
  );
  assert.deepEqual(
    {
      id: menu.body[3].id,
      enabledState: menu.body[3].enabledState,
      checkedState: menu.body[3].checkedState,
      shortcutExpr: menu.body[3].shortcutExpr
    },
    { id: 'pin_item', enabledState: null, checkedState: 'pinned', shortcutExpr: '"Primary+P"' }
  );
});

test('existing plain and shortcut-only MenuItem syntax remains source-compatible', () => {
  const ast = parse(`window "Menu":\n  menu "File":\n    item "Open" as open_item\n    item "Save" as save_item shortcut "Primary+S"\n`);
  const items = ast[0].body[0].body;
  assert.equal(items[0].enabledState, null);
  assert.equal(items[0].checkedState, null);
  assert.equal(items[0].shortcutExpr, null);
  assert.equal(items[1].shortcutExpr, '"Primary+S"');
});

test('Change IR 0.10 keeps MenuItem state references explicit without hidden state', () => {
  const compiled = compile(source, { name: 'MenuStateDemo', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.menu-enabled-state'));
  assert.ok(compiled.ir.capabilities.includes('ui.menu-checked-state'));
  const menu = compiled.ir.instructions.find(item => item.code === 'WINDOW').body.find(item => item.code === 'MENU');
  const advanced = menu.body.find(item => item.id === 'advanced_action');
  const pinned = menu.body.find(item => item.id === 'pin_item');
  assert.equal(advanced.enabledState, 'advanced');
  assert.equal(pinned.checkedState, 'pinned');

  const pinEvent = compiled.ir.instructions.find(item => item.code === 'EVENT' && item.control === 'pin_item');
  assert.deepEqual(pinEvent.body, [{
    code: 'CHANGE',
    line: 20,
    target: 'pinned',
    name: null,
    operations: [{ op: 'set', field: null, expr: 'true', line: 21 }]
  }]);
});

test('Window preflight requires Boolean state for enabled and checked bindings', () => {
  const missing = compile(`window "Bad":\n  menu "File":\n    item "Save" as save_item enabled can_save\n`, { name: 'Bad', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(missing, { allowMenuDecorations: true }),
    /enabled binding 'can_save' must be boolean state; found no declared state/i
  );

  const wrongType = compile(`create text pinned = "yes"\nwindow "Bad":\n  menu "View":\n    item "Pinned" as pin_item checked pinned\n`, { name: 'BadType', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(wrongType, { allowMenuDecorations: true }),
    /checked binding 'pinned' must be boolean state; found text state/i
  );
});

test('older shared Ready runtime fails closed while direct menu state tier can validate', () => {
  const compiled = compile(source, { name: 'MenuStateDemo', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled),
    /Native GUI IR 1\.0 \/ direct AOT backend 1\.1/i
  );
  const support = validateWindowRuntimeSupport(compiled, { allowMenuDecorations: true });
  assert.equal(support.menuEnabledBindings, 1);
  assert.equal(support.menuCheckedBindings, 1);
  assert.equal(support.menuShortcuts, 2);
  assert.equal(support.menuSeparators, 1);
});

test('Native GUI IR 1.0 keeps Boolean state references on real MenuItems', () => {
  const ir = buildNativeGuiIRV10(compile(source, { name: 'MenuStateDemo', kind: 'window' }));
  assert.equal(ir.version, '1.0');
  const items = ir.forms[0].menus[0].items;
  assert.equal(items[1].id, 'advanced_action');
  assert.equal(items[1].enabledState, 'advanced');
  assert.equal(items[1].checkedState, null);
  assert.equal(items[3].id, 'pin_item');
  assert.equal(items[3].enabledState, null);
  assert.equal(items[3].checkedState, 'pinned');
  assert.equal(validateNativeGuiIRV10(ir), ir);
  assert.deepEqual(
    flattenNativeGuiMenuItemsV10(ir).map(item => [item.id, item.enabledState, item.checkedState]),
    [
      ['enable_advanced', null, null],
      ['advanced_action', 'advanced', null],
      ['pin_item', null, 'pinned']
    ]
  );
});

test('Native GUI build plan uses the frozen TreeView contract for menu state', () => {
  const plan = buildNativeGuiPlan(compile(source, { name: 'MenuStateDemo', kind: 'window' }));
  assert.equal(plan.tier, 'tree-v13');
  assert.equal(plan.gui.version, '1.2');
  assert.equal(plan.features.menuEnabledState, true);
  assert.equal(plan.features.menuCheckedState, true);
  assert.equal(plan.features.menuStateBindings, true);
});

test('Win32 backend 1.1 refreshes enabled/checked state and guards disabled shortcut dispatch', () => {
  const ir = buildNativeGuiIRV10(compile(source, { name: 'MenuStateDemo', kind: 'window' }));
  const cpp = emitWin32GuiCppV11(ir);
  for (const marker of [
    'backend 1.1',
    'EnableMenuItem', 'MF_GRAYED', 'patch_state_advanced',
    'CheckMenuItem', 'MF_CHECKED', 'patch_state_pinned',
    'DrawMenuBar',
    'if (!patch_state_advanced) return;',
    'CreateAcceleratorTableW'
  ]) assert.ok(cpp.includes(marker), marker);
});

test('AppKit backend 1.1 refreshes native MenuItem enabled/check state and guards dispatch', () => {
  const ir = buildNativeGuiIRV10(compile(source, { name: 'MenuStateDemo', kind: 'window' }));
  const cpp = emitAppKitGuiObjCppV11(ir);
  for (const marker of [
    'backend 1.1',
    'setEnabled:patch_state_advanced ? YES : NO',
    'setState:patch_state_pinned ? NSControlStateValueOn : NSControlStateValueOff',
    'if (!patch_state_advanced) return;',
    'NSEventModifierFlagCommand'
  ]) assert.ok(cpp.includes(marker), marker);
});

test('GTK backend 1.1 uses check MenuItems, refreshes state and guards dispatch', () => {
  const ir = buildNativeGuiIRV10(compile(source, { name: 'MenuStateDemo', kind: 'window' }));
  const cpp = emitGtkGuiCppV11(ir);
  for (const marker of [
    'backend 1.1',
    'gtk_check_menu_item_new_with_label',
    'gtk_widget_set_sensitive', 'patch_state_advanced',
    'gtk_check_menu_item_set_active', 'patch_state_pinned',
    'if (!patch_state_advanced) return;',
    'gtk_accel_group_new'
  ]) assert.ok(cpp.includes(marker), marker);
});
