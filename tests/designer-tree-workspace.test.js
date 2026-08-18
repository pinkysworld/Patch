import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';

test('Designer adds a hierarchical source-backed TreeView with native-ready geometry', () => {
  const source = 'window "Files" as main size 640, 260:\n';
  const next = addDesignerControl(source, 'tree');
  assert.match(next, /tree as tree_1 at 24, 24 size 300, 220:/);
  assert.match(next, /node "Root"\n      node "Child 1"\n      node "Child 2"\n    node "Other"/);
  assert.match(next, /window "Files" as main size 640, 268:/);

  const tree = listDesignerControls(next)[0];
  assert.equal(tree.type, 'tree');
  assert.equal(tree.id, 'tree_1');
  assert.deepEqual(tree.treeNodes, [
    {
      labelExpr: '"Root"',
      children: [
        { labelExpr: '"Child 1"', children: [] },
        { labelExpr: '"Child 2"', children: [] }
      ]
    },
    { labelExpr: '"Other"', children: [] }
  ]);
});

test('TreeView Designer edits id and geometry without losing hierarchy', () => {
  const source = `window "Files" as main size 640, 420:
  tree as files at 24, 40 size 300, 220:
    node "src"
      node "compiler.js"
    node "docs"
      node "README.md"

when files changed:
  show value
`;
  const next = updateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, {
    id: 'project_tree', x: 40, y: 64, width: 360, height: 240
  });
  assert.match(next, /tree as project_tree at 40, 64 size 360, 240:/);
  assert.match(next, /node "src"\n      node "compiler.js"/);
  assert.match(next, /when project_tree changed:/);
  assert.doesNotMatch(next, /when files changed:/);
});

test('TreeView Designer deletes the whole hierarchy and matching event block', () => {
  const source = `window "Files":
  tree as files:
    node "src"
      node "compiler.js"
  button "Keep" as keep

when files changed:
  show value
`;
  const next = removeDesignerControl(source, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(next, /tree as files|node "src"|when files changed/);
  assert.match(next, /button "Keep" as keep/);
});

test('TreeView has a professional Designer default size', () => {
  assert.deepEqual(formControlDefaultSize('tree'), { width: 300, height: 220 });
});

test('Patch Studio exposes TreeView plus resizable and collapsible Properties workspace', () => {
  const index = fs.readFileSync('web/index.html', 'utf8');
  const css = fs.readFileSync('web/designer-inspector.css', 'utf8');
  const treeDesigner = fs.readFileSync('web/tree-designer.js', 'utf8');
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');

  assert.match(index, /id="addTree"/);
  assert.match(index, /\.\/tree-designer\.js/);
  assert.match(index, /\.\/designer-workspace\.js/);
  assert.match(css, /--designer-inspector-width: 340px/);
  assert.match(css, /#designer #addTable \{ top: 287px; \}/);
  assert.match(css, /#designer #addTree \{ top: 321px; \}/);
  assert.match(css, /designer-properties-collapsed/);
  assert.match(css, /designer-inspector-resize/);
  assert.match(treeDesigner, /addDesignerControl\(code\.value, 'tree'/);
  assert.match(treeDesigner, /type\.textContent = 'TreeView'/);
  assert.match(workspace, /patch-studio-designer-properties-v1/);
  assert.match(workspace, /setPointerCapture/);
  assert.match(sw, /'\.\/tree-designer\.js'/);
  assert.match(sw, /'\.\/designer-workspace\.js'/);

  execFileSync(process.execPath, ['--check', 'web/tree-designer.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-workspace.js'], { stdio: 'pipe' });
});
