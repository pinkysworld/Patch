import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls, listDesignerWindows } from '../src/designer.js';
import { listDesignerTabPageControls } from '../src/designer-tabs-nested.js';
import { duplicateDesignerForm } from '../web/designer-form-duplicate-model.js';

const source = `window "Main" as main size 720, 500:
  button "Save" as save at 24, 24 size 120, 36
  tabs as settings at 24, 80 size 560, 320:
    tab "General":
      button "Nested" as nested
      input query
      table "Name", "Value" as prefs:
        row "Theme", "System"
    tab "Advanced":
      tree as nav:
        node "Root"
          node "Child"

window "Other" as other size 420, 260:
  button "Other" as other_button at 24, 24 size 120, 36

when save clicked:
  close main

when nested clicked:
  show "nested"

when query changed:
  show value

when other_button clicked:
  close other
`;

test('Duplicate Form inserts a complete sibling directly after the active Form', () => {
  const result = duplicateDesignerForm(source, 0);
  assert.equal(result.windowIndex, 1);
  assert.equal(result.formId, 'form_1');
  assert.doesNotThrow(() => parse(result.source));
  const windows = listDesignerWindows(result.source);
  assert.equal(windows.length, 3);
  assert.deepEqual(windows.map(item => item.id), ['main', 'form_1', 'other']);
  assert.deepEqual(windows.map(item => item.titleExpr), ['"Main"', '"Main"', '"Other"']);
  assert.deepEqual({ width: windows[1].width, height: windows[1].height }, { width: 720, height: 500 });
});

test('Duplicate Form remaps all top-level and nested control ids globally', () => {
  const result = duplicateDesignerForm(source, 0);
  assert.deepEqual(result.controlIdMap, {
    save: 'button_1',
    settings: 'tabs_1',
    nested: 'button_2',
    query: 'input_1',
    prefs: 'table_1',
    nav: 'tree_1'
  });
  const top = listDesignerControls(result.source).filter(item => item.windowIndex === 1);
  assert.deepEqual(top.map(item => item.id), ['button_1', 'tabs_1']);
  const copiedTabs = top.find(item => item.type === 'tabs');
  const general = listDesignerTabPageControls(result.source, copiedTabs, 0);
  assert.deepEqual(general.map(item => item.id), ['button_2', 'input_1', 'table_1']);
  assert.deepEqual(general[2].rows, [['"Theme"', '"System"']]);
  const advanced = listDesignerTabPageControls(result.source, copiedTabs, 1);
  assert.equal(advanced[0].id, 'tree_1');
  assert.equal(advanced[0].treeNodes[0].children[0].labelExpr, '"Child"');
});

test('Duplicate Form copies handlers for copied controls but leaves handler bodies semantically untouched', () => {
  const result = duplicateDesignerForm(source, 0);
  assert.match(result.source, /when save clicked:\n  close main/);
  assert.match(result.source, /when button_1 clicked:\n  close main/);
  assert.match(result.source, /when nested clicked:\n  show "nested"/);
  assert.match(result.source, /when button_2 clicked:\n  show "nested"/);
  assert.match(result.source, /when query changed:\n  show value/);
  assert.match(result.source, /when input_1 changed:\n  show value/);
  assert.doesNotMatch(result.source, /when button_1 clicked:\n  close form_1/);
});

test('Duplicate Form does not duplicate handlers belonging to later Forms', () => {
  const result = duplicateDesignerForm(source, 0);
  assert.equal((result.source.match(/when other_button clicked:/g) ?? []).length, 1);
  assert.match(result.source, /window "Other" as other size 420, 260:/);
  const windows = listDesignerWindows(result.source);
  assert.equal(windows[2].id, 'other');
});

test('Duplicate Form uses the next free Form id when form_1 already exists', () => {
  const withReserved = source.replace('window "Other" as other', 'window "Other" as form_1');
  const result = duplicateDesignerForm(withReserved, 0);
  assert.equal(result.formId, 'form_2');
  assert.deepEqual(listDesignerWindows(result.source).map(item => item.id), ['main', 'form_2', 'form_1']);
});

test('Duplicate Form fails closed for invalid selection', () => {
  assert.throws(() => duplicateDesignerForm(source, -1), /Form selection is invalid/);
  assert.throws(() => duplicateDesignerForm(source, 9), /Form selection is invalid/);
});

test('Form duplicate UI uses the existing Form selector as the active-form boundary', () => {
  const ui = fs.readFileSync('web/designer-form-duplicate.js', 'utf8');
  assert.match(ui, /#patchFormSelect/);
  assert.match(ui, /#patchAddForm/);
  assert.match(ui, /patchDuplicateForm/);
  assert.match(ui, /duplicateDesignerForm\(code\.value, windowIndex\)/);
  assert.match(ui, /pendingWindowIndex/);
  assert.match(ui, /select\.dispatchEvent\(new Event\('change'/);
  assert.match(ui, /patch-window-title/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|Change History/);
});

test('public Studio and offline PWA package Form duplication', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-form-duplicate\.js'/);
  assert.match(build, /designer-form-duplicate-model\.js/);
  assert.match(build, /designer-form-duplicate\.js/);
  assert.match(sw, /'\.\/designer-form-duplicate-model\.js'/);
  assert.match(sw, /'\.\/designer-form-duplicate\.js'/);
  execFileSync(process.execPath, ['--check', 'web/designer-form-duplicate-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-form-duplicate.js'], { stdio: 'pipe' });
});
