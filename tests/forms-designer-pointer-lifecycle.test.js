import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const source = fs.readFileSync('web/forms-designer.js', 'utf8');

function functionSlice(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `missing ${endMarker}`);
  return source.slice(start, end);
}

test('legacy Designer control pointer editor is syntax-valid and cancellation-aware', () => {
  execFileSync(process.execPath, ['--check', 'web/forms-designer.js'], { stdio: 'pipe' });
  for (const marker of [
    "window.addEventListener('pointermove', move)",
    "window.addEventListener('pointerup', finish, { once: true })",
    "window.addEventListener('pointercancel', cancel, { once: true })",
    "window.removeEventListener('pointercancel', cancel)",
    'element.hasPointerCapture?.(pointerId)',
    'restoreStartLayout()'
  ]) assert.ok(source.includes(marker), marker);
});

test('pointercancel rolls transient geometry back without committing Patch source', () => {
  const cancel = functionSlice('const cancel = cancelEvent => {', "\n\n  window.addEventListener('pointermove', move)");
  assert.match(cancel, /cleanup\(cancelEvent\)/);
  assert.match(cancel, /restoreStartLayout\(\)/);
  assert.doesNotMatch(cancel, /updateDesignerControl/);
  assert.doesNotMatch(cancel, /setSource\(/);

  const restore = functionSlice('const restoreStartLayout = () => {', '\n  const cleanup = finishEvent => {');
  for (const property of ['left', 'top', 'width', 'height']) {
    assert.match(restore, new RegExp(`target\\.style\\.${property}`));
  }
  assert.match(restore, /positionResizeHandle\(target, selector\)/);
});

test('pointerup remains the only pointer completion path that commits source geometry', () => {
  const finish = functionSlice('const finish = finishEvent => {', '\n  const cancel = cancelEvent => {');
  assert.match(finish, /cleanup\(finishEvent\)/);
  assert.match(finish, /updateDesignerControl\(code\.value, selector/);
  assert.match(finish, /setSource\(next\)/);
  assert.match(finish, /restoreStartLayout\(\)/, 'failed commit should restore transient DOM geometry');
});
