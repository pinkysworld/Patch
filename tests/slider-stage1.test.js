import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import { triggerWindowEvent, PATCH_WINDOW_EVENTS_VERSION } from '../src/window-events.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { addDesignerControl, listDesignerControls, updateDesignerControl } from '../src/designer.js';

const SOURCE = `create number volume = 50

window "Mixer" as main size 520, 260:
  slider 0..100 as volume step 5 at 24, 64 size 280, 44

when volume changed:
  change volume:
    set = value
`;

test('Slider Stage 1 parses literal range, step and source-backed layout', () => {
  const ast = parse(SOURCE);
  const windowNode = ast.find(node => node.kind === 'window');
  const slider = windowNode.body.find(node => node.kind === 'uiControl' && node.control === 'slider');
  assert.ok(slider);
  assert.equal(slider.id, 'volume');
  assert.equal(slider.min, 0);
  assert.equal(slider.max, 100);
  assert.equal(slider.step, 5);
  assert.deepEqual(slider.layout, { x: 24, y: 64, width: 280, height: 44 });
});

test('Slider Stage 1 accepts signed decimal ranges and defaults step to one', () => {
  const ast = parse('window "Balance":\n  slider -1.5..1.5 as balance\n');
  const slider = ast[0].body[0];
  assert.equal(slider.min, -1.5);
  assert.equal(slider.max, 1.5);
  assert.equal(slider.step, 1);
});

test('Slider parser rejects reversed/equal ranges and non-positive steps', () => {
  assert.throws(() => parse('window "X":\n  slider 10..10 as bad\n'), /smaller number to a larger number/i);
  assert.throws(() => parse('window "X":\n  slider 10..0 as bad\n'), /smaller number to a larger number/i);
  assert.throws(() => parse('window "X":\n  slider 0..10 as bad step 0\n'), /step must be greater than zero/i);
  assert.throws(() => parse('window "X":\n  slider 0..10 as bad step -1\n'), /step must be greater than zero/i);
});

test('compiler preserves Slider contract without changing Change IR version', () => {
  const compiled = compile(SOURCE, { kind: 'window', name: 'SliderStage1' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.slider'));
  const windowIr = compiled.ir.instructions.find(instruction => instruction.code === 'WINDOW');
  const slider = windowIr.body.find(instruction => instruction.code === 'UI_CONTROL' && instruction.control === 'slider');
  assert.deepEqual(
    { id: slider.id, min: slider.min, max: slider.max, step: slider.step },
    { id: 'volume', min: 0, max: 100, step: 5 }
  );
});

test('Slider changed value is a transient finite number and persistence still requires change', () => {
  assert.equal(PATCH_WINDOW_EVENTS_VERSION, '0.9');
  const runtime = new PatchInterpreter();
  const initial = runtime.run(SOURCE);
  assert.equal(initial.state.volume, 50);
  assert.equal(initial.history.length, 0);

  assert.throws(() => triggerWindowEvent(runtime, 'volume', 'changed', { value: '75' }), /finite number/i);
  const changed = triggerWindowEvent(runtime, 'volume', 'changed', { value: 75 });
  assert.equal(changed.state.volume, 75);
  assert.equal(changed.history.length, 1);
  assert.equal(changed.history[0].cause[0].kind, 'event');
  assert.equal(changed.history[0].cause[0].control, 'volume');
});

test('passive Slider changed handlers cannot persist toolkit state implicitly', () => {
  const passive = `create number level = 25
window "Passive":
  slider 0..100 as level step 5
when level changed:
  show value
`;
  const runtime = new PatchInterpreter();
  runtime.run(passive);
  const result = triggerWindowEvent(runtime, 'level', 'changed', { value: 80 });
  assert.equal(result.state.level, 25);
  assert.equal(result.history.length, 0);
  assert.deepEqual(result.output, ['80']);
});

test('Window target validation opts Slider in explicitly and keeps default paths fail-closed', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(compiled), /Slider is not enabled for this Window target/i);
  const support = validateWindowRuntimeSupport(compiled, { allowSlider: true });
  assert.equal(support.sliders, 1);
  assert.equal(support.events, 1);
});

test('Slider supports changed only and same-name persistent state must be number state', () => {
  const clicked = compile(`window "Bad":\n  slider 0..10 as level\nwhen level clicked:\n  show 1\n`, { kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(clicked, { allowSlider: true }), /Slider 'level' exposes only 'changed'/i);

  const wrongState = compile(`create text level = "five"\nwindow "Bad":\n  slider 0..10 as level\n`, { kind: 'window' });
  assert.throws(() => validateWindowRuntimeSupport(wrongState, { allowSlider: true }), /bind only to number state/i);
});

test('Designer adds and edits Slider range, step, id and layout in Patch source', () => {
  const addedSource = addDesignerControl('window "Designer" as main size 640, 420:\n', 'slider', { windowIndex: 0 });
  assert.match(addedSource, /slider 0\.\.100 as slider_1 step 1 at 24, 24 size 260, 44/);
  let controls = listDesignerControls(addedSource);
  const slider = controls.find(control => control.type === 'slider');
  assert.ok(slider);
  assert.deepEqual(
    { min: slider.min, max: slider.max, step: slider.step, width: slider.width, height: slider.height },
    { min: 0, max: 100, step: 1, width: 260, height: 44 }
  );

  const updatedSource = updateDesignerControl(addedSource, slider, {
    id: 'zoom', min: -2, max: 2, step: 0.25, x: 30, y: 40, width: 300, height: 48
  });
  assert.match(updatedSource, /slider -2\.\.2 as zoom step 0\.25 at 30, 40 size 300, 48/);
  controls = listDesignerControls(updatedSource);
  assert.equal(controls.find(control => control.type === 'slider').id, 'zoom');
});

test('Designer rejects invalid Slider range edits', () => {
  const source = 'window "Designer":\n  slider 0..100 as volume step 1\n';
  const slider = listDesignerControls(source)[0];
  assert.throws(() => updateDesignerControl(source, slider, { min: 100 }), /minimum must be smaller/i);
  assert.throws(() => updateDesignerControl(source, slider, { step: 0 }), /step must be greater than zero/i);
});
