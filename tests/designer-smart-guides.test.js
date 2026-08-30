import test from 'node:test';
import assert from 'node:assert/strict';
import { snapFormControlAlignment } from '../web/designer-alignment.js';

test('smart alignment distinguishes center alignment from edge alignment', () => {
  const centered = snapFormControlAlignment(
    { x: 48, y: 20, width: 40, height: 20 },
    [{ x: 40, y: 80, width: 60, height: 20 }],
    { tolerance: 5 }
  );
  assert.equal(centered.x, 50);
  assert.equal(centered.guideX, 70);
  assert.equal(centered.guideXKind, 'center');
  assert.equal(centered.spacingX, null);

  const edge = snapFormControlAlignment(
    { x: 43, y: 20, width: 40, height: 20 },
    [{ x: 40, y: 80, width: 60, height: 20 }],
    { tolerance: 5 }
  );
  assert.equal(edge.x, 40);
  assert.equal(edge.guideXKind, 'edge');
});

test('smart alignment snaps a control between two peers to equal horizontal spacing', () => {
  const snapped = snapFormControlAlignment(
    { x: 64, y: 90, width: 40, height: 20 },
    [
      { x: 0, y: 0, width: 40, height: 20 },
      { x: 120, y: 0, width: 40, height: 20 }
    ],
    { tolerance: 5 }
  );
  assert.equal(snapped.x, 60);
  assert.equal(snapped.guideX, null);
  assert.equal(snapped.spacingX?.beforeEdge, 40);
  assert.equal(snapped.spacingX?.afterEdge, 120);
  assert.equal(snapped.spacingX?.beforeGap, 20);
  assert.equal(snapped.spacingX?.afterGap, 20);
  assert.equal(snapped.spacingX?.gap, 20);
});

test('smart alignment snaps a control between two peers to equal vertical spacing', () => {
  const snapped = snapFormControlAlignment(
    { x: 90, y: 44, width: 30, height: 20 },
    [
      { x: 0, y: 0, width: 30, height: 20 },
      { x: 0, y: 80, width: 30, height: 20 }
    ],
    { tolerance: 5 }
  );
  assert.equal(snapped.y, 40);
  assert.equal(snapped.guideY, null);
  assert.equal(snapped.spacingY?.beforeGap, 20);
  assert.equal(snapped.spacingY?.afterGap, 20);
});

test('direct alignment wins over an equal-spacing candidate on the same axis', () => {
  const snapped = snapFormControlAlignment(
    { x: 41, y: 40, width: 40, height: 20 },
    [
      { x: 40, y: 0, width: 40, height: 20 },
      { x: 120, y: 0, width: 40, height: 20 }
    ],
    { tolerance: 5 }
  );
  assert.equal(snapped.x, 40);
  assert.equal(snapped.guideX, 40);
  assert.equal(snapped.guideXKind, 'edge');
  assert.equal(snapped.spacingX, null);
});

test('smart alignment leaves spacing alone outside the tolerance', () => {
  const snapped = snapFormControlAlignment(
    { x: 72, y: 40, width: 40, height: 20 },
    [
      { x: 0, y: 0, width: 40, height: 20 },
      { x: 120, y: 0, width: 40, height: 20 }
    ],
    { tolerance: 5 }
  );
  assert.equal(snapped.x, 72);
  assert.equal(snapped.guideX, null);
  assert.equal(snapped.spacingX, null);
});

test('overlapping peers are never treated as equal-spacing anchors', () => {
  const snapped = snapFormControlAlignment(
    { x: 50, y: 40, width: 40, height: 20 },
    [
      { x: 30, y: 0, width: 30, height: 20 },
      { x: 80, y: 0, width: 30, height: 20 }
    ],
    { tolerance: 5 }
  );
  assert.equal(snapped.spacingX, null);
});
