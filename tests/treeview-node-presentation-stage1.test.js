import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import {
  PATCH_TREE_NODE_PRESENTATION_VERSION,
  formatPatchTreeNodeDeclaration,
  parsePatchTreeNodeDeclaration,
  parseTreeNodeImageBinding
} from '../src/tree-node-presentation.js';
import {
  renameTreeNode,
  setTreeNodeImage,
  updateDesignerTreeNodes
} from '../src/designer-data.js';

const SOURCE = `create list selected = []

window "Files" as main size 560, 360:
  imagelist as tree_icons size 16, 16:
    image folder from "patch-resource:icons.folder"
    image file from "patch-resource:icons.file"
  tree as files at 24, 72 size 360, 220:
    node "src" image tree_icons.folder
      node "compiler.js" image tree_icons.file
      node "parser.js" image tree_icons.file
    node "docs" image tree_icons.folder

when files changed:
  change selected:
    set = value
`;

const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=';
const PIXEL_SHA256 = '98884e721ec2f605f3788f2bc39a61de305ff4f4fcaf26b6f4eabeebcd6c0fb4';
const RESOURCES = [
  { id: 'icons.folder', path: 'assets/tree-folder.png', mediaType: 'image/png', size: 68, sha256: PIXEL_SHA256, data: PIXEL },
  { id: 'icons.file', path: 'assets/tree-file.png', mediaType: 'image/png', size: 68, sha256: PIXEL_SHA256, data: PIXEL }
];

test('TreeView node presentation 0.1 has deterministic optional ImageList.item syntax', () => {
  assert.equal(PATCH_TREE_NODE_PRESENTATION_VERSION, '0.1');
  assert.deepEqual(parseTreeNodeImageBinding('tree_icons.folder'), { imageListId: 'tree_icons', imageItem: 'folder' });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "src" image tree_icons.folder'), {
    labelExpr: '"src"', imageListId: 'tree_icons', imageItem: 'folder'
  });
  assert.deepEqual(parsePatchTreeNodeDeclaration('node "plain"'), {
    labelExpr: '"plain"', imageListId: null, imageItem: null
  });
  assert.equal(formatPatchTreeNodeDeclaration({ labelExpr: '"src"', imageListId: 'tree_icons', imageItem: 'folder' }), 'node "src" image tree_icons.folder');
  assert.throws(() => parseTreeNodeImageBinding('tree_icons'), /ImageList\.item/);
});

test('compiler and interpreter preserve TreeView node images without changing selected path semantics', () => {
  const compiled = compile(SOURCE, { kind: 'window', name: 'TreeNodeImages' });
  assert.equal(compiled.ir.version, '0.10');
  const tree = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'tree');
  assert.equal(tree.treeNodes[0].imageListId, 'tree_icons');
  assert.equal(tree.treeNodes[0].imageItem, 'folder');
  assert.equal(tree.treeNodes[0].children[0].imageItem, 'file');
  const treeIr = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.control === 'tree');
  assert.equal(treeIr.treeNodes[0].imageItem, 'folder');

  const runtime = new PatchInterpreter();
  const result = runtime.run(SOURCE);
  const model = result.ui[0].controls.find(control => control.type === 'tree');
  assert.equal(model.nodes[0].imageSource, 'patch-resource:icons.folder');
  assert.equal(model.nodes[0].imageWidth, 16);
  assert.equal(model.nodes[0].children[0].imageSource, 'patch-resource:icons.file');
  assert.deepEqual(result.state.selected, []);
});

test('TreeView node images validate ImageList bindings and fail closed on Current Ready native', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  const support = validateWindowRuntimeSupport(compiled, {
    allowTree: true,
    allowImageList: true,
    allowTreeNodeImages: true
  });
  assert.equal(support.treeNodeImages, 4);
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTree: true, allowImageList: true }),
    /TreeView node images Stage 1.*Studio\/Web only/i
  );

  const missing = compile(SOURCE.replace('tree_icons.folder', 'tree_icons.missing'), { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(missing, { allowTree: true, allowImageList: true, allowTreeNodeImages: true }),
    /ImageList item 'missing'/
  );
});

test('Designer tree mutations preserve and edit source-backed node image metadata', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  const tree = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'tree');
  let result = renameTreeNode(tree.treeNodes, [0, 0], '"compiler.ts"');
  result = setTreeNodeImage(result.nodes, result.path, 'tree_icons.folder');
  const rewritten = updateDesignerTreeNodes(SOURCE, { windowIndex: 0, controlIndex: 1 }, result.nodes);
  assert.match(rewritten, /node "src" image tree_icons\.folder/);
  assert.match(rewritten, /node "compiler\.ts" image tree_icons\.folder/);
  assert.match(rewritten, /node "parser\.js" image tree_icons\.file/);
  assert.doesNotThrow(() => compile(rewritten, { kind: 'window' }));
});

test('Studio and Standalone Web render TreeView node icons without changing changed(value)', () => {
  const built = buildStandaloneWebApp(SOURCE, { kind: 'window', name: 'TreeNodeImages', resources: RESOURCES });
  assert.equal(built.metadata.treeNodePresentationStage, 1);
  assert.equal(built.metadata.treeNodePresentationVersion, '0.1');
  assert.match(built.html, /patch-tree-node-image/);
  assert.match(built.html, /imageSource/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:selectedPath\}\)/);
  assert.match(built.html, /patchPictureSource/);
  assert.match(built.html, /"icons\.folder":\{"mediaType":"image\/png","data":"iVBOR/);

  const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  assert.match(renderer, /patch-tree-node-image/);
  assert.match(renderer, /pictureResourceDataUri\(node\.imageSource/);
  assert.match(renderer, /context\.dispatch\(control\.id, 'changed', \{ value: selectedPath \}\)/);
});

test('TreeView editors expose source-backed node image fields for top-level and nested trees', () => {
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const nested = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');
  assert.match(editor, /designerTreeNodeImage/);
  assert.match(editor, /setTreeNodeImage/);
  assert.match(nested, /data-tabs-tree-image/);
  assert.match(nested, /setTreeNodeImage/);
});
