import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import {
  PATCH_TREE_NODE_STATES,
  PATCH_TREE_NODE_STATE_VERSION,
  formatPatchTreeNodeDeclaration,
  normalizeTreeNodeState,
  parsePatchTreeNodeDeclaration
} from '../src/tree-node-presentation.js';
import {
  setTreeNodeState,
  updateDesignerTreeNodes
} from '../src/designer-data.js';
import { duplicateTreeSubtree } from '../web/designer-tree-model.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWindowWebApp } from '../src/window-webapp.js';

const SOURCE = `create list selected = []

window "Files" as main size 560, 360:
  tree as files at 24, 72 size 360, 220:
    node "src" state success
      node "parser.js" state warning
    node "docs" state muted

when files changed:
  change selected:
    set = value
`;

test('TreeView node state syntax is bounded, deterministic and composable', () => {
  assert.equal(PATCH_TREE_NODE_STATE_VERSION, '0.1');
  assert.deepEqual(PATCH_TREE_NODE_STATES, ['muted', 'info', 'success', 'warning', 'danger']);
  assert.equal(normalizeTreeNodeState('WARNING'), 'warning');
  assert.equal(normalizeTreeNodeState(''), null);
  assert.throws(() => normalizeTreeNodeState('disabled'), /must be one of/i);

  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" state success'), {
    labelExpr: '"src"',
    imageListId: null,
    imageItem: null,
    state: 'success'
  });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" image tree_icons.folder hint "Source folder" state warning'), {
    labelExpr: '"src"',
    imageListId: 'tree_icons',
    imageItem: 'folder',
    hint: 'Source folder',
    state: 'warning'
  });
  assert.equal(
    formatPatchTreeNodeDeclaration({
      labelExpr: '"src"',
      imageListId: 'tree_icons',
      imageItem: 'folder',
      hint: 'Source folder',
      state: 'danger'
    }),
    'node "src" image tree_icons.folder hint "Source folder" state danger'
  );
});

test('compiler and interpreter preserve node state without changing selected path semantics', () => {
  const compiled = compile(SOURCE, { kind: 'window', name: 'TreeState' });
  const tree = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'tree');
  assert.equal(tree.treeNodes[0].state, 'success');
  assert.equal(tree.treeNodes[0].children[0].state, 'warning');
  assert.equal(tree.treeNodes[1].state, 'muted');

  const treeIr = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.control === 'tree');
  assert.equal(treeIr.treeNodes[0].state, 'success');
  assert.equal(treeIr.treeNodes[0].children[0].state, 'warning');

  const result = new PatchInterpreter().run(SOURCE);
  const model = result.ui[0].controls.find(control => control.type === 'tree');
  assert.equal(model.nodes[0].state, 'success');
  assert.equal(model.nodes[0].children[0].state, 'warning');
  assert.deepEqual(result.state.selected, []);
});

test('TreeView node state presentation is Web-enabled and Current Ready native fail-closed', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTree: true }),
    /TreeView node state presentation Stage 3.*Studio\/Web only/i
  );

  const support = validateWindowRuntimeSupport(compiled, { allowTree: true, allowTreeNodeStates: true });
  assert.equal(support.treeNodeStates, 3);

  const built = buildStandaloneWindowWebApp(compiled, 'Tree State');
  assert.equal(built.metadata.treeNodeStateStage, 3);
  assert.equal(built.metadata.treeNodeStateVersion, '0.1');
  assert.equal(built.metadata.treeNodeStateCount, 3);
  assert.match(built.html, /patch-tree-node-state/);
  assert.match(built.html, /patchTreeState=node\.state/);
  assert.match(built.html, /aria-description','Node state: '/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:selectedPath\}\)/);
});

test('Designer state editing and subtree duplication stay source-backed', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  const tree = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'tree');

  const edited = setTreeNodeState(tree.treeNodes, [0, 0], 'danger');
  const rewritten = updateDesignerTreeNodes(SOURCE, { windowIndex: 0, controlIndex: 0 }, edited.nodes);
  assert.match(rewritten, /node "parser\.js" state danger/);
  assert.doesNotThrow(() => compile(rewritten, { kind: 'window' }));

  const duplicated = duplicateTreeSubtree(edited.nodes, [0]);
  assert.equal(duplicated.nodes[1].state, 'success');
  assert.equal(duplicated.nodes[1].children[0].state, 'danger');
});

test('Studio renderer, structural editors and styles expose state presentation', () => {
  const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const nested = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');
  const keyboard = fs.readFileSync('web/designer-structural-keyboard.js', 'utf8');
  const style = fs.readFileSync('web/style.css', 'utf8');

  assert.match(renderer, /patchTreeState = node\.state/);
  assert.match(renderer, /patch-tree-node-state/);
  assert.match(renderer, /aria-description/);
  assert.match(editor, /designerTreeNodeState/);
  assert.match(editor, /setTreeNodeState/);
  assert.match(nested, /data-tabs-tree-state/);
  assert.match(nested, /setTreeNodeState/);
  assert.match(keyboard, /designerTreeNodeState/);
  assert.match(keyboard, /data-tabs-tree-state/);
  for (const state of PATCH_TREE_NODE_STATES) assert.match(style, new RegExp(`data-patch-tree-state="${state}"`));
});
