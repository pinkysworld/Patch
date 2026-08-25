import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import {
  addDesignerMenu,
  addDesignerMenuItem,
  ensureDesignerMenuItemHandler,
  insertDesignerMenuSeparator,
  listDesignerMenus,
  moveDesignerMenuItem,
  removeDesignerMenu,
  removeDesignerMenuEntry,
  updateDesignerMenu,
  updateDesignerMenuItem
} from '../src/designer-menu.js';
import {
  designerLiteralExpression,
  displayDesignerExpression,
  listDesignerBooleanState
} from '../web/designer-menu-designer.js';

const stateMenu = fs.readFileSync('examples/menu-state-window.patch', 'utf8');

test('RAD Menu model reads existing native-capable menu state, shortcuts and separators', () => {
  const menus = listDesignerMenus(stateMenu, 0);
  assert.equal(menus.length, 1);
  assert.equal(menus[0].titleExpr, '"Actions"');
  assert.deepEqual(menus[0].entries.map(entry => entry.kind), ['item', 'item', 'separator', 'item']);
  assert.deepEqual(
    menus[0].entries.filter(entry => entry.kind === 'item').map(entry => [entry.id, entry.enabledState, entry.checkedState, entry.shortcutExpr]),
    [
      ['enable_advanced', null, null, null],
      ['advanced_action', 'advanced', null, '"Primary+E"'],
      ['pin_item', null, 'pinned', '"Primary+P"']
    ]
  );
});

test('RAD Menu Designer creates parseable source-backed menus and items without a second form model', () => {
  const source = `create boolean can_save = true\ncreate boolean pinned = false\n\nwindow "Demo" as main size 520, 300:\n  text "Ready" at 24, 48 size 180, 30\n`;
  const addedMenu = addDesignerMenu(source, 0, { titleExpr: '"File"', textExpr: '"Open"', id: 'open_item' });
  assert.match(addedMenu.source, /menu "File":\n    item "Open" as open_item/);
  assert.doesNotThrow(() => parse(addedMenu.source));

  const menu = listDesignerMenus(addedMenu.source, 0)[0];
  const addedItem = addDesignerMenuItem(addedMenu.source, menu, {
    textExpr: '"Save"',
    id: 'save_item',
    enabledState: 'can_save',
    checkedState: 'pinned',
    shortcutExpr: '"Primary+S"'
  });
  assert.match(addedItem.source, /item "Save" as save_item enabled can_save checked pinned shortcut "Primary\+S"/);
  assert.doesNotThrow(() => parse(addedItem.source));
});

test('MenuItem property edits preserve canonical modifier order and rename OnClick handlers', () => {
  const source = `create boolean can_run = true\nwindow "Demo" as main:\n  menu "Actions":\n    item "Run" as run_item shortcut "F5"\n\nwhen run_item clicked:\n  show "run"\n`;
  const menu = listDesignerMenus(source, 0)[0];
  const result = updateDesignerMenuItem(source, { ...menu, entryIndex: 0 }, {
    id: 'execute_item',
    textExpr: '"Execute"',
    enabledState: 'can_run',
    shortcutExpr: '"Primary+E"'
  });
  assert.match(result.source, /item "Execute" as execute_item enabled can_run shortcut "Primary\+E"/);
  assert.match(result.source, /when execute_item clicked:/);
  assert.doesNotMatch(result.source, /when run_item clicked:/);
});

test('Menu caption editing and item movement stay ordinary parseable source rewrites', () => {
  const source = `window "Demo" as main:\n  menu "File":\n    item "Open" as open_item\n    item "Save" as save_item\n    item "Exit" as exit_item\n`;
  const menu = listDesignerMenus(source, 0)[0];
  const renamed = updateDesignerMenu(source, menu, { titleExpr: '"Project"' });
  assert.match(renamed, /menu "Project":/);
  const updatedMenu = listDesignerMenus(renamed, 0)[0];
  const save = updatedMenu.entries.find(entry => entry.id === 'save_item');
  const moved = moveDesignerMenuItem(renamed, { ...updatedMenu, entryIndex: save.entryIndex }, 'earlier');
  assert.equal(moved.moved, true);
  assert.deepEqual(
    listDesignerMenus(moved.source, 0)[0].entries.filter(entry => entry.kind === 'item').map(entry => entry.id),
    ['save_item', 'open_item', 'exit_item']
  );
  assert.doesNotThrow(() => parse(moved.source));
});

