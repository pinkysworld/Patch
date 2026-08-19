import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { listDesignerControls } from '../src/designer.js';
import {
  addTreeChild,
  addTreeRoot,
  flattenTreeNodes,
  indentTreeNode,
  moveTreeNode,
  outdentTreeNode,
  removeTreeNode,
  renameTreeNode,
  updateDesignerTableData,
  updateDesignerTreeNodes
} from '../src/designer-data.js';

test('TreeView data editor rewrites hierarchy without touching geometry or event block', () => {
  const source = `window "Files" size 700, 480:
  tree as files at 24, 40 size 320, 240:
    node "src"
      node "compiler.js"
    node "docs"

when files changed:
  show value
`;
  const control = listDesignerControls(source)[0];
  const next = updateDesignerTreeNodes(source, control, [
    { labelExpr: '"src"', children: [{ labelExpr: '"parser.js"', children: [] }] },
    { labelExpr: '"tests"', children: [] }
  ]);
  assert.match(next, /tree as files at 24, 40 size 320, 240:/);
  assert.match(next, /node "src"\n      node "parser\.js"\n    node "tests"/);
  assert.match(next, /when files changed:\n  show value/);
  assert.doesNotMatch(next, /compiler\.js|node "docs"/);
});

test('TreeView model actions add rename reorder indent outdent and delete deterministically', () => {
  let state = { nodes: [{ labelExpr: '"A"', children: [] }, { labelExpr: '"B"', children: [] }], path: [0] };
  state = addTreeRoot(state.nodes, '"C"');
  assert.deepEqual(state.path, [2]);
  state = addTreeChild(state.nodes, [0], '"A1"');
  assert.deepEqual(state.path, [0, 0]);
  state = renameTreeNode(state.nodes, state.path, '"Renamed"');
  assert.equal(state.nodes[0].children[0].labelExpr, '"Renamed"');
  state = outdentTreeNode(state.nodes, state.path);
  assert.deepEqual(state.path, [1]);
  assert.equal(state.nodes[1].labelExpr, '"Renamed"');
  state = moveTreeNode(state.nodes, state.path, 'down');
  assert.deepEqual(state.path, [2]);
  state = indentTreeNode(state.nodes, state.path);
  assert.deepEqual(state.path, [1, 0]);
  state = removeTreeNode(state.nodes, state.path);
  assert.equal(flattenTreeNodes(state.nodes).some(item => item.labelExpr === '"Renamed"'), false);
});

test('TreeView editor refuses an empty hierarchy', () => {
  const source = `window "Files":
  tree as files:
    node "src"
`;
  assert.throws(() => updateDesignerTreeNodes(source, { windowIndex: 0, controlIndex: 0 }, []), /at least one node/);
});

test('Table data editor rewrites columns and rows while preserving id geometry and handlers', () => {
  const source = `window "Data" size 720, 500:
  table "Name", "Role" as people at 24, 32 size 480, 220:
    row "Ada", "Engineer"
    row "Linus", "Maintainer"

when people changed:
  show value
`;
  const control = listDesignerControls(source)[0];
  const next = updateDesignerTableData(source, control, {
    columns: ['"Name"', '"Role"', '"Team"'],
    rows: [
      ['"Ada"', '"Engineer"', '"Compiler"'],
      ['"Linus"', '"Maintainer"', '"Kernel"']
    ]
  });
  assert.match(next, /table "Name", "Role", "Team" as people at 24, 32 size 480, 220:/);
  assert.match(next, /row "Ada", "Engineer", "Compiler"/);
  assert.match(next, /row "Linus", "Maintainer", "Kernel"/);
  assert.match(next, /when people changed:\n  show value/);
});

test('Table data editor fails closed on row width drift', () => {
  const source = `window "Data":
  table "A", "B" as grid:
    row "1", "2"
`;
  assert.throws(() => updateDesignerTableData(source, { windowIndex: 0, controlIndex: 0 }, {
    columns: ['"A"', '"B"'],
    rows: [['"only one"']]
  }), /exactly 2 cells/);
});

test('Studio ships visual TreeView and Table editors through the content-addressed PWA build', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const css = fs.readFileSync('web/designer-data-editor.css', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');

  assert.match(workspace, /import '\.\/designer-data-editor\.js'/);
  for (const marker of ['add-root', 'add-child', 'rename', 'indent', 'outdent', 'delete']) assert.ok(editor.includes(marker), marker);
  for (const marker of ['Apply data', '+ Column', '− Column', '+ Row']) assert.ok(editor.includes(marker), marker);
  assert.match(css, /designer-tree-node-list/);
  assert.match(css, /designer-table-editor/);
  assert.match(sw, /designer-data-editor\.js/);
  assert.match(sw, /designer-data-editor\.css/);
  assert.match(sw, /\.\.\/src\/designer-data\.js/);
  assert.match(build, /'designer-data\.js'/);
  assert.match(build, /'designer-data-editor\.js'/);
  assert.match(build, /'designer-data-editor\.css'/);

  execFileSync(process.execPath, ['--check', 'src/designer-data.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-data-editor.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-workspace.js'], { stdio: 'pipe' });
});
