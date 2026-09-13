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

const SOURCE = `window "Scroll" as main size 520, 220:
  # @slider-mode scrollbar
  slider 0..100 as viewport step 5 at 24, 72 size 360, 28

when viewport changed:
  show value
`;

test('ScrollBar Stage 1 widens the Slider presentation contract to 0.2', () => {
  assert.equal(PATCH_SLIDER_PRESENTATION_VERSION, '0.2');
  assert.equal(PATCH_WINDOW_SLIDER_PRESENTATION_VERSION, '0.2');
  assert.equal(parsePatchSliderPresentationDirective('# @slider-mode scrollbar'), 'scrollbar');
  assert.deepEqual(patchSliderPresentationTargetSupport('scrollbar'), { studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported' });
  assert.doesNotThrow(() => assertPatchSliderPresentationTarget('scrollbar', 'web'));
  assert.throws(() => assertPatchSliderPresentationTarget('scrollbar', 'windows'), /ScrollBar Stage 1 is Studio\/Web only/);
});

test('ScrollBar metadata round-trips on ordinary Slider source', () => {
  const plain = `window "Scroll" as main:
  # @layout anchor left right
  # @taborder 2
  # @locked
  slider 0..100 as viewport step 5
`;
  const line = plain.split('\n').findIndex(row => /^\s*slider\b/.test(row)) + 1;
  const next = setWindowSliderPresentation(plain, line, 'scrollbar');
  assert.match(next, /# @locked\n  # @slider-mode scrollbar\n  slider/);
  assert.equal(readWindowSliderPresentation(next, line + 1), 'scrollbar');
  assert.doesNotMatch(setWindowSliderPresentation(next, line + 1, 'plain'), /@slider-mode/);
});

test('compiler keeps ScrollBar as Slider and Change IR 0.10', () => {
  const compiled = compile(SOURCE, { name: 'Scroll', kind: 'window' });
  const slider = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'slider');
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(slider.sliderPresentation, 'scrollbar');
  assert.equal(compiled.windowSliderPresentation.version, '0.2');
  assert.equal(compiled.windowSliderPresentation.controls[0].mode, 'scrollbar');
  const irSlider = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.code === 'UI_CONTROL');
  assert.equal(irSlider.control, 'slider');
  assert.equal(Object.hasOwn(irSlider, 'sliderPresentation'), false);
});

test('ScrollBar preserves ordinary Slider changed(value) and target gating', () => {
  const compiled = compile(SOURCE, { name: 'Scroll', kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(compiled, { allowSlider: true }), /ScrollBar Stage 1.*Standalone Window Web.*no standalone ScrollBar presentation contract/i);
  const web = validateWindowRuntimeSupport(compiled, { allowSlider: true, allowScrollBar: true });
  assert.equal(web.sliders, 1);
  assert.equal(web.scrollBars, 1);
  assert.equal(web.events, 1);
});

test('Current Ready native fails closed instead of lowering ScrollBar as Slider', () => {
  const compiled = compile(SOURCE, { name: 'Scroll', kind: 'window' });
  assert.throws(() => buildCurrentNativeGuiIR(compiled), /ScrollBar Stage 1.*Studio\/Web only.*no standalone scrollbar presentation contract/i);
});

test('Standalone Web renders interactive ScrollBar styling while retaining range input change semantics', () => {
  const built = buildStandaloneWebApp(SOURCE, { name: 'Scroll', kind: 'window' });
  assert.equal(built.metadata.scrollBarStage, 1);
  assert.equal(built.metadata.scrollBarMode, 'interactive-slider-scrollbar-presentation');
  assert.equal(built.metadata.scrollBarEvent, 'changed-number');
  assert.match(built.html, /data-patch-window-scrollbar/);
  assert.match(built.html, /patch-scrollbar/);
  assert.match(built.html, /aria-roledescription','scroll bar'/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:Number\(input\.value\)\}\)/);
});

test('Patch Studio exposes ScrollBar as Slider preset and Inspector mode', () => {
  const studio = fs.readFileSync('web/slider-stage1.js', 'utf8');
  assert.match(studio, /addScrollBar/);
  assert.match(studio, /\+ ScrollBar/);
  assert.match(studio, /option value="scrollbar">ScrollBar/);
  assert.match(studio, /setWindowSliderPresentation\(next, line, 'scrollbar'\)/);
  assert.match(studio, /patch-scrollbar-studio/);
});
