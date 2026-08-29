import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const icon = fs.readFileSync('web/icon.svg', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');
const manifest = fs.readFileSync('web/manifest.webmanifest', 'utf8');
const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
const statusbar = fs.readFileSync('web/designer-statusbar.js', 'utf8');
const forms = fs.readFileSync('web/forms-designer.js', 'utf8');

test('Patch Studio uses the compiler-oriented brand mark across browser and installed surfaces', () => {
  assert.match(icon, /Patch Studio compiler mark/);
  assert.match(icon, /patch-circuit-cuts/);
  assert.match(icon, /patch-main/);
  assert.match(icon, /patch-accent/);
  assert.match(html, /class="brand-mark" src="\.\/icon\.svg"/);
  assert.match(html, /data-patch-brand-mark="compiler-p-v1"/);
  assert.doesNotMatch(html, /M8 6H22V18H13V26H8/);
  assert.match(html, /value="counterWindow" selected>Window app/);
  assert.match(manifest, /"src": "\.\/icon\.svg"/);
  assert.match(manifest, /"theme_color": "#1d4ed8"/);
  assert.match(workspace, /compiler-p-v1/);
});

test('large-Form design-time adapters remain non-executing and Form switching yields between tasks', () => {
  assert.match(statusbar, /getStudioDesignSnapshot/);
  assert.match(statusbar, /getStudioDesignerControls/);
  assert.doesNotMatch(statusbar, /createStudioDesignSnapshotCache/);
  assert.doesNotMatch(statusbar, /new PatchInterpreter\(\)\.run\(source\)/);
  assert.match(forms, /getStudioDesignerWindows/);
  assert.match(forms, /getStudioDesignerControls/);
  assert.match(forms, /materializationScheduled/);
  assert.match(forms, /setTimeout\(\(\) =>/);
  assert.match(forms, /patch-designer-active-form-change/);
});

test('Run command yields before the large compile, execute and render pipeline', () => {
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  assert.match(playground, /setTimeout\(executeRunProject, 0\)/);
  assert.match(playground, /function executeRunProject\(\)/);
  assert.match(playground, /runInProgress = true/);
  assert.match(playground, /runInProgress = false/);
});

test('runtime adapters preserve hidden Form deferral', () => {
  const table = fs.readFileSync('web/table-stage1.js', 'utf8');
  const statusbar = fs.readFileSync('web/designer-statusbar.js', 'utf8');
  assert.match(table, /!designer && shell\.dataset\.patchRenderDetail === 'deferred'/);
  assert.match(statusbar, /!isDesigner && shell\.dataset\.patchRenderDetail === 'deferred'/);
});

test('Pages live smoke verifies the shared compiler brand asset', () => {
  const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
  assert.match(pages, /data-patch-brand-mark=\"compiler-p-v1\"/);
  assert.match(pages, /\.\/icon\.svg\?v=\$\{revision\}/);
  assert.match(pages, /Patch Studio compiler mark/);
  assert.match(pages, /patch-circuit-cuts/);
  assert.doesNotMatch(pages, /grep -F 'viewBox=\"0 0 32 32\"' \"\$index_file\"/);
});