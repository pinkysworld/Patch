import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addDesignerShape, listDesignerShapes, updateDesignerShape } from '../src/designer-shape.js';
import { patchComponent } from '../src/component-registry.js';

test('Shape Studio source path remains canonical and source-backed', () => {
  const created = addDesignerShape('window "Demo" as main size 640, 420:\n', { windowIndex: 0 });
  assert.match(created.source, /shape rectangle as shape_1 fill #dbeafe stroke #2563eb stroke-width 2 radius 0 opacity 1 at 24, 24 size 180, 120/);
  const selected = listDesignerShapes(created.source)[0];
  const updated = updateDesignerShape(created.source, selected, {
    shapeKind: 'ellipse',
    fill: '#112233',
    stroke: '#445566',
    strokeWidth: 3,
    opacity: 0.75,
    x: 40,
    y: 56,
    width: 220,
    height: 140
  });
  assert.match(updated.source, /shape ellipse as shape_1 fill #112233 stroke #445566 stroke-width 3 radius 0 opacity 0\.75 at 40, 56 size 220, 140/);
});

test('Shape Studio renderer is wired to the canonical Shape API and shared selection', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  assert.match(workspace, /from '\.\.\/src\/designer-shape\.js'/);
  assert.match(workspace, /patchShapeSvgDescriptor/);
  assert.match(workspace, /id = 'addShape'/);
  assert.match(workspace, /designerShapeKind/);
  assert.match(workspace, /designerShapeFill/);
  assert.match(workspace, /designerShapeStroke/);
  assert.match(workspace, /designerShapeOpacity/);
  assert.match(workspace, /designerShapeWidth/);
  assert.match(workspace, /updateDesignerShape\(code\.value, shape, changes\)/);
  assert.match(workspace, /removeDesignerShape\(code\.value, shape\)/);
  assert.match(workspace, /DESIGNER_SELECTION_EVENT/);
  assert.match(workspace, /patch-shape-resize-handle/);
});

test('Shape Studio, Web and native desktop runtimes are supported on the current Ready line', () => {
  const shape = patchComponent('shape');
  assert.ok(shape);
  assert.equal(shape.targetSupport.studio, 'supported');
  assert.equal(shape.targetSupport.web, 'supported');
  assert.equal(shape.targetSupport.windows, 'supported');
  assert.equal(shape.targetSupport.macos, 'supported');
  assert.equal(shape.targetSupport.linux, 'supported');
});

test('public Studio and offline cache package the canonical Shape designer API', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const worker = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(buildSite, /'designer-shape\.js'/);
  assert.match(worker, /'\.\.\/src\/designer-shape\.js'/);
});
