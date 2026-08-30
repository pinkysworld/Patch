import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');
const docs = fs.readFileSync('docs/WORKSPACE_LAYOUT.md', 'utf8');

test('Workspace Layout v2 keeps the documented local preference and ARIA separator contract', () => {
  assert.match(accessibility, /patchStudio\.workspaceSplit\.v2/);
  assert.match(docs, /patchStudio\.workspaceSplit\.v2/);
  assert.match(accessibility, /role', 'separator'/);
  assert.match(accessibility, /aria-orientation', 'horizontal'/);
  assert.match(accessibility, /aria-valuemin/);
  assert.match(accessibility, /aria-valuemax/);
  assert.match(accessibility, /aria-valuenow/);
  assert.match(accessibility, /aria-valuetext/);
  assert.match(accessibility, /Reset split/);
});

test('split source editor uses flex height so title and file tabs stay inside the requested source height', () => {
  assert.match(accessibility, /\.editor-pane textarea \{ flex: 1 1 auto; height: auto; min-height: 0; resize: none; \}/);
  assert.doesNotMatch(accessibility, /\.editor-pane textarea \{ height: calc\(100% - 42px\)/);
});

test('desktop resize recaptures natural workspace geometry while preserving the logical ratio', () => {
  assert.match(accessibility, /window\.addEventListener\('resize'/);
  assert.match(accessibility, /requestAnimationFrame\(recaptureGeometry\)/);
  assert.match(accessibility, /const preservedRatio = ratio/);
  assert.match(accessibility, /clearSizedLayout\(\{ sync: false \}\)/);
  assert.match(accessibility, /totalHeight = 0/);
  assert.match(accessibility, /applyRatio\(preservedRatio, \{ persist: false \}\)/);
});

test('cancelled pointer resize restores the pre-drag ratio instead of persisting a partial gesture', () => {
  assert.match(accessibility, /startRatio: ratio/);
  assert.match(accessibility, /addEventListener\('pointercancel'/);
  assert.match(accessibility, /applyRatio\(startRatio, \{ persist: false \}\)/);
});

test('narrow-screen fallback remains explicit and source/project state is untouched', () => {
  assert.match(accessibility, /matchMedia\('\(max-width: 760px\)'\)/);
  assert.match(accessibility, /\.workspace-layout-bar \{ display: none; \}/);
  assert.doesNotMatch(accessibility, /editor\.value\s*=/);
  assert.doesNotMatch(accessibility, /projectKind/);
});
