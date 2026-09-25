import test from 'node:test';
import assert from 'node:assert/strict';
import { listDesignerControls } from '../src/designer.js';
import { moveTreeNode, renameTreeNode, updateDesignerTreeNodes } from '../src/designer-data.js';
import { listDesignerTabPageControls, updateDesignerTabPageTreeNodes } from '../src/designer-tabs-nested.js';
import { PatchTreeNodePresentationError, parsePatchTreeNodeDeclaration } from '../src/tree-node-presentation.js';

const WINDOW = `window "Files" as main size 560, 360:
  tree as files at 24, 72 size 360, 220:
    node "src" image tree_icons.folder hint "Source folder" state success
      node "parser.js" image tree_icons.file hint "Parser implementation" state warning
    node "docs" hint "Documentation" state muted
`;

const TABS = `window "Settings" as main size 640, 420:
  tabs as settings at 24, 64 size 500, 280:
    tab "General":
      tree as sections:
        node "src" image tree_icons.folder hint "Source folder" state success
          node "parser.js" hint "Parser implementation" state warning
        node "docs" state muted
    tab "Advanced":
      text "Advanced"
`;

function treeOf(source) {
  return listDesignerControls(source).find(control => control.type === 'tree');
}

test('malformed TreeView node clauses fail closed and the full form still parses', () => {
  const bad = [
    'node "src" image nope',
    'node "src" state warning hint "x"',
    'node "src" hint "Hello" image tree_icons.folder'
  ];
  for (const sample of bad) {
    assert.throws(() => parsePatchTreeNodeDeclaration(sample), error => {
      assert.ok(error instanceof PatchTreeNodePresentationError);
      if (sample.endsWith('image nope')) {
        assert.ok(error.code === 'TREE_NODE_IMAGE_SYNTAX' || error.code === 'TREE_NODE_SOURCE_SYNTAX');
      } else {
        assert.equal(error.code, 'TREE_NODE_SOURCE_SYNTAX');
        assert.match(error.message, /TreeView node syntax is node/);
      }
      return true;
    });
  }
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" image tree_icons.folder hint "Source folder" state warning'), {
    labelExpr: '"src"',
    imageListId: 'tree_icons',
    imageItem: 'folder',
    hint: 'Source folder',
    state: 'warning'
  });
});

test('listDesignerControls keeps image, hint, and state on a node and its child', () => {
  const tree = treeOf(WINDOW);
  const root = tree.treeNodes[0];
  const child = root.children[0];
  assert.equal(root.labelExpr, '"src"');
  assert.equal(root.imageListId, 'tree_icons');
  assert.equal(root.imageItem, 'folder');
  assert.equal(root.hint, 'Source folder');
  assert.equal(root.state, 'success');
  assert.equal(child.labelExpr, '"parser.js"');
  assert.equal(child.imageListId, 'tree_icons');
  assert.equal(child.imageItem, 'file');
  assert.equal(child.hint, 'Parser implementation');
  assert.equal(child.state, 'warning');
  assert.equal(tree.treeNodes[1].hint, 'Documentation');
  assert.equal(tree.treeNodes[1].state, 'muted');
});

test('move and rename keep hint and state through updateDesignerTreeNodes', () => {
  const tree = treeOf(WINDOW);
  const renamed = renameTreeNode(tree.treeNodes, [0], '"library"');
  const moved = moveTreeNode(renamed.nodes, [1], 'up');
  const next = updateDesignerTreeNodes(WINDOW, tree, moved.nodes);
  const updated = treeOf(next);
  const docs = updated.treeNodes[0];
  const library = updated.treeNodes[1];
  const child = library.children[0];

  assert.equal(docs.labelExpr, '"docs"');
  assert.equal(docs.hint, 'Documentation');
  assert.equal(docs.state, 'muted');
  assert.equal(library.labelExpr, '"library"');
  assert.equal(library.imageListId, 'tree_icons');
  assert.equal(library.imageItem, 'folder');
  assert.equal(library.hint, 'Source folder');
  assert.equal(library.state, 'success');
  assert.equal(child.labelExpr, '"parser.js"');
  assert.equal(child.imageListId, 'tree_icons');
  assert.equal(child.imageItem, 'file');
  assert.equal(child.hint, 'Parser implementation');
  assert.equal(child.state, 'warning');
  assert.match(next, /node "docs" hint "Documentation" state muted/);
  assert.match(next, /node "library" image tree_icons\.folder hint "Source folder" state success/);
  assert.match(next, /node "parser\.js" image tree_icons\.file hint "Parser implementation" state warning/);
});

test('nested Tabs TreeView update round-trips hint and state', () => {
  const tabs = listDesignerControls(TABS).find(control => control.type === 'tabs');
  const nested = listDesignerTabPageControls(TABS, tabs, 0).find(control => control.type === 'tree');
  assert.equal(nested.treeNodes[0].hint, 'Source folder');
  assert.equal(nested.treeNodes[0].state, 'success');
  assert.equal(nested.treeNodes[0].imageListId, 'tree_icons');
  assert.equal(nested.treeNodes[0].children[0].hint, 'Parser implementation');
  assert.equal(nested.treeNodes[0].children[0].state, 'warning');
  assert.equal(nested.treeNodes[1].state, 'muted');

  const renamed = renameTreeNode(nested.treeNodes, [1], '"notes"');
  const next = updateDesignerTabPageTreeNodes(TABS, tabs, 0, nested.controlIndex, renamed.nodes);
  assert.match(next, /node "src" image tree_icons\.folder hint "Source folder" state success/);
  assert.match(next, /node "parser\.js" hint "Parser implementation" state warning/);
  assert.match(next, /node "notes" state muted/);
  assert.match(next, /tab "Advanced":\n      text "Advanced"/);

  const reread = listDesignerTabPageControls(next, listDesignerControls(next).find(control => control.type === 'tabs'), 0)
    .find(control => control.type === 'tree');
  assert.equal(reread.treeNodes[0].hint, 'Source folder');
  assert.equal(reread.treeNodes[0].state, 'success');
  assert.equal(reread.treeNodes[0].children[0].hint, 'Parser implementation');
  assert.equal(reread.treeNodes[0].children[0].state, 'warning');
  assert.equal(reread.treeNodes[1].labelExpr, '"notes"');
  assert.equal(reread.treeNodes[1].state, 'muted');
  assert.equal(reread.treeNodes[1].hint, undefined);
});
