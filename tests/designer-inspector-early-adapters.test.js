import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  STUDIO_DESIGNER_INSPECTOR_STATE_VERSION as primitiveVersion,
  clearDesignerInspectorError as primitiveClear,
  showDesignerInspectorError as primitiveShow,
  syncDesignerInspectorState as primitiveSync
} from '../web/designer-selection.js';
import {
  STUDIO_DESIGNER_INSPECTOR_STATE_VERSION as uxVersion,
  clearDesignerInspectorError as uxClear,
  showDesignerInspectorError as uxShow,
  syncDesignerInspectorState as uxSync
} from '../web/designer-ux.js';

for (const path of [
  'web/designer-selection.js',
  'web/designer-ux.js',
  'web/slider-stage1.js',
  'web/table-stage1.js',
  'web/tree-designer.js'
]) {
  test(`${path} remains valid JavaScript`, () => {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  });
}

test('Designer UX re-exports the low-level Inspector primitives without a second implementation', () => {
  assert.equal(primitiveVersion, '0.1');
  assert.equal(uxVersion, primitiveVersion);
  assert.equal(uxClear, primitiveClear);
  assert.equal(uxShow, primitiveShow);
  assert.equal(uxSync, primitiveSync);

  const ux = fs.readFileSync('web/designer-ux.js', 'utf8');
  assert.match(ux, /from '\.\/designer-selection\.js'/);
  assert.doesNotMatch(ux, /export function showDesignerInspectorError/);
  assert.doesNotMatch(ux, /export function clearDesignerInspectorError/);
  assert.doesNotMatch(ux, /export function syncDesignerInspectorState/);
});

test('low-level Designer primitive module has no module-time document binding or installer', () => {
  const selection = fs.readFileSync('web/designer-selection.js', 'utf8');
  assert.match(selection, /STUDIO_DESIGNER_INSPECTOR_STATE_VERSION = '0\.1'/);
  assert.match(selection, /typeof document === 'undefined' \? null : document/);
  assert.doesNotMatch(selection, /const doc\s*=\s*typeof document/);
  assert.doesNotMatch(selection, /queueMicrotask\(install\)/);
});

test('early Slider Table and TreeView adapters use the shared error lifecycle without importing Designer UX', () => {
  for (const path of ['web/slider-stage1.js', 'web/table-stage1.js', 'web/tree-designer.js']) {
    const source = fs.readFileSync(path, 'utf8');
    assert.match(source, /showDesignerInspectorError/);
    assert.match(source, /clearDesignerInspectorError/);
    assert.match(source, /from '\.\/designer-selection\.js'/);
    assert.doesNotMatch(source, /from '\.\/designer-ux\.js'/);
    assert.doesNotMatch(source, /function showError/);
  }
});

test('host page still boots early Stage-1 adapters before Designer Workspace', () => {
  const html = fs.readFileSync('web/index.html', 'utf8');
  const slider = html.indexOf('src="./slider-stage1.js"');
  const table = html.indexOf('src="./table-stage1.js"');
  const tree = html.indexOf('src="./tree-designer.js"');
  const workspace = html.indexOf('src="./designer-workspace.js"');
  assert.ok(slider >= 0 && table >= 0 && tree >= 0 && workspace >= 0);
  assert.ok(slider < workspace);
  assert.ok(table < workspace);
  assert.ok(tree < workspace);
});
