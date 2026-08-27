import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, PatchSyntaxError } from '../src/parser.js';
import { formControlDefaultSize } from '../src/form-layout.js';
import { patchComponent } from '../src/component-registry.js';

test('Shape Stage 1 parses canonical style and source-backed geometry', () => {
  const ast = parse(`window "Shapes" as main size 640, 420:
  shape rounded as card fill #dbeafe stroke #2563eb stroke-width 3 radius 18 opacity 0.75 at 24, 32 size 220, 140
`);
  const shape = ast[0].body[0];
  assert.equal(shape.kind, 'uiControl');
  assert.equal(shape.control, 'shape');
  assert.equal(shape.id, 'card');
  assert.equal(shape.shapeKind, 'rounded');
  assert.equal(shape.fill, '#dbeafe');
  assert.equal(shape.stroke, '#2563eb');
  assert.equal(shape.strokeWidth, 3);
  assert.equal(shape.cornerRadius, 18);
  assert.equal(shape.opacity, 0.75);
  assert.deepEqual(shape.layout, { x: 24, y: 32, width: 220, height: 140 });
});

test('Shape Stage 1 concise source uses the canonical normalization defaults', () => {
  const shape = parse(`window "Shapes":
  shape ellipse as badge
`)[0].body[0];
  assert.equal(shape.shapeKind, 'ellipse');
  assert.equal(shape.fill, '#dbeafe');
  assert.equal(shape.stroke, '#2563eb');
  assert.equal(shape.strokeWidth, 2);
  assert.equal(shape.cornerRadius, 0);
  assert.equal(shape.opacity, 1);
  assert.deepEqual(formControlDefaultSize('shape'), { width: 180, height: 120 });
});

test('Shape Stage 1 parser preserves exact Patch source line on invalid style', () => {
  assert.throws(
    () => parse(`create number n = 1
window "Shapes":
  shape rectangle as bad fill red
`),
    error => error instanceof PatchSyntaxError && error.line === 3 && /six- or eight-digit hex color/.test(error.message)
  );
});

test('Shape Stage 1 target claims expose Web rendering but keep native targets fail-closed', () => {
  const shape = patchComponent('shape');
  assert.equal(shape.targetSupport.studio, 'authoring');
  assert.equal(shape.targetSupport.web, 'supported');
  assert.equal(shape.targetSupport.windows, 'unsupported');
  assert.equal(shape.targetSupport.macos, 'unsupported');
  assert.equal(shape.targetSupport.linux, 'unsupported');
});
