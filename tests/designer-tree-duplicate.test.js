import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import { updateDesignerTreeNodes } from '../src/designer-data.js';
import { listDesignerTabPageControls, updateDesignerTabPageTreeNodes } from '../src/designer-tabs-nested.js';
import { duplicateTreeSubtree } from '../web/designer-tree-model.js';

const nodes = [
  { labelExpr: '"src"', children: [
    { labelExpr: '"compiler.js"', children: [] },
    { labelExpr: '"parser"', children: [{ labelExpr: '"tokens"', children: [] }] }
  ] },
  { labelExpr: '"docs"', children: [] }
];

test('Duplicate subtree copies the complete hierarchy beside the selected node', () => {
  const result = duplicateTreeSubtree(nodes, [0, 1]);
  assert.deepEqual(result.path, [0, 2]);
  assert.equal(result.nodes[0].children.length, 3);
  assert.deepEqual(result.nodes[0].children[1], result.nodes[0].children[2]);
  assert.equal(result.nodes[0].children[2].children[0].labelExpr, '"tokens"');
});

test('Duplicate subtree is a deep independent copy and never mutates input nodes', () => {
  const result = duplicateTreeSubtree(nodes, [0]);
  result.nodes[1].labelExpr = '"changed"';
  result.nodes[1].children[0].labelExpr = '"changed child"';
  assert.equal(result.nodes[0].labelExpr, '"src"');
  assert.equal(result.nodes[0].children[0].labelExpr, '"compiler.js"');
  assert.equal(nodes[0].labelExpr, '"src"');
  assert.equal(nodes[0].children[0].labelExpr, '"compiler.js"');
});

test('Duplicate subtree fails closed for empty trees, malformed nodes and invalid paths', () => {
  assert.throws(() => duplicateTreeSubtree([], [0]), /at least one node/);
  assert.throws(() => duplicateTreeSubtree([{ labelExpr: '', children: [] }], [0]), /label cannot be empty/);
  assert.throws(() => duplicateTreeSubtree(nodes, []), /selection is invalid/);
  assert.throws(() => duplicateTreeSubtree(nodes, [9]), /selection is invalid/);
  assert.throws(() => duplicateTreeSubtree(nodes, [0, 9]), /selection is invalid/);
});

test('top-level TreeView duplicate remains ordinary parseable source', () => {
  const source = `window "Files" as main size 560, 380:\n  tree as files at 24, 56 size 300, 240:\n    node "src"\n      node "compiler.js"\n      node "parser.js"\n    node "docs"\n`;
  const tree = listDesignerControls(source).find(control => control.type === 'tree');
  const result = duplicateTreeSubtree(tree.treeNodes, [0]);
  const next = updateDesignerTreeNodes(source, tree, result.nodes);
  assert.doesNotThrow(() => parse(next));
  assert.match(next, /node "src"\n      node "compiler\.js"\n      node "parser\.js"\n    node "src"\n      node "compiler\.js"\n      node "parser\.js"\n    node "docs"/);
});

test('nested TreeView duplicate uses the same model and stays parseable', () => {
  const source = `window "Settings" as main size 640, 420:\n  tabs as settings at 24, 64 size 500, 280:\n    tab "General":\n      tree as sections:\n        node "Security"\n          node "Keys"\n        node "Network"\n    tab "Advanced":\n      text "Advanced"\n`;
  const tabs = listDesignerControls(source).find(control => control.type === 'tabs');
  const tree = listDesignerTabPageControls(source, tabs, 0).find(control => control.type === 'tree');
  const result = duplicateTreeSubtree(tree.treeNodes, [0, 0]);
  const next = updateDesignerTabPageTreeNodes(source, tabs, 0, tree.controlIndex, result.nodes);
  assert.doesNotThrow(() => parse(next));
  assert.match(next, /node "Security"\n          node "Keys"\n          node "Keys"\n        node "Network"/);
  assert.match(next, /tab "Advanced":\n      text "Advanced"/);
});

test('TreeView Duplicate UI is shared, idempotent and packaged without runtime-layer changes', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const web = fs.readFileSync('web/designer-tree-duplicate.js', 'utf8');
  const model = fs.readFileSync('web/designer-tree-model.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');

  assert.match(workspace, /import '\.\/designer-tree-duplicate\.js'/);
  assert.match(web, /updateDesignerTreeNodes/);
  assert.match(web, /updateDesignerTabPageTreeNodes/);
  assert.match(web, /data-tree-duplicate-subtree/);
  assert.match(web, /actions\.querySelector\('\[data-tree-duplicate-subtree\]'\)/);
  assert.match(web, /duplicateTreeSubtree/);
  assert.doesNotMatch(web, /localStorage|sessionStorage|Change History/);
  assert.match(model, /function cloneNode/);
  assert.match(build, /designer-tree-model\.js/);
  assert.match(build, /designer-tree-duplicate\.js/);
  assert.match(sw, /'\.\/designer-tree-model\.js'/);
  assert.match(sw, /'\.\/designer-tree-duplicate\.js'/);

  execFileSync(process.execPath, ['--check', 'web/designer-tree-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-tree-duplicate.js'], { stdio: 'pipe' });
});
