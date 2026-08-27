import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import {
  PATCH_DESIGNER_SHAPE_VERSION,
  addDesignerShape,
  listDesignerShapes,
  updateDesignerShape,
  removeDesignerShape
} from '../src/designer-shape.js';

test('Designer adds a positioned canonical Shape and keeps source parseable', () => {
  const added = addDesignerShape(`window "Shapes" as main size 640, 420:
  button "Save" as save at 24, 24 size 120, 36
`, { windowIndex: 0, shapeKind: 'rounded', cornerRadius: 16 });
  assert.equal(PATCH_DESIGNER_SHAPE_VERSION, '0.1');
  assert.match(added.source, /shape rounded as shape_1 fill #dbeafe stroke #2563eb stroke-width 2 radius 16 opacity 1 at 24, 72 size 180, 120/);
  assert.equal(added.shape.id, 'shape_1');
  assert.equal(added.shape.shapeKind, 'rounded');
  assert.deepEqual({ x: added.shape.x, y: added.shape.y, width: added.shape.width, height: added.shape.height }, { x: 24, y: 72, width: 180, height: 120 });
  assert.doesNotThrow(() => parse(added.source));
});

test('Designer lists hand-written Shape styles through the canonical source codec', () => {
  const shapes = listDesignerShapes(`window "Shapes":
  shape ellipse as badge opacity 0.5 stroke #334155 fill #f8fafc stroke-width 4 at 40, 50 size 160, 90
`);
  assert.equal(shapes.length, 1);
  assert.deepEqual({
    id: shapes[0].id,
    shapeKind: shapes[0].shapeKind,
    fill: shapes[0].fill,
    stroke: shapes[0].stroke,
    strokeWidth: shapes[0].strokeWidth,
    cornerRadius: shapes[0].cornerRadius,
    opacity: shapes[0].opacity
  }, {
    id: 'badge', shapeKind: 'ellipse', fill: '#f8fafc', stroke: '#334155', strokeWidth: 4, cornerRadius: 0, opacity: 0.5
  });
});

test('Designer updates Shape identity style and geometry in one source-backed rewrite', () => {
  const source = `window "Shapes" as main size 640, 420:
  shape rectangle as box fill #dbeafe stroke #2563eb stroke-width 2 radius 0 opacity 1 at 24, 24 size 180, 120
`;
  const current = listDesignerShapes(source)[0];
  const updated = updateDesignerShape(source, current, {
    id: 'hero',
    shapeKind: 'ellipse',
    fill: '#ecfeff',
    stroke: '#0891b2',
    strokeWidth: 5,
    opacity: 0.7,
    x: 32,
    y: 48,
    width: 240,
    height: 160
  });
  assert.match(updated.source, /shape ellipse as hero fill #ecfeff stroke #0891b2 stroke-width 5 radius 0 opacity 0.7 at 32, 48 size 240, 160/);
  assert.equal(updated.shape.id, 'hero');
  assert.equal(updated.shape.shapeKind, 'ellipse');
  assert.doesNotThrow(() => parse(updated.source));
});

test('Designer Shape update fails closed for duplicate ids and unsafe styles', () => {
  const source = `window "Shapes":
  button "Save" as save
  shape rectangle as box
`;
  const shape = listDesignerShapes(source)[0];
  assert.throws(() => updateDesignerShape(source, shape, { id: 'save' }), /already used/);
  assert.throws(() => updateDesignerShape(source, shape, { fill: 'red' }), /six- or eight-digit hex color/);
  assert.throws(() => updateDesignerShape(source, shape, { opacity: 2 }), /finite number from 0 to 1/);
});

test('Designer removes a Shape without touching neighboring source', () => {
  const source = `window "Shapes":
  text "Before"
  shape line as separator stroke #334155 stroke-width 2 opacity 1
  button "After" as after
`;
  const shape = listDesignerShapes(source)[0];
  const next = removeDesignerShape(source, shape);
  assert.doesNotMatch(next, /shape line/);
  assert.match(next, /text "Before"/);
  assert.match(next, /button "After" as after/);
  assert.doesNotThrow(() => parse(next));
});
