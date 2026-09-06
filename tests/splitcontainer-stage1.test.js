import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { PATCH_COMPONENT_REGISTRY_VERSION } from '../src/component-registry.js';
import { removeDesignerControl } from '../src/designer.js';
import {
  PATCH_PANEL_SPLIT_VERSION,
  PATCH_WINDOW_PANEL_SPLIT_VERSION,
  assertPatchPanelSplitTarget,
  convertWindowPanelToSplit,
  parsePatchPanelSplitDirective,
  readWindowPanelSplit,
  setWindowPanelSplit
} from '../src/panel-split.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';
import {
  copyDesignerControlClipboard,
  pasteDesignerControlClipboard
} from '../web/designer-control-clipboard-model.js';

const SOURCE = `window "Split" as main size 760, 520:
  panel as workspace at 24, 24 size 560, 320:
    # @panel-split vertical 45
    text "Navigator"
    button "Open" as open_button
    # @panel-split-break
    text "Editor"
    input editor_value
`;

function panelOf(compiled) {
  return compiled.ast[0].body.find(node => node.kind === 'uiControl' && node.control === 'panel');
}

test('SplitContainer Stage 1 is a versioned flat Panel contract without IR or Registry bump', () => {
  assert.equal(PATCH_PANEL_SPLIT_VERSION, '0.1');
  assert.equal(PATCH_WINDOW_PANEL_SPLIT_VERSION, '0.1');
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.10');
  const compiled = compile(SOURCE, { name: 'SplitStage1', kind: 'window', entry: 'main.patch' });
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowPanelSplit.version, '0.1');
  const record = compiled.windowPanelSplit.controls.find(control => control.id === 'workspace');
  assert.deepEqual(record.split, { orientation: 'vertical', ratio: 45 });
  assert.deepEqual(record.children.map(child => child.pane), [1, 1, 2, 2]);
  const panel = panelOf(compiled);
  assert.deepEqual(panel.panelSplit, { orientation: 'vertical', ratio: 45 });
  assert.deepEqual(panel.body.map(child => child.splitPane), [1, 1, 2, 2]);
  const lowered = compiled.ir.instructions[0].body.find(node => node.code === 'UI_CONTROL' && node.control === 'panel');
  assert.equal(lowered.panelSplit, undefined);
  assert.equal(lowered.body.some(child => Object.hasOwn(child, 'splitPane')), false);
});

test('Interpreter UI model carries SplitContainer orientation ratio and pane membership only as presentation data', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  const runtimePanel = new PatchInterpreter().runAst(compiled.ast).ui[0].controls.find(control => control.type === 'panel');
  assert.deepEqual(runtimePanel.panelSplit, { orientation: 'vertical', ratio: 45 });
  assert.deepEqual(runtimePanel.controls.map(control => control.splitPane), [1, 1, 2, 2]);
});

