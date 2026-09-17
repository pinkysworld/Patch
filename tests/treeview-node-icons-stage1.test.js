import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { compile } from '../src/compiler.js';
import { parse } from '../src/parser.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import {
  PATCH_TREE_NODE_IMAGE_VERSION,
  formatPatchTreeNodeDeclaration,
  parsePatchTreeNodeDeclaration,
  parseTreeNodeImageBinding
} from '../src/tree-node-image.js';
import { renameTreeNode, updateDesignerTreeNodes } from '../src/designer-data.js';

const SOURCE = `window "Files" as main:
  imagelist as icons size 16, 16:
    image folder from "patch-resource:icons.folder"
  tree as files at 24, 64 size 320, 240:
    node "src" image icons.folder
      node "index.patch" image icons.folder
    node "README.md"

when files changed:
  show value
`;

const RESOURCE = {
  id: 'icons.folder',
  path: 'resources/folder.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
};

test('TreeView node image source contract is deterministic and optional', () => {
  assert.equal(PATCH_TREE_NODE_IMAGE_VERSION, '0.1');
  assert.deepEqual(parseTreeNodeImageBinding('icons.folder'), { imageListId: 'icons', imageItem: 'folder' });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" image icons.folder'), {
    labelExpr: '"src"', imageListId: 'icons', imageItem: 'folder'
  });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "README.md"'), {
    labelExpr: '"README.md"', imageListId: null, imageItem: null
  });
  assert.equal(formatPatchTreeNodeDeclaration({ labelExpr: '"src"', imageListId: 'icons', imageItem: 'folder' }), 'node "src" image icons.folder');
  assert.throws(() => parseTreeNodeImageBinding('icons'), /ImageList\.item/);
});

test('parser and compiler carry recursive node icons without changing Change IR version', () => {
  const ast = parse(SOURCE);
  const tree = ast[0].body.find(node => node.control === 'tree');
  assert.equal(tree.treeNodes[0].imageListId, 'icons');
  assert.equal(tree.treeNodes[0].imageItem, 'folder');
  assert.equal(tree.treeNodes[0].children[0].imageItem, 'folder');
  assert.equal(tree.treeNodes[1].imageListId, null);

  const compiled = compile(SOURCE, { name: 'TreeIcons', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.tree-node-image'));
  const instruction = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.control === 'tree');
  assert.equal(instruction.treeNodes[0].imageListId, 'icons');
  assert.equal(instruction.treeNodes[0].children[0].imageItem, 'folder');
});

test('Designer Tree rewrites preserve node image metadata', () => {
  const tree = parse(SOURCE)[0].body.find(node => node.control === 'tree');
  const renamed = renameTreeNode(tree.treeNodes, [0], '"source"');
  assert.equal(renamed.nodes[0].imageListId, 'icons');
  assert.equal(renamed.nodes[0].imageItem, 'folder');
  const rewritten = updateDesignerTreeNodes(SOURCE, { windowIndex: 0, controlIndex: 1 }, renamed.nodes);
  assert.match(rewritten, /node "source" image icons\.folder/);
  assert.match(rewritten, /node "index\.patch" image icons\.folder/);
});

test('TreeView node icons are Studio/Web only and Current Ready native fails closed', () => {
  const compiled = compile(SOURCE, { name: 'TreeIcons', kind: 'window' });
  assert.doesNotThrow(() => validateWindowRuntimeSupport(compiled, { allowTree: true, allowTreeNodeImages: true, allowImageList: true }));
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTree: true, allowImageList: true }),
    /TreeView node icons Stage 1.*Studio\/Web only/i
  );
});

test('Standalone Web embeds TreeView node icon resources without changing path changed(value)', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'TreeIcons', kind: 'window', resources: [RESOURCE] });
  assert.equal(built.metadata.treeNodeImageStage, 1);
  assert.equal(built.metadata.treeNodeImageVersion, '0.1');
  assert.match(built.html, /patch-tree-node-icon/);
  assert.match(built.html, /patchPictureSource\(node\.imageSource\)/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:selectedPath\}\)/);
  assert.match(built.html, /icons\.folder/);
});

test('Studio Tree renderer and both structural editors expose the source-backed icon binding', () => {
  const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const nested = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');
  assert.match(renderer, /patch-tree-node-icon/);
  assert.match(renderer, /pictureResourceDataUri/);
  assert.match(editor, /designerTreeNodeImage/);
  assert.match(editor, /setTreeNodeImage/);
  assert.match(nested, /data-tabs-tree-image/);
  assert.match(nested, /setTreeNodeImage/);
});
