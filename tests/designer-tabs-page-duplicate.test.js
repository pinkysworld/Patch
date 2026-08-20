import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import { listDesignerTabPages } from '../src/designer-data.js';
import { listDesignerTabPageControls } from '../src/designer-tabs-nested.js';
import { duplicateDesignerTabPage } from '../web/designer-tabs-page-model.js';

const source = `window "Settings" as main size 640, 420:
  tabs as settings at 24, 64 size 520, 300:
    tab "General":
      button "Save" as save
      input query
      table "Name", "Value" as prefs:
        row "Theme", "System"
      tree as nav:
        node "Root"
          node "Child"
    tab "Advanced":
      button "Other" as button_1

when save clicked:
  show "saved"

when query changed:
  show value
`;

function tabs(text = source) {
  return listDesignerControls(text).find(control => control.type === 'tabs');
}

test('Duplicate page inserts a complete source-backed sibling and selects its new index', () => {
  const result = duplicateDesignerTabPage(source, tabs(), 0);
  assert.equal(result.pageIndex, 1);
  assert.doesNotThrow(() => parse(result.source));
  const pages = listDesignerTabPages(result.source, tabs(result.source));
  assert.equal(pages.length, 3);
  assert.equal(pages[0].titleExpr, '"General"');
  assert.equal(pages[1].titleExpr, '"General"');
  assert.equal(pages[2].titleExpr, '"Advanced"');
});

test('Duplicate page assigns fresh globally unique ids for every named control', () => {
  const result = duplicateDesignerTabPage(source, tabs(), 0);
  assert.deepEqual(result.idMap, {
    save: 'button_2',
    query: 'input_1',
    prefs: 'table_1',
    nav: 'tree_1'
  });
  const copied = listDesignerTabPageControls(result.source, tabs(result.source), 1);
  assert.deepEqual(copied.map(control => control.id), ['button_2', 'input_1', 'table_1', 'tree_1']);
  assert.match(result.source, /input input_1/);
  assert.doesNotMatch(result.source, /button "Save" as button_1/);
});

test('Duplicate page preserves complete Table rows and TreeView hierarchy', () => {
  const result = duplicateDesignerTabPage(source, tabs(), 0);
  const copied = listDesignerTabPageControls(result.source, tabs(result.source), 1);
  const table = copied.find(control => control.type === 'table');
  const tree = copied.find(control => control.type === 'tree');
  assert.deepEqual(table.columns, ['"Name"', '"Value"']);
  assert.deepEqual(table.rows, [['"Theme"', '"System"']]);
  assert.equal(tree.treeNodes[0].labelExpr, '"Root"');
  assert.equal(tree.treeNodes[0].children[0].labelExpr, '"Child"');
  assert.match(result.source, /table "Name", "Value" as table_1:\n        row "Theme", "System"/);
  assert.match(result.source, /tree as tree_1:\n        node "Root"\n          node "Child"/);
});

test('Duplicate page copies matching event handlers to remapped control ids and preserves originals', () => {
  const result = duplicateDesignerTabPage(source, tabs(), 0);
  assert.match(result.source, /when save clicked:\n  show "saved"/);
  assert.match(result.source, /when button_2 clicked:\n  show "saved"/);
  assert.match(result.source, /when query changed:\n  show value/);
  assert.match(result.source, /when input_1 changed:\n  show value/);
});

test('Duplicate page leaves the original page and existing ids unchanged', () => {
  const result = duplicateDesignerTabPage(source, tabs(), 0);
  const original = listDesignerTabPageControls(result.source, tabs(result.source), 0);
  assert.deepEqual(original.map(control => control.id), ['save', 'query', 'prefs', 'nav']);
  assert.match(result.source, /tab "Advanced":\n      button "Other" as button_1/);
});

test('Duplicate page fails closed for invalid page selection', () => {
  assert.throws(() => duplicateDesignerTabPage(source, tabs(), -1), /Tab page selection is invalid/);
  assert.throws(() => duplicateDesignerTabPage(source, tabs(), 99), /Tab page selection is invalid/);
});

test('Duplicate page UI is source-backed and selects the duplicated page after rerender', () => {
  const ui = fs.readFileSync('web/designer-tabs-page-duplicate.js', 'utf8');
  assert.match(ui, /data-tabs-duplicate-page/);
  assert.match(ui, /duplicateDesignerTabPage/);
  assert.match(ui, /pendingPageIndex/);
  assert.match(ui, /page\.click\(\)/);
  assert.match(ui, /focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|Change History/);
});

test('public Studio and offline PWA package Tabs page duplication', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-tabs-page-duplicate\.js'/);
  assert.match(build, /designer-tabs-page-model\.js/);
  assert.match(build, /designer-tabs-page-duplicate\.js/);
  assert.match(sw, /'\.\/designer-tabs-page-model\.js'/);
  assert.match(sw, /'\.\/designer-tabs-page-duplicate\.js'/);
  execFileSync(process.execPath, ['--check', 'web/designer-tabs-page-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-tabs-page-duplicate.js'], { stdio: 'pipe' });
});
