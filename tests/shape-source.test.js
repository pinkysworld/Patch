import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_SHAPE_SOURCE_VERSION,
  parsePatchShapeDeclaration,
  formatPatchShapeDeclaration,
  updatePatchShapeDeclaration
} from '../src/shape-source.js';

test('Shape source codec parses concise declarations using canonical defaults', () => {
  assert.equal(PATCH_SHAPE_SOURCE_VERSION, '0.1');
  assert.deepEqual(parsePatchShapeDeclaration('shape rectangle as box'), {
    id: 'box',
    kind: 'rectangle',
    fill: '#dbeafe',
    stroke: '#2563eb',
    strokeWidth: 2,
    cornerRadius: 0,
    opacity: 1
  });
});

test('Shape source codec accepts style properties in any order and normalizes them', () => {
  assert.deepEqual(
    parsePatchShapeDeclaration('shape rounded as card opacity 0.75 radius 18 stroke #12345678 fill #ABCDEF stroke-width 3'),
    {
      id: 'card',
      kind: 'rounded',
      fill: '#abcdef',
      stroke: '#12345678',
      strokeWidth: 3,
      cornerRadius: 18,
      opacity: 0.75
    }
  );
});

test('Shape source formatter writes one complete deterministic declaration', () => {
  assert.equal(
    formatPatchShapeDeclaration({
      id: 'separator',
      kind: 'line',
      fill: '#ffffff',
      stroke: '#334155',
      strokeWidth: 4,
      cornerRadius: 99,
      opacity: 0.5
    }),
    'shape line as separator fill transparent stroke #334155 stroke-width 4 radius 0 opacity 0.5'
  );
});

test('Shape source updates round-trip through the canonical normalization layer', () => {
  const source = updatePatchShapeDeclaration(
    'shape rounded as card fill #dbeafe stroke #2563eb stroke-width 2 radius 12 opacity 1',
    { kind: 'ellipse', opacity: 0.4, strokeWidth: 5 }
  );
  assert.equal(source, 'shape ellipse as card fill #dbeafe stroke #2563eb stroke-width 5 radius 0 opacity 0.4');
  assert.deepEqual(parsePatchShapeDeclaration(source), {
    id: 'card',
    kind: 'ellipse',
    fill: '#dbeafe',
    stroke: '#2563eb',
    strokeWidth: 5,
    cornerRadius: 0,
    opacity: 0.4
  });
});

test('Shape source fails closed for unknown, duplicate or unsafe properties and invalid names', () => {
  assert.throws(() => parsePatchShapeDeclaration('shape triangle as x'), error => error?.code === 'SHAPE_SOURCE_SYNTAX');
  assert.throws(() => parsePatchShapeDeclaration('shape rectangle as x blur 4'), error => error?.code === 'SHAPE_SOURCE_PROPERTY');
  assert.throws(() => parsePatchShapeDeclaration('shape rectangle as x opacity 1 opacity 0.5'), error => error?.code === 'SHAPE_SOURCE_DUPLICATE_PROPERTY');
  assert.throws(() => parsePatchShapeDeclaration('shape rectangle as x fill red'), error => error?.code === 'SHAPE_COLOR');
  assert.throws(() => parsePatchShapeDeclaration('shape rectangle as x opacity nope'), error => error?.code === 'SHAPE_SOURCE_NUMBER');
  assert.throws(() => formatPatchShapeDeclaration({ id: 'not-valid!', kind: 'rectangle' }), error => error?.code === 'SHAPE_SOURCE_ID');
});
