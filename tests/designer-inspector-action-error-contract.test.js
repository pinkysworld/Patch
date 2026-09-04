import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const migrated = [
  'web/designer-data-editor.js',
  'web/designer-form-duplicate.js',
  'web/designer-form-delete.js',
  'web/designer-table-actions.js',
  'web/designer-tree-duplicate.js',
  'web/designer-tabs-page-duplicate.js',
  'web/designer-tabs-control-actions.js',
  'web/designer-tabs-nested.js'
];

for (const path of migrated) {
  test(`${path} uses the shared Inspector error lifecycle`, () => {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    const source = fs.readFileSync(path, 'utf8');
    assert.match(source, /showDesignerInspectorError/);
    assert.match(source, /clearDesignerInspectorError/);
    assert.match(source, /from '\.\/designer-selection\.js'/);
    assert.doesNotMatch(source, /function showError/);
    assert.match(source, /clearDesignerInspectorError\(\{ document \}\)/);
  });
}

test('converged Inspector action and data-editor modules remain part of the Designer Workspace and hosted bundle', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  for (const module of [
    'designer-data-editor.js',
    'designer-form-duplicate.js',
    'designer-form-delete.js',
    'designer-table-actions.js',
    'designer-tree-duplicate.js',
    'designer-tabs-page-duplicate.js',
    'designer-tabs-control-actions.js',
    'designer-tabs-nested.js'
  ]) {
    const escaped = module.replace('.', '\\.');
    assert.match(workspace, new RegExp(`import './${escaped}'`));
    assert.match(buildSite, new RegExp(escaped));
  }
});

test('converged Inspector modules do not reintroduce local showError implementations', () => {
  const offenders = migrated.filter(path => /function showError\(error\)/.test(fs.readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});
