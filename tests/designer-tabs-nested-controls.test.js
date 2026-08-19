import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import {
  addDesignerTabPageControl,
  listDesignerTabPageControls,
  removeDesignerTabPageControl,
  supportedDesignerTabControlTypes,
  updateDesignerTabPageTableData,
  updateDesignerTabPageTreeNodes
} from '../src/designer-tabs-nested.js';

const base = `window "Settings" as main size 640, 420:
  button "Outside" as button_1
  tabs as settings at 24, 72 size 500, 280:
    tab "General":
      text "General"
      button "Save" as save
    tab "Advanced":
      text "Advanced"

when save clicked:
  show 1
`;

function tabs(source = base) {
  return listDesignerControls(source).find(control => control.type === 'tabs');
}

test('Tabs nested editor lists flow-layout controls for the selected page', () => {
  const controls = listDesignerTabPageControls(base, tabs(), 0);
  assert.deepEqual(controls.map(control => control.type), ['text', 'button']);
  assert.deepEqual(controls.map(control => control.id), [null, 'save']);
});

test('Tabs nested editor adds every supported flow control as valid Patch source', () => {
  let source = base;
  for (const type of supportedDesignerTabControlTypes()) {
    source = addDesignerTabPageControl(source, tabs(source), 1, type);
    assert.doesNotThrow(() => parse(source), type);
  }
  const controls = listDesignerTabPageControls(source, tabs(source), 1);
  for (const type of supportedDesignerTabControlTypes()) {
    assert.ok(controls.some(control => control.type === type), type);
  }
});

test('nested control ids remain unique across top-level and Tabs page controls', () => {
  const source = addDesignerTabPageControl(base, tabs(), 0, 'button');
  const controls = listDesignerTabPageControls(source, tabs(source), 0);
  assert.equal(controls.at(-1).id, 'button_2');
  assert.match(source, /button "Button" as button_2/);
});

test('nested Table and TreeView use source-backed starter structures without geometry', () => {
  let source = addDesignerTabPageControl(base, tabs(), 1, 'table');
  source = addDesignerTabPageControl(source, tabs(source), 1, 'tree');
  assert.match(source, /table "Name", "Value" as table_1:\n        row "Item", "Value"/);
  assert.match(source, /tree as tree_1:\n        node "Root"\n          node "Child"/);
  assert.doesNotMatch(source, /table "Name", "Value" as table_1 at/);
  assert.doesNotMatch(source, /tree as tree_1 at/);
  const controls = listDesignerTabPageControls(source, tabs(source), 1);
  const table = controls.find(control => control.type === 'table');
  const tree = controls.find(control => control.type === 'tree');
  assert.deepEqual(table.columns, ['"Name"', '"Value"']);
  assert.deepEqual(table.rows, [['"Item"', '"Value"']]);
  assert.equal(tree.treeNodes[0].labelExpr, '"Root"');
  assert.equal(tree.treeNodes[0].children[0].labelExpr, '"Child"');
});

test('nested Table structural update rewrites only its source-backed header and rows', () => {
  let source = addDesignerTabPageControl(base, tabs(), 1, 'table');
  const control = listDesignerTabPageControls(source, tabs(source), 1).find(item => item.type === 'table');
  source = updateDesignerTabPageTableData(source, tabs(source), 1, control.controlIndex, {
    columns: ['"Key"', '"Value"', '"Mode"'],
    rows: [['"Theme"', '"System"', '"Auto"'], ['"Scale"', '"125%"', '"Fixed"']]
  });
  assert.match(source, /table "Key", "Value", "Mode" as table_1:\n        row "Theme", "System", "Auto"\n        row "Scale", "125%", "Fixed"/);
  assert.match(source, /tab "Advanced":\n      text "Advanced"/);
  assert.doesNotThrow(() => parse(source));
  const updated = listDesignerTabPageControls(source, tabs(source), 1).find(item => item.type === 'table');
  assert.deepEqual(updated.columns, ['"Key"', '"Value"', '"Mode"']);
  assert.equal(updated.rows.length, 2);
});

test('nested Table structural update fails closed on row width mismatch', () => {
  const source = addDesignerTabPageControl(base, tabs(), 1, 'table');
  const control = listDesignerTabPageControls(source, tabs(source), 1).find(item => item.type === 'table');
  assert.throws(() => updateDesignerTabPageTableData(source, tabs(source), 1, control.controlIndex, {
    columns: ['"A"', '"B"'], rows: [['"only-one"']]
  }), /exactly 2 cells/);
});

