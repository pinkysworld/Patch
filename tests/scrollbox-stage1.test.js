import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { removeDesignerControl } from '../src/designer.js';
import { PATCH_COMPONENT_REGISTRY_VERSION } from '../src/component-registry.js';
import {
  PATCH_PANEL_SCROLL_VERSION,
  PATCH_WINDOW_PANEL_SCROLL_VERSION,
  assertPatchPanelScrollTarget,
  readWindowPanelScroll,
  setWindowPanelScroll
} from '../src/panel-scroll.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';
import {
  copyDesignerControlClipboard,
  pasteDesignerControlClipboard
} from '../web/designer-control-clipboard-model.js';

const SOURCE = `window "Scrollable details" as main size 640, 420:
  # @panel-mode group
  panel as advanced_settings at 24, 24 size 320, 180:
    # @panel-scroll auto
    text "Scrollable settings"
    button "Apply" as apply_button at 24, 220 size 120, 40
`;

test('ScrollBox Stage 1 is a versioned Panel behavior without an IR or Registry bump', () => {
  assert.equal(PATCH_PANEL_SCROLL_VERSION, '0.1');
  assert.equal(PATCH_WINDOW_PANEL_SCROLL_VERSION, '0.1');
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.10');
  const compiled = compile(SOURCE, { name: 'ScrollBoxStage1', kind: 'window', entry: 'main.patch' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowPanelScroll.version, '0.1');
  assert.equal(compiled.windowPanelScroll.controls.length, 1);
  assert.equal(compiled.windowPanelScroll.controls[0].mode, 'auto');
  const panel = compiled.ast[0].body.find(node => node.kind === 'uiControl' && node.control === 'panel');
  assert.equal(panel.panelPresentation, 'group');
  assert.equal(panel.panelScroll, 'auto');
  const lowered = compiled.ir.instructions[0].body.find(node => node.code === 'UI_CONTROL' && node.control === 'panel');
  assert.equal(lowered.panelScroll, undefined);
});

test('Panel scroll directive is block-local, round-trips, and rejects ambiguous placement', () => {
  const panelLine = SOURCE.split('\n').findIndex(line => line.includes('panel as advanced_settings')) + 1;
  assert.equal(readWindowPanelScroll(SOURCE, panelLine), 'auto');
  const clipped = setWindowPanelScroll(SOURCE, panelLine, 'none');
  assert.doesNotMatch(clipped, /@panel-scroll/);
  const restoredLine = clipped.split('\n').findIndex(line => line.includes('panel as advanced_settings')) + 1;
  const restored = setWindowPanelScroll(clipped, restoredLine, 'auto');
  assert.match(restored, /panel as advanced_settings[^\n]*:\n    # @panel-scroll auto\n/);
  assert.throws(
    () => compile(`window "Invalid":\n  # @panel-scroll auto\n  panel as wrong:\n    text "No"\n`, { kind: 'window' }),
    /belongs inside a Panel block header/i
  );
  assert.throws(
    () => compile(`window "Invalid":\n  panel as wrong:\n    text "First"\n    # @panel-scroll auto\n    button "No" as nope\n`, { kind: 'window' }),
    /belongs inside a Panel block header/i
  );
});

test('ScrollBox target support is Studio/Web only and Current Ready native fails closed', () => {
  assert.doesNotThrow(() => assertPatchPanelScrollTarget('auto', 'studio'));
  assert.doesNotThrow(() => assertPatchPanelScrollTarget('auto', 'web'));
  assert.throws(() => assertPatchPanelScrollTarget('auto', 'windows'), /ScrollBox Stage 1 is Studio\/Web only/i);
  const compiled = compile(SOURCE, { name: 'ScrollBoxStage1', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /ScrollBox Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );
});

test('Standalone Window Web renders ScrollBox overflow and keeps scroll offset transient', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'ScrollBoxStage1', kind: 'window' });
  assert.equal(built.metadata.groupBoxStage, 1);
  assert.equal(built.metadata.scrollBoxStage, 1);
  assert.equal(built.metadata.scrollBoxMode, 'source-backed-panel-auto-scroll');
  assert.match(built.html, /panelScroll=node\.panelScroll\|\|'none'/);
  assert.match(built.html, /patch-scrollbox/);
  assert.match(built.html, /patch-scrollbox-surface/);
  assert.match(built.html, /patchPanelScrollPositions=new Map/);
  assert.match(built.html, /patchPanelScrollExtent/);
  assert.doesNotMatch(built.html, /safeTrigger\(control\.id,'scrolled'/);
});

test('Designer duplicate keeps block-local ScrollBox metadata automatically', () => {
  const duplicated = duplicateDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 }, { offset: false });
  assert.equal((duplicated.source.match(/# @panel-scroll auto/g) ?? []).length, 2);
  assert.match(duplicated.source, /panel as panel_1[^\n]*:\n    # @panel-scroll auto/);
  const compiled = compile(duplicated.source, { kind: 'window' });
  assert.deepEqual(compiled.windowPanelScroll.controls.map(control => control.mode), ['auto', 'auto']);
});

test('Designer delete removes block-local ScrollBox metadata with its Panel', () => {
  const removed = removeDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(removed, /@panel-scroll/);
  assert.doesNotMatch(removed, /advanced_settings/);
  assert.doesNotThrow(() => compile(removed, { kind: 'window' }));
});

test('Designer clipboard preserves ScrollBox metadata across paste', () => {
  const clipboard = copyDesignerControlClipboard(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.ok(clipboard.lines.includes('  # @panel-scroll auto'));
  const target = `window "Target" as target size 640, 420:\n  text "Target" at 24, 24 size 120, 28\n`;
  const pasted = pasteDesignerControlClipboard(target, clipboard, { windowIndex: 0, offset: false });
  assert.match(pasted.source, /panel as advanced_settings[^\n]*:\n    # @panel-scroll auto/);
  const compiled = compile(pasted.source, { kind: 'window' });
  assert.equal(compiled.windowPanelScroll.controls.find(control => control.id === 'advanced_settings')?.mode, 'auto');
});

test('Patch Studio exposes ScrollBox in the palette and Panel Inspector', () => {
  const studio = fs.readFileSync('web/designer-ui-namespace.js', 'utf8');
  assert.match(studio, /PATCH_DESIGNER_SCROLLBOX_VERSION = '0\.1'/);
  assert.match(studio, /id = 'addScrollBox'/);
  assert.match(studio, /\+ ScrollBox/);
  assert.match(studio, /designerPanelScroll/);
  assert.match(studio, /setWindowPanelScroll/);
  assert.match(studio, /patch-scrollbox/);
  assert.match(studio, /panelScrollPositions/);
});