test('Split directive parser and editor enforce orientation and bounded source ratio', () => {
  assert.deepEqual(parsePatchPanelSplitDirective('# @panel-split horizontal 60'), { orientation: 'horizontal', ratio: 60 });
  assert.throws(() => parsePatchPanelSplitDirective('# @panel-split diagonal 50'), /vertical 50.*horizontal 50/i);
  assert.throws(() => parsePatchPanelSplitDirective('# @panel-split vertical 9'), /10 to 90/i);
  assert.throws(() => parsePatchPanelSplitDirective('# @panel-split vertical 91'), /10 to 90/i);
  const panelLine = SOURCE.split('\n').findIndex(line => line.includes('panel as workspace')) + 1;
  assert.deepEqual(readWindowPanelSplit(SOURCE, panelLine), { orientation: 'vertical', ratio: 45 });
  const changed = setWindowPanelSplit(SOURCE, panelLine, { orientation: 'horizontal', ratio: 62 });
  assert.match(changed, /# @panel-split horizontal 62/);
  const plain = setWindowPanelSplit(changed, panelLine, null);
  assert.doesNotMatch(plain, /@panel-split(?:-break)?/);
  assert.doesNotThrow(() => compile(plain, { kind: 'window' }));
});

test('plain Panel converts atomically into an explicit two-pane SplitContainer', () => {
  const plain = `window "Convert" as main size 640, 420:\n  panel as content at 24, 24 size 420, 240:\n    text "Left"\n    button "Right" as right_button\n`;
  const line = plain.split('\n').findIndex(row => row.includes('panel as content')) + 1;
  const converted = convertWindowPanelToSplit(plain, line, { orientation: 'horizontal', ratio: 55 });
  assert.match(converted, /panel as content[^\n]*:\n    # @panel-split horizontal 55\n    text "Left"\n    # @panel-split-break\n    button "Right" as right_button/);
  const compiled = compile(converted, { kind: 'window' });
  assert.deepEqual(panelOf(compiled).body.map(child => child.splitPane), [1, 2]);
});

test('SplitContainer source structure fails closed for missing duplicated or empty pane boundaries', () => {
  const missingBreak = SOURCE.replace('    # @panel-split-break\n', '');
  assert.throws(() => compile(missingBreak, { kind: 'window' }), /needs one # @panel-split-break/i);

  const duplicateBreak = SOURCE.replace('    # @panel-split-break\n', '    # @panel-split-break\n    # @panel-split-break\n');
  assert.throws(() => compile(duplicateBreak, { kind: 'window' }), /more than one # @panel-split-break/i);

  const emptyFirst = SOURCE.replace('    text "Navigator"\n    button "Open" as open_button\n    # @panel-split-break\n', '    # @panel-split-break\n    text "Navigator"\n    button "Open" as open_button\n');
  assert.throws(() => compile(emptyFirst, { kind: 'window' }), /at least one child in each pane/i);

  const emptySecond = SOURCE.replace('    # @panel-split-break\n    text "Editor"\n    input editor_value\n', '    text "Editor"\n    input editor_value\n    # @panel-split-break\n');
  assert.throws(() => compile(emptySecond, { kind: 'window' }), /at least one child in each pane/i);
});

test('SplitContainer directives belong to a Panel and Stage 1 rejects positioned children and outer AutoScroll', () => {
  assert.throws(
    () => compile(`window "Bad":\n  # @panel-split vertical 50\n  button "No" as nope\n`, { kind: 'window' }),
    /@panel-split belongs inside a Panel block header/i
  );
  assert.throws(
    () => compile(SOURCE.replace('text "Navigator"', 'text "Navigator" at 10, 10 size 120, 30'), { kind: 'window' }),
    /flow-layout children only/i
  );
  assert.throws(
    () => compile(SOURCE.replace('    # @panel-split vertical 45\n', '    # @panel-split vertical 45\n    # @panel-scroll auto\n'), { kind: 'window' }),
    /cannot also use # @panel-scroll auto/i
  );
});

test('GroupBox presentation composes with SplitContainer while native Current Ready fails closed', () => {
  const grouped = SOURCE.replace('  panel as workspace', '  # @panel-mode group\n  panel as workspace');
  const compiled = compile(grouped, { kind: 'window' });
  const panel = panelOf(compiled);
  assert.equal(panel.panelPresentation, 'group');
  assert.deepEqual(panel.panelSplit, { orientation: 'vertical', ratio: 45 });
  assert.doesNotThrow(() => assertPatchPanelSplitTarget({ orientation: 'vertical', ratio: 50 }, 'studio'));
  assert.doesNotThrow(() => assertPatchPanelSplitTarget({ orientation: 'vertical', ratio: 50 }, 'web'));
  assert.throws(() => assertPatchPanelSplitTarget({ orientation: 'vertical', ratio: 50 }, 'windows'), /SplitContainer Stage 1 is Studio\/Web only/i);
  assert.throws(
    () => buildCurrentNativeGuiIR(compile(SOURCE, { kind: 'window' })),
    /SplitContainer Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );
});

test('Panel duplicate delete and clipboard preserve SplitContainer as one source-backed block', () => {
  const duplicated = duplicateDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 }, { offset: false });
  assert.equal((duplicated.source.match(/# @panel-split vertical 45/g) ?? []).length, 2);
  assert.equal((duplicated.source.match(/# @panel-split-break/g) ?? []).length, 2);
  const duplicateCompiled = compile(duplicated.source, { kind: 'window' });
  assert.equal(duplicateCompiled.windowPanelSplit.controls.filter(control => control.split).length, 2);

  const clipboard = copyDesignerControlClipboard(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.ok(clipboard.lines.some(line => line.trim() === '# @panel-split vertical 45'));
  assert.ok(clipboard.lines.some(line => line.trim() === '# @panel-split-break'));
  const target = `window "Target" as target size 640, 420:\n  text "Target" at 24, 24 size 120, 28\n`;
  const pasted = pasteDesignerControlClipboard(target, clipboard, { windowIndex: 0, offset: false });
  assert.match(pasted.source, /# @panel-split vertical 45/);
  assert.match(pasted.source, /# @panel-split-break/);
  assert.doesNotThrow(() => compile(pasted.source, { kind: 'window' }));

  const removed = removeDesignerControl(SOURCE, { windowIndex: 0, controlIndex: 0 });
  assert.doesNotMatch(removed, /@panel-split/);
  assert.doesNotThrow(() => compile(removed, { kind: 'window' }));
});

test('public and offline Studio packaging includes SplitContainer source contract', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(buildSite, /'panel-split\.js'/);
  assert.match(serviceWorker, /'\.\.\/src\/panel-split\.js'/);
});