test('nested TreeView structural update rewrites hierarchy and keeps neighboring controls intact', () => {
  let source = addDesignerTabPageControl(base, tabs(), 1, 'tree');
  const control = listDesignerTabPageControls(source, tabs(source), 1).find(item => item.type === 'tree');
  source = updateDesignerTabPageTreeNodes(source, tabs(source), 1, control.controlIndex, [
    { labelExpr: '"src"', children: [{ labelExpr: '"compiler.js"', children: [] }, { labelExpr: '"parser.js"', children: [] }] },
    { labelExpr: '"docs"', children: [{ labelExpr: '"README.md"', children: [] }] }
  ]);
  assert.match(source, /tree as tree_1:\n        node "src"\n          node "compiler\.js"\n          node "parser\.js"\n        node "docs"\n          node "README\.md"/);
  assert.match(source, /tab "Advanced":\n      text "Advanced"/);
  assert.doesNotThrow(() => parse(source));
  const updated = listDesignerTabPageControls(source, tabs(source), 1).find(item => item.type === 'tree');
  assert.equal(updated.treeNodes.length, 2);
  assert.equal(updated.treeNodes[0].children.length, 2);
});

test('nested TreeView structural update refuses an empty hierarchy', () => {
  const source = addDesignerTabPageControl(base, tabs(), 1, 'tree');
  const control = listDesignerTabPageControls(source, tabs(source), 1).find(item => item.type === 'tree');
  assert.throws(() => updateDesignerTabPageTreeNodes(source, tabs(source), 1, control.controlIndex, []), /at least one node/);
});

test('removing a named nested control also removes its orphan handler', () => {
  const next = removeDesignerTabPageControl(base, tabs(), 0, 1);
  assert.doesNotMatch(next, /button "Save" as save/);
  assert.doesNotMatch(next, /when save clicked:/);
  assert.match(next, /tab "General":\n      text "General"/);
  assert.doesNotThrow(() => parse(next));
});

test('removing nested Table and TreeView removes their complete source blocks', () => {
  let source = addDesignerTabPageControl(base, tabs(), 1, 'table');
  source = addDesignerTabPageControl(source, tabs(source), 1, 'tree');
  let controls = listDesignerTabPageControls(source, tabs(source), 1);
  const tableIndex = controls.find(control => control.type === 'table').controlIndex;
  source = removeDesignerTabPageControl(source, tabs(source), 1, tableIndex);
  assert.doesNotMatch(source, /table "Name", "Value" as table_1/);
  assert.doesNotMatch(source, /row "Item", "Value"/);
  assert.match(source, /tree as tree_1/);
  controls = listDesignerTabPageControls(source, tabs(source), 1);
  const treeIndex = controls.find(control => control.type === 'tree').controlIndex;
  source = removeDesignerTabPageControl(source, tabs(source), 1, treeIndex);
  assert.doesNotMatch(source, /tree as tree_1/);
  assert.doesNotMatch(source, /node "Root"/);
  assert.doesNotThrow(() => parse(source));
});

test('nested editor refuses to leave a Tabs page empty', () => {
  const source = `window "Demo":
  tabs as settings:
    tab "One":
      text "One"
    tab "Two":
      text "Two"
`;
  assert.throws(() => removeDesignerTabPageControl(source, tabs(source), 0, 0), /at least one control/);
});

test('nested editor fails closed for unknown or unsupported container types', () => {
  assert.throws(() => addDesignerTabPageControl(base, tabs(), 0, 'tabs'), /cannot add 'tabs'/);
  assert.throws(() => addDesignerTabPageControl(base, tabs(), 0, 'unknown'), /cannot add 'unknown'/);
});

test('Studio ships nested Tabs structural editing through the content-addressed PWA surface', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const web = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const css = fs.readFileSync('web/designer-data-editor.css', 'utf8');

  assert.match(workspace, /import '\.\/designer-tabs-nested\.js'/);
  assert.match(web, /Page controls/);
  assert.match(web, /data-tabs-add-control/);
  assert.match(web, /data-tabs-remove-control/);
  assert.match(web, /data-tabs-edit-structure/);
  assert.match(web, /Nested Table data/);
  assert.match(web, /Nested TreeView nodes/);
  assert.match(web, /data-tabs-table-action/);
  assert.match(web, /data-tabs-tree-action/);
  assert.match(css, /designer-tabs-structure-editor/);
  assert.match(sw, /designer-tabs-nested\.js/);
  assert.match(build, /'designer-tabs-nested\.js'/);

  execFileSync(process.execPath, ['--check', 'src/designer-tabs-nested.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-tabs-nested.js'], { stdio: 'pipe' });
});
