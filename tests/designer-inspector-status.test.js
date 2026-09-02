import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DESIGNER_INSPECTOR_STATUS_VERSION,
  clearDesignerInspectorError,
  designerInspectorErrorMessage,
  showDesignerInspectorError
} from '../web/designer-selection.js';

function fakeDocument() {
  const target = { textContent: '', hidden: true, dataset: {} };
  return {
    target,
    querySelector(selector) {
      return selector === '#designerInspectorError' ? target : null;
    }
  };
}

test('shared Object Inspector status contract normalizes show and clear behavior', () => {
  assert.equal(DESIGNER_INSPECTOR_STATUS_VERSION, '0.1');
  assert.equal(designerInspectorErrorMessage(new Error('Broken control')), 'Broken control');
  assert.equal(designerInspectorErrorMessage('Broken source'), 'Broken source');

  const document = fakeDocument();
  assert.equal(showDesignerInspectorError(new Error('Duplicate name'), { document }), true);
  assert.equal(document.target.textContent, 'Duplicate name');
  assert.equal(document.target.hidden, false);
  assert.equal(document.target.dataset.state, 'invalid');

  assert.equal(clearDesignerInspectorError({ document }), true);
  assert.equal(document.target.textContent, '');
  assert.equal(document.target.hidden, true);
  assert.equal('state' in document.target.dataset, false);
});

test('migrated Designer actions reuse the canonical Inspector status boundary', () => {
  const files = [
    'web/slider-stage1.js',
    'web/tree-designer.js',
    'web/designer-control-duplicate.js',
    'web/designer-form-delete.js'
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from '\.\/designer-selection\.js'/, file);
    assert.match(source, /showDesignerInspectorError/, file);
    assert.doesNotMatch(source, /function show(?:Inspector)?Error\s*\(/, file);
    assert.doesNotMatch(source, /querySelector\('#designerInspectorError'\)/, file);
  }
});

test('shared Inspector status adds no new public module dependency', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const worker = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(buildSite, /'designer-selection\.js'/);
  assert.match(worker, /'\.\/designer-selection\.js'/);
  assert.equal(fs.existsSync('web/designer-inspector-status.js'), false);
});
