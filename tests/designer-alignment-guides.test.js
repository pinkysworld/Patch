import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { snapFormControlAlignment } from '../src/form-layout.js';

const moduleSource = fs.readFileSync('web/designer-alignment-guides.js', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('alignment snapping matches nearby peer edges on both axes', () => {
  const result = snapFormControlAlignment(
    { x: 98, y: 51, width: 50, height: 20 },
    [{ x: 100, y: 50, width: 80, height: 20 }],
    { tolerance: 5 }
  );
  assert.equal(result.x, 100);
  assert.equal(result.y, 50);
  assert.equal(result.guideX, 100);
  assert.equal(result.guideY, 50);
});

test('alignment snapping supports center guides without changing dimensions', () => {
  const result = snapFormControlAlignment(
    { x: 43, y: 100, width: 100, height: 40 },
    [{ x: 50, y: 20, width: 86, height: 40 }],
    { tolerance: 5 }
  );
  assert.equal(result.x, 43);
  assert.equal(result.width, 100);
  assert.equal(result.height, 40);
  assert.equal(result.guideX, 93);
});

test('alignment snapping leaves distant controls alone', () => {
  const result = snapFormControlAlignment(
    { x: 20, y: 20, width: 40, height: 20 },
    [{ x: 100, y: 100, width: 40, height: 20 }],
    { tolerance: 5 }
  );
  assert.deepEqual(result, { x: 20, y: 20, width: 40, height: 20, guideX: null, guideY: null });
});

test('Studio alignment assistance is additive, syntax-valid and offline-cached', () => {
  execFileSync(process.execPath, ['--check', 'web/designer-alignment-guides.js'], { stdio: 'pipe' });
  assert.match(html, /forms-designer\.js[\s\S]*designer-alignment-guides\.js[\s\S]*form-window-resize\.js/);
  assert.match(sw, /\.\/designer-alignment-guides\.js/);
  assert.match(moduleSource, /moveEvent\.altKey/);
  assert.match(moduleSource, /snapFormControlAlignment/);
  assert.match(moduleSource, /document\.body\.appendChild\(guide\)/);
  assert.match(moduleSource, /pointercancel/);
});