test('separator insertion is constrained to clickable neighbors and item deletion repairs separator edges', () => {
  const source = `window "Demo" as main:\n  menu "File":\n    item "Open" as open_item\n    item "Save" as save_item\n    item "Exit" as exit_item\n\nwhen save_item clicked:\n  show "save"\n`;
  const menu = listDesignerMenus(source, 0)[0];
  const separated = insertDesignerMenuSeparator(source, menu, 0);
  assert.deepEqual(listDesignerMenus(separated, 0)[0].entries.map(entry => entry.kind), ['item', 'separator', 'item', 'item']);
  const nextMenu = listDesignerMenus(separated, 0)[0];
  const open = nextMenu.entries.find(entry => entry.id === 'open_item');
  const removed = removeDesignerMenuEntry(separated, { ...nextMenu, entryIndex: open.entryIndex });
  assert.deepEqual(listDesignerMenus(removed, 0)[0].entries.map(entry => entry.kind), ['item', 'item']);
  assert.doesNotThrow(() => parse(removed));
});

test('deleting MenuItems and whole menus removes orphan OnClick handlers', () => {
  const source = `window "Demo" as main:\n  menu "File":\n    item "Open" as open_item\n    item "Close" as close_item\n\nwhen open_item clicked:\n  show "open"\n\nwhen close_item clicked:\n  show "close"\n`;
  const menu = listDesignerMenus(source, 0)[0];
  const open = menu.entries.find(entry => entry.id === 'open_item');
  const oneRemoved = removeDesignerMenuEntry(source, { ...menu, entryIndex: open.entryIndex });
  assert.doesNotMatch(oneRemoved, /when open_item clicked:/);
  assert.match(oneRemoved, /when close_item clicked:/);

  const remainingMenu = listDesignerMenus(oneRemoved, 0)[0];
  const noMenu = removeDesignerMenu(oneRemoved, remainingMenu);
  assert.equal(listDesignerMenus(noMenu, 0).length, 0);
  assert.doesNotMatch(noMenu, /when close_item clicked:/);
  assert.doesNotThrow(() => parse(noMenu));
});

test('Menu Designer can create or reopen an ordinary source-visible OnClick handler', () => {
  const source = `window "Demo" as main:\n  menu "Help":\n    item "About" as about_item\n`;
  const menu = listDesignerMenus(source, 0)[0];
  const created = ensureDesignerMenuItemHandler(source, { ...menu, entryIndex: 0 });
  assert.equal(created.created, true);
  assert.match(created.source, /when about_item clicked:\n  show "about_item clicked"/);
  const reopened = ensureDesignerMenuItemHandler(created.source, { ...listDesignerMenus(created.source, 0)[0], entryIndex: 0 });
  assert.equal(reopened.created, false);
  assert.equal(reopened.source, created.source);
});

test('RAD Menu UI derives Boolean bindings and preserves source expressions until captions change', () => {
  assert.deepEqual(listDesignerBooleanState(stateMenu), ['advanced', 'pinned']);
  assert.equal(displayDesignerExpression('"Primary+S"'), 'Primary+S');
  assert.equal(designerLiteralExpression('File', '"File"'), '"File"');
  assert.equal(designerLiteralExpression('Project', '"File"'), '"Project"');
});

test('Menu Designer ships in the content-addressed Studio and offline PWA graph', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const browser = fs.readFileSync('web/designer-menu-designer.js', 'utf8');
  const css = fs.readFileSync('web/designer-menu-designer.css', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-menu-designer\.js'/);
  assert.match(browser, /id = 'openMenuDesigner'/);
  assert.match(browser, /designerMenuAddSeparator/);
  assert.match(browser, /designerMenuHandler/);
  assert.match(browser, /Enabled state/);
  assert.match(browser, /Checked state/);
  assert.match(css, /designer-menu-dialog/);
  assert.match(buildSite, /designer-menu-designer\.js/);
  assert.match(buildSite, /designer-menu\.js/);
  assert.match(sw, /designer-menu-designer\.js/);
  assert.match(sw, /designer-menu\.js/);
});
