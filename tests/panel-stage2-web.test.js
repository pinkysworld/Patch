import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PatchInterpreter } from '../src/interpreter.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const SOURCE = `window "Panel Stage 2" as main size 640, 420:
  panel as tools at 24, 24 size 360, 220:
    text "Legacy flow child"
    button "Run" as run_button at 18, 32 size 120, 36
    input query at 18, 84 size 220, 32
`;

test('Studio runtime model preserves nested Panel controls and Panel-relative geometry', () => {
  const result = new PatchInterpreter().run(SOURCE);
  const panel = result.ui[0].controls.find(control => control.type === 'panel');
  assert.ok(panel);
  assert.equal(panel.id, 'tools');
  assert.equal(panel.controls.length, 3);
  assert.equal(panel.controls[0].panelLayout, undefined);
  assert.deepEqual(panel.controls[1].panelLayout, { x: 18, y: 32, width: 120, height: 36 });
  assert.deepEqual(panel.controls[2].panelLayout, { x: 18, y: 84, width: 220, height: 32 });
});

test('Studio Window renderer owns interactive Panel rendering and relative layout', () => {
  const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  assert.match(renderer, /PATCH_STUDIO_WINDOW_RENDERER_VERSION = '0\.2'/);
  assert.match(renderer, /'tabs', 'panel', 'text'/);
  assert.match(renderer, /function createPanelElement\(/);
  assert.match(renderer, /patch-panel-runtime/);
  assert.match(renderer, /patch-panel-positioned/);
  assert.match(renderer, /nested\.panelLayout/);
  assert.match(renderer, /applyPanelChildLayout\(nestedElement, nested\.panelLayout\)/);
  assert.match(renderer, /controlPath: `\$\{basePath\}\.panel\$\{nestedIndex\}`/);
  assert.match(renderer, /context\.interactive \? createPanelElement\(control, context\) : null/);
});

test('Standalone Window Web advertises and carries Panel Stage 2 relative layout', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'PanelStage2Web', kind: 'window' });
  assert.equal(built.metadata.panelStage, 2);
  assert.equal(built.metadata.panelMode, 'source-backed-flow-plus-relative-layout');
  assert.equal(built.metadata.accessibilityVersion, '0.4');
  assert.match(built.html, /patch-panel-positioned/);
  assert.match(built.html, /patchPanelLayout/);
  assert.match(built.html, /function patchApplyPanelLayout/);
  assert.match(built.html, /position='absolute'/);
  assert.match(built.html, /left=String\(layout\.x\)\+'px'/);
  assert.match(built.html, /top=String\(layout\.y\)\+'px'/);
});

test('Standalone Window Web keeps legacy flow-only Panel metadata on Stage 1', () => {
  const built = buildStandaloneWebApp(`window "Legacy" as main:
  panel as tools:
    text "Flow"
    button "Run" as run_button
`, { name: 'LegacyPanelWeb', kind: 'window' });
  assert.equal(built.metadata.panelStage, 1);
  assert.equal(built.metadata.panelMode, 'source-backed-flow-group');
});

test('Panel Stage 2 Designer surface exposes source-backed relative geometry controls', () => {
  const ui = fs.readFileSync('web/designer-panel.js', 'utf8');
  const css = fs.readFileSync('web/designer-panel.css', 'utf8');
  const model = fs.readFileSync('src/designer-panel.js', 'utf8');
  assert.match(ui, /PATCH_DESIGNER_PANEL_VERSION = '0\.2'/);
  assert.match(model, /PATCH_DESIGNER_PANEL_MODEL_VERSION = '0\.2'/);
  for (const id of [
    'designerPanelChildPositioned',
    'designerPanelChildX',
    'designerPanelChildY',
    'designerPanelChildWidth',
    'designerPanelChildHeight'
  ]) assert.match(ui, new RegExp(id));
  assert.match(ui, /patch-panel-positioned/);
  assert.match(ui, /dataset\.panelChildLayout/);
  assert.match(css, /\.patch-panel-surface/);
  assert.match(css, /\.patch-panel-positioned/);
}
