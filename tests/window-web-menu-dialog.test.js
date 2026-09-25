import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = `create boolean can_save = true
create boolean pinned = false
create text selected_path = "none"

window "Web menu demo" as main size 640, 420:
  menu "File":
    item "Open..." as open_item shortcut "Primary+O"
    item "Save..." as save_item enabled can_save shortcut "Primary+S"
    separator
    item "Pinned" as pinned_item checked pinned shortcut "Primary+P"
  menu "Help":
    item "About" as about_item shortcut "F1"
  button "Confirm" as confirm_button

when open_item clicked:
  open file "Open Patch file" as open_result

when open_result chosen:
  change selected_path:
    set = value

when open_result cancelled:
  change selected_path:
    set = "cancelled"

when save_item clicked:
  save file "Save Patch file" as save_result

when save_result chosen:
  change selected_path:
    set = value

when save_result cancelled:
  change selected_path:
    set = "cancelled"

when pinned_item clicked:
  change pinned:
    set = true

when about_item clicked:
  dialog "About", "Standalone Web menu"

when confirm_button clicked:
  confirm "Continue?", "Exercise typed confirmation" as confirm_result

when confirm_result confirmed:
  change pinned:
    set = true

when confirm_result cancelled:
  change pinned:
    set = false
`;

test('Standalone Window Web v0.10 builds decorated menus and typed dialog result flows', () => {
  const built = buildStandaloneWebApp(source, { name: 'WebMenuDialog', kind: 'window' });
  assert.equal(built.metadata.version, '0.10');
  assert.equal(built.metadata.menuStage, 1);
  assert.equal(built.metadata.menuItems, 5);
  assert.equal(built.metadata.menuSeparators, 1);
  assert.equal(built.metadata.menuShortcuts, 4);
  assert.equal(built.metadata.menuEnabledBindings, 1);
  assert.equal(built.metadata.menuCheckedBindings, 1);
  assert.equal(built.metadata.resultDialogStage, 1);
  assert.equal(built.metadata.resultDialogs, 3);

  assert.match(built.html, /patch-menu-bar/);
  assert.match(built.html, /patch-menu-item/);
  assert.match(built.html, /aria-checked/);
  assert.match(built.html, /shortcutMatches/);
  assert.match(built.html, /runInfoDialog/);
  assert.match(built.html, /runConfirmDialog/);
  assert.match(built.html, /runOpenFileDialog/);
  assert.match(built.html, /runSaveFileDialog/);
  assert.match(built.html, /event==='chosen'/);
  assert.match(built.html, /showSaveFilePicker/);
});

test('Standalone Window Web menu support does not make persistent state implicit', () => {
  const built = buildStandaloneWebApp(source, { name: 'WebMenuState', kind: 'window' });
  assert.match(built.html, /entry\.checked/);
  assert.match(built.html, /safeTrigger\(entry\.id,'clicked'\)/);
  assert.doesNotMatch(built.html, /state\.set\(entry\.id/);
});
