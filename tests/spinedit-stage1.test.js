import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { listDesignerControls } from '../src/designer.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';
import { copyDesignerControlClipboard, pasteDesignerControlClipboard } from '../web/designer-control-clipboard-model.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { PATCH_COMPONENT_REGISTRY_VERSION } from '../src/component-registry.js';
import {
  PATCH_SLIDER_PRESENTATION_VERSION,
  PATCH_WINDOW_SLIDER_PRESENTATION_VERSION,
  assertPatchSliderPresentationTarget,
  parsePatchSliderPresentationDirective,
  patchSliderPresentationTargetSupport,
  readWindowSliderPresentation,
  setWindowSliderPresentation
} from '../src/slider-presentation.js';

const SOURCE = `create number quantity = 3

window "Spin" as main size 520, 260:
  # @slider-mode spin
  slider 0..10 as quantity step 1 at 24, 72 size 180, 34

when quantity changed:
  change quantity:
    set = value
`;

test('SpinEdit Stage 1 extends the versioned Slider presentation contract without IR or Registry bumps', () => {
  assert.equal(PATCH_SLIDER_PRESENTATION_VERSION, '0.2');
  assert.equal(PATCH_WINDOW_SLIDER_PRESENTATION_VERSION, '0.2');
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.10');
  assert.equal(parsePatchSliderPresentationDirective('# @slider-mode spin'), 'spin');
  assert.equal(patchSliderPresentationTargetSupport('spin').studio, 'supported');
  assert.equal(patchSliderPresentationTargetSupport('spin').web, 'supported');
  assert.equal(patchSliderPresentationTargetSupport('spin').windows, 'unsupported');
  assert.doesNotThrow(() => assertPatchSliderPresentationTarget('spin', 'web'));
  assert.throws(() => assertPatchSliderPresentationTarget('spin', 'windows'), /SpinEdit Stage 1 is Studio\/Web only/);
});

test('SpinEdit metadata round-trips on ordinary Slider syntax', () => {
  const plain = `create number quantity = 2\n\nwindow "Spin" as main:\n  # @layout anchor left\n  slider 0..10 as quantity step 1\n`;
  const line = plain.split('\n').findIndex(row => /^\s*slider\b/.test(row)) + 1;
  const spin = setWindowSliderPresentation(plain, line, 'spin');
  assert.match(spin, /# @layout anchor left\n  # @slider-mode spin\n  slider/);
  assert.equal(readWindowSliderPresentation(spin, line + 1), 'spin');
  const restored = setWindowSliderPresentation(spin, line + 1, 'plain');
  assert.doesNotMatch(restored, /@slider-mode/);
});

test('compiler attaches SpinEdit presentation while preserving Change IR 0.10', () => {
  const compiled = compile(SOURCE, { name: 'Spin', kind: 'window' });
  const slider = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'slider');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(slider.sliderPresentation, 'spin');
  assert.equal(compiled.windowSliderPresentation.controls[0].mode, 'spin');
  const irSlider = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.code === 'UI_CONTROL');
  assert.equal(Object.hasOwn(irSlider, 'sliderPresentation'), false);
});

test('SpinEdit requires explicit matching number state and keeps numeric changed(value)', () => {
  assert.throws(
    () => compile(`window "Bad" as main:\n  # @slider-mode spin\n  slider 0..10 as quantity step 1\n`, { kind: 'window' }),
    /SpinEdit 'quantity'.*create number quantity/i
  );
  const compiled = compile(SOURCE, { kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowSlider: true }),
    /SpinEdit Stage 1.*Standalone Window Web.*no numeric SpinEdit presentation contract/i
  );
  const web = validateWindowRuntimeSupport(compiled, { allowSlider: true, allowSpinEdit: true });
  assert.equal(web.sliders, 1);
  assert.equal(web.spinEdits, 1);
  assert.equal(web.events, 1);
});

test('Current Ready native fails closed instead of lowering SpinEdit to Slider', () => {
  const compiled = compile(SOURCE, { name: 'Spin', kind: 'window' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /SpinEdit Stage 1.*Studio\/Web only.*no numeric SpinEdit presentation contract/i
  );
});

test('Standalone Web renders an interactive numeric SpinEdit using the Slider range and step', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Spin', kind: 'window' });
  assert.equal(built.metadata.spinEditStage, 1);
  assert.equal(built.metadata.spinEditMode, 'interactive-number-state-presentation');
  assert.match(built.html, /data-patch-window-spinedit/);
  assert.match(built.html, /patch-spinedit/);
  assert.match(built.html, /editor\.type='number'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:bounded\}\)/);
});

test('Patch Studio exposes SpinEdit as a Slider preset and Inspector mode', () => {
  const studio = fs.readFileSync('web/slider-stage1.js', 'utf8');
  assert.match(studio, /addSpinEdit/);
  assert.match(studio, /\+ SpinEdit/);
  assert.match(studio, /value="spin">SpinEdit/);
  assert.match(studio, /patch-spinedit-input/);
  assert.match(studio, /# @slider-mode spin/);
});


test('Designer duplicate gives SpinEdit an independent source-backed number state', () => {
  const selected = listDesignerControls(SOURCE).find(control => control.type === 'slider' && control.id === 'quantity');
  assert.ok(selected);
  const duplicated = duplicateDesignerControl(SOURCE, selected, { offset: false });
  assert.deepEqual(duplicated.idMap, { quantity: 'slider_1' });
  assert.match(duplicated.source, /create number quantity = 3\ncreate number slider_1 = 3/);
  assert.match(duplicated.source, /# @slider-mode spin\n  slider 0\.\.10 as slider_1 step 1/);
  assert.match(duplicated.source, /when slider_1 changed:/);
  assert.doesNotThrow(() => compile(duplicated.source, { kind: 'window' }));
});

test('Designer clipboard carries SpinEdit number state across cut and cross-project paste', () => {
  const selected = listDesignerControls(SOURCE).find(control => control.type === 'slider' && control.id === 'quantity');
  assert.ok(selected);
  const clipboard = copyDesignerControlClipboard(SOURCE, selected);
  assert.deepEqual(clipboard.backingStates, [{ id: 'quantity', valueType: 'number', source: 'create number quantity = 3' }]);
  assert.ok(clipboard.lines.includes('# @slider-mode spin'));

  const target = `window "Target" as target size 520, 320:\n  text "Ready" at 20, 20 size 120, 24\n`;
  const pasted = pasteDesignerControlClipboard(target, clipboard, { windowIndex: 0, offset: false });
  assert.deepEqual(pasted.idMap, { quantity: 'quantity' });
  assert.match(pasted.source, /^create number quantity = 3/m);
  assert.match(pasted.source, /# @slider-mode spin\n  slider 0\.\.10 as quantity step 1/);
  assert.match(pasted.source, /when quantity changed:/);
  assert.doesNotThrow(() => compile(pasted.source, { kind: 'window' }));
});
