import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_SHAPE_KINDS,
  normalizePatchShape,
  patchShapeSvgDescriptor,
  patchShapeCssStyle
} from '../src/shape-control.js';

test('Shape Stage 1 exposes the four R1 geometry kinds', () => {
  assert.deepEqual(PATCH_SHAPE_KINDS, ['rectangle', 'rounded', 'ellipse', 'line']);
});

test('Shape Stage 1 normalizes deterministic fill stroke radius and opacity', () => {
  assert.deepEqual(normalizePatchShape({
    kind: 'rounded',
    fill: '#ABCDEF',
    stroke: '#12345678',
    strokeWidth: 3,
    cornerRadius: 18,
    opacity: 0.75
  }), {
    kind: 'rounded',
    fill: '#abcdef',
    stroke: '#12345678',
    strokeWidth: 3,
    cornerRadius: 18,
    opacity: 0.75
  });
});

test('Shape line is non-filled and has a deterministic SVG line descriptor', () => {
  const descriptor = patchShapeSvgDescriptor({ kind: 'line', stroke: '#334155', strokeWidth: 4 });
  assert.equal(descriptor.element, 'line');
  assert.equal(descriptor.attributes.fill, 'transparent');
  assert.equal(descriptor.attributes.stroke, '#334155');
  assert.equal(descriptor.attributes.strokeWidth, 4);
  assert.equal(descriptor.attributes.x1, '0%');
  assert.equal(descriptor.attributes.x2, '100%');
});

test('Shape ellipse and rounded rectangle produce distinct renderer metadata', () => {
  const ellipse = patchShapeCssStyle({ kind: 'ellipse' });
  const rounded = patchShapeSvgDescriptor({ kind: 'rounded', cornerRadius: 16 });
  assert.equal(ellipse.borderRadius, '50%');
  assert.equal(rounded.element, 'rect');
  assert.equal(rounded.attributes.rx, 16);
  assert.equal(rounded.attributes.ry, 16);
});

test('Shape Stage 1 rejects unsafe or platform-ambiguous style values', () => {
  assert.throws(() => normalizePatchShape({ kind: 'triangle' }), error => error?.code === 'SHAPE_KIND');
  assert.throws(() => normalizePatchShape({ fill: 'red' }), error => error?.code === 'SHAPE_COLOR');
  assert.throws(() => normalizePatchShape({ strokeWidth: -1 }), error => error?.code === 'SHAPE_RANGE');
  assert.throws(() => normalizePatchShape({ opacity: 1.5 }), error => error?.code === 'SHAPE_RANGE');
});
