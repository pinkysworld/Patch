import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import {
  PATCH_TREE_NODE_HINT_VERSION,
  formatPatchTreeNodeDeclaration,
  parsePatchTreeNodeDeclaration,
  parseTreeNodeHintLiteral
} from '../src/tree-node-presentation.js';
import {
  setTreeNodeHint,
  updateDesignerTreeNodes
} from '../src/designer-data.js';
import { duplicateTreeSubtree } from '../web/designer-tree-model.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWindowWebApp } from '../src/window-webapp.js';

const SOURCE = `create list selected = []

window "Files" as main size 560, 360:
  tree as files at 24, 72 size 360, 220:
    node "src" hint "Source folder"
      node "parser.js" hint "Parser implementation"
    node "docs"

when files changed:
  change selected:
    set = value
`;

test('TreeView node hint syntax is deterministic and backward-compatible', () => {
  assert.equal(PATCH_TREE_NODE_HINT_VERSION, '0.1');
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" hint "Source folder"'), {
    labelExpr: '"src"',
    imageListId: null,
    imageItem: null,
    hint: 'Source folder'
  });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" image tree_icons.folder hint "Source folder"'), {
    labelExpr: '"src"',
    imageListId: 'tree_icons',
    imageItem: 'folder',
    hint: 'Source folder'
  });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "plain"'), {
    labelExpr: '"plain"',
    imageListId: null,
    imageItem: null
  });
  assert.equal(
    formatPatchTreeNodeDeclaration({ labelExpr: '"src"', imageListId: 'tree_icons', imageItem: 'folder', hint: 'Source folder' }),
    'node "src" image tree_icons.folder hint "Source folder"'
  );
  assert.equal(parseTreeNodeHintLiteral('"Line 1\\nLine 2"'), 'Line 1\nLine 2');
  assert.throws(() => parseTreeNodeHintLiteral('not-quoted'), /quoted text literal/i);
  assert.throws(() => parseTreeNodeHintLiteral('""'), /non-empty quoted text/i);
});

test('compiler and interpreter preserve TreeView hints without changing path values', () => {
  const compiled = compile(SOURCE, { kind: 'window', name: 'TreeHints' });
  const tree = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'tree');
  assert.equal(tree.treeNodes[0].hint, 'Source folder');
  assert.equal(tree.treeNodes[0].children[0].hint, 'Parser implementation');
  assert.equal(tree.treeNodes[1].hint, undefined);

  const treeIr = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.control === 'tree');
  assert.equal(treeIr.treeNodes[0].hint, 'Source folder');
  assert.equal(treeIr.treeNodes[1].hint, undefined);

  const result = new PatchInterpreter().run(SOURCE);
  const model = result.ui[0].controls.find(control => control.type === 'tree');
  assert.equal(model.nodes[0].hint, 'Source folder');
  assert.equal(model.nodes[0].children[0].hint, 'Parser implementation');
  assert.deepEqual(model.nodes[1], { text: 'docs', children: [] });
  assert.deepEqual(result.state.selected, []);
});

test('TreeView node hints fail closed on Current Ready native but are enabled for Web', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTree: true }),
    /TreeView node hints Stage 2.*Studio\/Web only/i
  );
  const support = validateWindowRuntimeSupport(compiled, { allowTree: true, allowTreeNodeHints: true });
  assert.equal(support.treeNodeHints, 2);

  const built = buildStandaloneWindowWebApp(compiled, 'Tree Hints');
  assert.equal(built.metadata.treeNodeHintStage, 2);
  assert.equal(built.metadata.treeNodeHintVersion, '0.1');
  assert.equal(built.metadata.treeNodeHintCount, 2);
  assert.match(built.html, /button\.title=node\.hint/);
  assert.match(built.html, /patchTreeHint='true'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:selectedPath\}\)/);
});

test('Designer edits and subtree duplication preserve source-backed TreeView hints', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  const tree = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'tree');

  const edited = setTreeNodeHint(tree.treeNodes, [0, 0], 'Updated parser tooltip');
  const rewritten = updateDesignerTreeNodes(SOURCE, { windowIndex: 0, controlIndex: 0 }, edited.nodes);
  assert.match(rewritten, /node "parser\.js" hint "Updated parser tooltip"/);
  assert.doesNotThrow(() => compile(rewritten, { kind: 'window' }));

  const duplicated = duplicateTreeSubtree(edited.nodes, [0]);
  assert.equal(duplicated.nodes[1].hint, 'Source folder');
  assert.equal(duplicated.nodes[1].children[0].hint, 'Updated parser tooltip');
});

test('Studio TreeView renderer and structural editors expose node hints', () => {
  const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const nested = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');
  const keyboard = fs.readFileSync('web/designer-structural-keyboard.js', 'utf8');

  assert.match(renderer, /button\.title = node\.hint/);
  assert.match(renderer, /patchTreeHint = 'true'/);
  assert.match(editor, /designerTreeNodeHint/);
  assert.match(editor, /setTreeNodeHint/);
  assert.match(nested, /data-tabs-tree-hint/);
  assert.match(nested, /setTreeNodeHint/);
  assert.match(keyboard, /designerTreeNodeHint/);
  assert.match(keyboard, /data-tabs-tree-hint/);
});
