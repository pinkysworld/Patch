import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_PAINTBOX_OPERATIONS,
  PATCH_PAINTBOX_STAGE_VERSION,
  formatPatchPaintCommand,
  normalizePatchPaintCommand,
  normalizePatchPaintProgram,
  parsePatchPaintCommand,
  validatePatchPaintBoxId
} from '../src/paintbox-control.js';

test('PaintBox Stage 1 exposes a bounded ephemeral drawing vocabulary', () => {
  assert.equal(PATCH_PAINTBOX_STAGE_VERSION, '0.1');
  assert.deepEqual(PATCH_PAINTBOX_OPERATIONS, ['clear', 'line', 'rectangle', 'ellipse', 'text', 'image']);
  assert.equal(validatePatchPaintBoxId('preview_canvas'), 'preview_canvas');
  assert.throws(() => validatePatchPaintBoxId('bad-name'), /valid PaintBox name/);
});

test('PaintBox commands normalize colors geometry pens brushes and font size deterministically', () => {
  assert.deepEqual(normalizePatchPaintCommand({ operation: 'clear', color: '#AABBCC' }), {
    operation: 'clear', color: '#aabbcc'
  });
  assert.deepEqual(normalizePatchPaintCommand({ operation: 'clear', color: 'transparent' }), {
    operation: 'clear', color: 'transparent'
  });
  assert.deepEqual(normalizePatchPaintCommand({ operation: 'line', x1: -5, y1: 2.5, x2: 40, y2: 80, stroke: '#ABCDEF', strokeWidth: 3 }), {
    operation: 'line', x1: -5, y1: 2.5, x2: 40, y2: 80, stroke: '#abcdef', strokeWidth: 3
  });
  assert.deepEqual(normalizePatchPaintCommand({ operation: 'rectangle', x: 10, y: 20, width: 100, height: 60, fill: 'transparent', stroke: '#112233', strokeWidth: 2 }), {
    operation: 'rectangle', x: 10, y: 20, width: 100, height: 60, fill: 'transparent', stroke: '#112233', strokeWidth: 2
  });
  assert.deepEqual(normalizePatchPaintCommand({ operation: 'text', textExpr: '"Hello"', x: 12, y: 24, color: '#445566', fontSize: 18 }), {
    operation: 'text', textExpr: '"Hello"', x: 12, y: 24, color: '#445566', fontSize: 18
  });
});

test('canonical PaintBox draw source round-trips without hidden canvas state', () => {
  const source = [
    'draw clear #ffffff',
    'draw clear transparent',
    'draw line 0, 10 to 120, 10 stroke #334455 width 2',
    'draw rectangle 10, 20 size 100, 60 fill #dbeafe stroke #2563eb width 3',
    'draw ellipse 14, 18 size 80, 80 fill transparent stroke #112233 width 1',
    'draw text "Patch" at 24, 48 color #111827 size 16',
    'draw image "patch-resource:logo" at 8, 8 size 32, 32'
  ];
  const parsed = source.map(parsePatchPaintCommand);
  assert.deepEqual(parsed.map(formatPatchPaintCommand), source);
  const program = normalizePatchPaintProgram(parsed);
  assert.equal(Object.isFrozen(program), true);
  assert.equal(program.every(Object.isFrozen), true);
  assert.equal(program.some(command => Object.hasOwn(command, 'state')), false);
  assert.equal(program.some(command => Object.hasOwn(command, 'history')), false);
});

test('PaintBox Stage 1 fails closed for ambiguous or unsafe drawing values', () => {
  assert.throws(() => parsePatchPaintCommand('draw rectangle 0, 0 size 0, 20 fill #ffffff stroke #000000 width 1'), /greater than zero/);
  assert.throws(() => parsePatchPaintCommand('draw line 0, 0 to 10, 10 stroke red width 1'), /do not understand PaintBox command/i);
  assert.throws(() => normalizePatchPaintCommand({ operation: 'line', x1: 0, y1: 0, x2: 10, y2: 10, stroke: '#000000', strokeWidth: 100 }), /0 to 64/);
  assert.throws(() => normalizePatchPaintCommand({ operation: 'text', textExpr: '', x: 0, y: 0 }), /text expression/);
  assert.throws(() => parsePatchPaintCommand('draw image logo at 0, 0 size 16, 16'), /do not understand PaintBox command/i);
  assert.throws(() => parsePatchPaintCommand('draw image "patch-resource:logo" at 0, 0 size 0, 16'), /greater than zero/);
});
