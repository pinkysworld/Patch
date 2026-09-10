import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync('docs/SPINEDIT_STAGE1.md', 'utf8');

test('SpinEdit Stage 1 documentation keeps the source and assurance contract explicit', () => {
  assert.match(doc, /# @slider-mode spin/);
  assert.match(doc, /Slider presentation contract: \*\*0\.2\*\*/);
  assert.match(doc, /explicit `create number` declaration/);
  assert.match(doc, /`changed\(value\)` remains the ordinary finite numeric Slider event value/);
  assert.match(doc, /Persistent application state changes only when the handler performs explicit `change`/);
  assert.match(doc, /Duplicate and clipboard workflows create\/carry an independent explicit backing number state/);
  assert.match(doc, /Change IR remains \*\*0\.10\*\*/);
  assert.match(doc, /Component Registry remains \*\*0\.10\*\*/);
  assert.match(doc, /Native GUI IR \*\*1\.9\*\* \/ payload \*\*v19\*\* \/ runtime \*\*v1\.10\*\* fails closed/);
});
