import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { removeDesignerControl } from '../src/designer.js';
import {
  PATCH_PANEL_PRESENTATION_VERSION,
  PATCH_WINDOW_PANEL_PRESENTATION_VERSION,
  assertPatchPanelPresentationTarget,
  readWindowPanelPresentation,
  setWindowPanelPresentation
} from '../src/window-layout-policy.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';
import {
  copyDesignerControlClipboard,
  pasteDesignerControlClipboard
} from '../web/designer-control-clipboard-model.js';

const SOURCE = `window "Groups" as main size 640, 420:
  # @panel-mode group
  panel as account_settings at 24, 24 size 360, 220:
    text "Account"
    button "Save" as save_button
`;

test('GroupBox Stage 1 is a versioned Panel presentation without an IR or Registry bump', () => {
  assert.equal(PATCH_PANEL_PRESENTATION_VERSION, '0.1');
  assert.equal(PATCH_WINDOW_PANEL_PRESENTATION_VERSION, '0.1');
  const compiled = compile(SOURCE, { name: 'GroupBoxStage1', kind: 'window', entry: 'main.patch' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowPanelPresentation.version, '0.1');
  assert.equal(compiled.windowPanelPresentation.controls.length, 1);
  assert.equal(compiled.windowPanelPresentation.controls[0].mode, 'group');
  const panel = compiled.ast[0].body.find(node => node.kind === 'uiControl' && node.control === 'panel');
  assert.equal(panel.panelPresentation, 'group');
  assert.equal(compiled.ir.instructions[0].body.find(node => node.code === 'UI_CONTROL' && node.control === 'panel').panelPresentation, undefined);
});

test('Panel presentation directive round-trips and belongs only to Panel', () => {
  const panelLine = SOURCE.split('\n').findIndex(line => line.includes('panel as account_settings')) + 1;
  assert.equal(readWindowPanelPresentation(SOURCE, panelLine), 'group');
  const plain = setWindowPanelPresentation(SOURCE, panelLine, 'plain');
  assert.doesNotMatch(plain, /@panel-mode/);
  const restoredLine = plain.split('\n').findIndex(line => line.includes('panel as account_settings')) + 1;
  const restored = setWindowPanelPresentation(plain, restoredLine, 'group');
  assert.match(restored, /# @panel-mode group\n  panel as account_settings/);
  assert.throws(
    () => compile(`window "Invalid":\n  # @panel-mode group\n  button "No" as nope\n`, { kind: 'window' }),
    /@panel-mode belongs only to Panel controls/i
  );
});

test('GroupBox target support is Studio/Web only and Current Ready native fails closed', () => {
  assert.doesNotThrow(() => assertPatchPanelPresentationTarget('group', 'studio'));
  assert.doesNotThrow(() => assertPatchPanelPresentationTarget('group', 'web'));
  assert.throws(() => assertPatchPanelPresentationTarget('group', 'windows'), /GroupBox Stage 1 is Studio\/Web only/i);
  const compiled = compile(SOURCE, { name: 'GroupBoxStage1', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /GroupBox Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );
});

test('Standalone Window Web renders GroupBox semantics and presentation', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'GroupBoxStage1', kind: 'window' });
  assert.equal(built.metadata.groupBoxStage, 1);
  assert.equal(built.metadata.groupBoxMode, 'source-backed-panel-presentation');
  assert.match(built.html, /panelPresentation=node\.panelPresentation\|\|'plain'/);
  assert.match(built.html, /patch-panel patch-groupbox/);
  assert.match(built.html, /patchHumanizeId/);
});

test('Designer duplicate keeps GroupBox metadata with the duplicated Panel', () => {
  const duplicated = duplicateDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 }, { offset: false });
  assert.equal((duplicated.source.match(/# @panel-mode group/g) ?? []).length, 2);
  assert.match(duplicated.source, /# @panel-mode group\n  panel as panel_1/);
  const compiled = compile(duplicated.source, { kind: 'window' });
  assert.deepEqual(compiled.windowPanelPresentation.controls.map(control => control.mode), ['group', 'group']);
});

test('Designer delete removes GroupBox presentation metadata with its Panel', () => {
  const removed = removeDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(removed, /@panel-mode/);
  assert.doesNotMatch(removed, /account_settings/);
  assert.doesNotThrow(() => compile(removed, { kind: 'window' }));
});

test('Designer clipboard preserves GroupBox presentation across paste', () => {
  const clipboard = copyDesignerControlClipboard(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.ok(clipboard.lines.includes('# @panel-mode group'));
  const target = `window "Target" as target size 640, 420:\n  text "Target" at 24, 24 size 120, 28\n`;
  const pasted = pasteDesignerControlClipboard(target, clipboard, { windowIndex: 0, offset: false });
  assert.match(pasted.source, /# @panel-mode group\n  panel as account_settings/);
  const compiled = compile(pasted.source, { kind: 'window' });
  assert.equal(compiled.windowPanelPresentation.controls.find(control => control.id === 'account_settings')?.mode, 'group');
});

test('Patch Studio exposes GroupBox in the palette and Panel Inspector', () => {
  const studio = fs.readFileSync('web/designer-ui-namespace.js', 'utf8');
  assert.match(studio, /PATCH_DESIGNER_GROUPBOX_VERSION = '0\.1'/);
  assert.match(studio, /id = 'addGroupBox'/);
  assert.match(studio, /\+ GroupBox/);
  assert.match(studio, /designerPanelPresentation/);
  assert.match(studio, /setWindowPanelPresentation/);
  assert.match(studio, /patch-groupbox/);
  assert.match(studio, /dataset\.patchPanelId/);
});
