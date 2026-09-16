import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import {
  PATCH_TREE_NODE_IMAGE_VERSION,
  formatPatchTreeNodeDeclaration,
  parsePatchTreeNodeDeclaration,
  resolveTreeNodeImageBinding
} from '../src/tree-node-image.js';

const SOURCE = `window "Files" as main:
  imagelist as tree_images size 16, 16:
    image folder from "patch-resource:icons.folder"
    image file from "patch-resource:icons.file"
  tree as files at 24, 64 size 320, 220:
    node "src" image tree_images.folder
      node "parser.js" image tree_images.file
    node "README.md" image tree_images.file

when files changed:
  show value
`;

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const PNG_SHA256 = 'd126d616641d42ac8b0a07ec302c9fa1ec049f86200931a0a60c8f3080284b77';
const RESOURCES = [
  { id: 'icons.folder', path: 'assets/tree-folder.png', mediaType: 'image/png', size: 68, sha256: PNG_SHA256, data: PNG },
  { id: 'icons.file', path: 'assets/tree-file.png', mediaType: 'image/png', size: 68, sha256: PNG_SHA256, data: PNG }
];

test('TreeView node image syntax is local, deterministic and versioned', () => {
  assert.equal(PATCH_TREE_NODE_IMAGE_VERSION, '0.1');
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" image tree_images.folder'), {
    labelExpr: '"src"', imageListId: 'tree_images', imageItem: 'folder'
  });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "plain"'), {
    labelExpr: '"plain"', imageListId: null, imageItem: null
  });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "text with image inside"'), {
    labelExpr: '"text with image inside"', imageListId: null, imageItem: null
  });
  assert.equal(formatPatchTreeNodeDeclaration({ labelExpr: '"src"', imageListId: 'tree_images', imageItem: 'folder' }), 'node "src" image tree_images.folder');
  assert.throws(() => parsePatchTreeNodeDeclaration('node "src" image missing-binding'), /ImageList\.item/);
});

test('TreeView icons stay out of Change IR while remaining in the Window AST', () => {
  const compiled = compile(SOURCE, { kind: 'window', name: 'TreeIcons' });
  assert.equal(compiled.ir.version, '0.10');
  const tree = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'tree');
  assert.equal(tree.treeNodes[0].imageListId, 'tree_images');
  assert.equal(tree.treeNodes[0].children[0].imageItem, 'file');
  const loweredTree = compiled.ir.instructions.find(item => item.code === 'WINDOW').body.find(item => item.control === 'tree');
  assert.equal(loweredTree.treeNodes[0].imageListId, undefined);
  assert.equal(loweredTree.treeNodes[0].imageItem, undefined);
});

test('TreeView node image references resolve through the existing ImageList contract', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  const windowNode = compiled.ast.find(node => node.kind === 'window');
  const lists = new Map(windowNode.body.filter(node => node.control === 'imagelist').map(node => [node.id, node]));
  const tree = windowNode.body.find(node => node.control === 'tree');
  const resolved = resolveTreeNodeImageBinding(lists, tree.treeNodes[0], tree.treeNodes[0].line);
  assert.equal(resolved.resourceId, 'icons.folder');
  assert.equal(resolved.width, 16);
  assert.equal(resolved.height, 16);
});

test('TreeView icons are Studio/Web only and desktop Current Ready fails closed', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  assert.doesNotThrow(() => validateWindowRuntimeSupport(compiled, { allowTree: true, allowTreeImages: true, allowImageList: true }));
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTree: true, allowImageList: true }),
    /TreeView node images Stage 1.*Studio\/Web only/i
  );
});

test('Standalone Web embeds TreeView icons without changing changed(value) path semantics', () => {
  const built = buildStandaloneWebApp(SOURCE, { kind: 'window', name: 'Tree Icons', resources: RESOURCES });
  assert.equal(built.metadata.treeNodeImageStage, 1);
  assert.equal(built.metadata.treeNodeImageVersion, '0.1');
  assert.match(built.html, /patch-tree-node-icon/);
  assert.match(built.html, /patchPictureSource\(node\.imageSource\)/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:selectedPath\}\)/);
});

test('Designer Tree model preserves image binding through structural actions', () => {
  const model = fs.readFileSync('src/designer-data.js', 'utf8');
  const nested = fs.readFileSync('src/designer-tabs-nested.js', 'utf8');
  const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  assert.match(model, /imageListId/);
  assert.match(model, /imageItem/);
  assert.match(model, /formatPatchTreeNodeDeclaration/);
  assert.match(nested, /imageListId/);
  assert.match(renderer, /patch-tree-node-icon/);
});
