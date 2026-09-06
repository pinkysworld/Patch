import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import {
  PATCH_SLIDER_PRESENTATION_VERSION,
  PATCH_WINDOW_SLIDER_PRESENTATION_VERSION,
  assertPatchSliderPresentationTarget,
  parsePatchSliderPresentationDirective,
  patchSliderPresentationTargetSupport,
  readWindowSliderPresentation,
  setWindowSliderPresentation
} from '../src/slider-presentation.js';

const SOURCE = `create number completion = 35

window "Progress" as main size 520, 260:
  # @slider-mode progress
  slider 0..100 as completion step 1 at 24, 72 size 360, 34
`;

test('ProgressBar Stage 1 presentation vocabulary is versioned and fail-closed by target', () => {
  assert.equal(PATCH_SLIDER_PRESENTATION_VERSION, '0.1');
  assert.equal(PATCH_WINDOW_SLIDER_PRESENTATION_VERSION, '0.1');
  assert.equal(parsePatchSliderPresentationDirective('# @slider-mode progress'), 'progress');
  assert.equal(patchSliderPresentationTargetSupport('progress').studio, 'supported');
  assert.equal(patchSliderPresentationTargetSupport('progress').web, 'supported');
  assert.equal(patchSliderPresentationTargetSupport('progress').windows, 'unsupported');
  assert.doesNotThrow(() => assertPatchSliderPresentationTarget('progress', 'web'));
  assert.throws(() => assertPatchSliderPresentationTarget('progress', 'windows'), /ProgressBar Stage 1 is Studio\/Web only/);
});

test('source-backed ProgressBar metadata round-trips without changing Slider syntax', () => {
  const plain = `create number completion = 0

window "Progress" as main:
  # @layout anchor left right
  # @taborder 2
  # @locked
  slider 0..100 as completion step 1
`;
  const line = plain.split('\n').findIndex(row => /^\s*slider\b/.test(row)) + 1;
  const progress = setWindowSliderPresentation(plain, line, 'progress');
  assert.match(progress, /# @layout anchor left right\n  # @taborder 2\n  # @locked\n  # @slider-mode progress\n  slider/);
  assert.equal(readWindowSliderPresentation(progress, line + 1), 'progress');
  const restored = setWindowSliderPresentation(progress, line + 1, 'plain');
  assert.doesNotMatch(restored, /@slider-mode/);
  assert.match(restored, /slider 0\.\.100 as completion step 1/);
});

test('compiler attaches passive progress presentation while preserving Change IR 0.10', () => {
  const compiled = compile(SOURCE, { name: 'Progress', kind: 'window' });
  const slider = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'slider');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(slider.sliderPresentation, 'progress');
  assert.equal(compiled.windowSliderPresentation.controls.length, 1);
  assert.equal(compiled.windowSliderPresentation.controls[0].mode, 'progress');
  const irSlider = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.code === 'UI_CONTROL');
  assert.equal(irSlider.control, 'slider');
  assert.equal(Object.hasOwn(irSlider, 'sliderPresentation'), false);
});

test('ProgressBar requires explicit matching number state', () => {
  assert.throws(
    () => compile(`window "Bad" as main:\n  # @slider-mode progress\n  slider 0..100 as completion step 1\n`, { kind: 'window' }),
    /ProgressBar 'completion'.*create number completion/i
  );
  assert.throws(
    () => compile(`create text completion = "35"\nwindow "Bad" as main:\n  # @slider-mode progress\n  slider 0..100 as completion step 1\n`, { kind: 'window' }),
    /ProgressBar 'completion'.*create number completion/i
  );
});

test('ProgressBar is passive and has an explicit Studio Web target gate', () => {
  const compiled = compile(SOURCE, { name: 'Progress', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowSlider: true }),
    /ProgressBar Stage 1.*Studio.*Standalone Window Web.*no passive ProgressBar presentation contract/i
  );
  const web = validateWindowRuntimeSupport(compiled, { allowSlider: true, allowProgressBar: true });
  assert.equal(web.sliders, 1);
  assert.equal(web.progressBars, 1);

  const withEvent = compile(`${SOURCE}\nwhen completion changed:\n  show value\n`, { name: 'ProgressEvent', kind: 'window' });
  assert.throws(
    () => validateWindowRuntimeSupport(withEvent, { allowSlider: true, allowProgressBar: true }),
    /ProgressBar 'completion' is passive and exposes no Patch events/i
  );
});

test('Current Ready native fails closed instead of lowering ProgressBar as an interactive Slider', () => {
  const compiled = compile(SOURCE, { name: 'Progress', kind: 'window' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /ProgressBar Stage 1.*Studio\/Web only.*no passive progress presentation contract/i
  );
});

test('Standalone Web renders ProgressBar as a passive progress element', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Progress', kind: 'window' });
  assert.equal(built.metadata.progressBarStage, 1);
  assert.equal(built.metadata.progressBarMode, 'passive-number-state-presentation');
  assert.match(built.html, /createElement\('progress'\)/);
  assert.match(built.html, /data-patch-window-progressbar/);
});

test('Patch Studio exposes ProgressBar as a Slider preset and Inspector mode', () => {
  const studio = fs.readFileSync('web/slider-stage1.js', 'utf8');
  assert.match(studio, /addProgressBar/);
  assert.match(studio, /# @slider-mode progress/);
  assert.match(studio, /ProgressBar is a passive source-backed number-state presentation/);
  assert.match(studio, /buildWindowSliderPresentationManifest/);
  assert.match(studio, /progress\.patch-progressbar-meter/);
  assert.doesNotMatch(studio, /context\.dispatch\([^\n]*ProgressBar/i);
});

test('# @slider-mode on another control is rejected rather than becoming orphan metadata', () => {
  assert.throws(
    () => compile(`create number n = 1\nwindow "Bad" as main:\n  # @slider-mode progress\n  input field\n`, { kind: 'window' }),
    /# @slider-mode belongs only to Slider controls/i
  );
});
