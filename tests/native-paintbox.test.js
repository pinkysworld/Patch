import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import { parse, PatchSyntaxError } from '../src/parser.js';
import {
  buildNativeGuiIRV16,
  validateNativeGuiIRV16,
  toV15CompatibleV16,
  flattenNativeGuiControlsV16,
  hasNativePaintBoxStage1
} from '../src/native-gui-ir-v16.js';
import { buildNativeGuiIRV15 } from '../src/native-gui-ir-v15.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import { flattenCurrentNativeGuiControls, currentNativeContract } from '../src/native-current-contract.js';
import {
  encodeNativeGuiPayloadV16,
  inspectNativeGuiPaintBoxesV16,
  sealNativeGuiRuntimeV16
} from '../src/sealed-native-gui-v16.js';

const SOURCE = readFileSync('examples/paintbox-window.patch', 'utf8');
const SHAPE_SOURCE = readFileSync('examples/shape-window.patch', 'utf8');

function build(source = SOURCE) {
  return buildNativeGuiIRV16(compile(source, { name: 'NativePaintBox', kind: 'window' }));
}

test('current native contract is IR 1.7 / payload 17 / runtime 1.8', () => {
  const contract = currentNativeContract();
  assert.equal(contract.id, 'native-gui-1.7/payload-17/runtime-1.8');
  assert.equal(contract.guiIr, '1.7');
  assert.equal(contract.payload, 17);
  assert.equal(contract.runtime, '1.8');
  assert.equal(contract.runtimeTags.windows, 'native-win32-runtime-v1.8');
});

test('Native GUI IR 1.6 carries PaintBox Stage 1 programs without leaking Text shadows', () => {
  const ir = build();
  assert.equal(ir.version, '1.6');
  assert.equal(hasNativePaintBoxStage1(ir), true);
  const controls = flattenNativeGuiControlsV16(ir);
  const canvas = controls.find(control => control.id === 'canvas');
  assert.equal(canvas.type, 'paintbox');
  assert.equal(canvas.binding, null);
  assert.equal(canvas.paintProgram[0].kind, 'draw');
  assert.equal(canvas.paintProgram[0].command.operation, 'clear');
  assert.equal(canvas.paintProgram[1].command.operation, 'rectangle');
  assert.equal(canvas.paintProgram[2].command.operation, 'ellipse');
  assert.equal(canvas.paintProgram[3].kind, 'if');
  assert.equal(canvas.paintProgram[3].thenBody[0].command.operation, 'line');
  assert.equal(canvas.paintProgram[4].kind, 'repeat');
  assert.equal(canvas.paintProgram[4].expr, 'ticks');
  assert.equal(canvas.paintProgram[4].body[0].command.operation, 'text');
  assert.equal(validateNativeGuiIRV16(ir), ir);
  assert.equal(JSON.stringify(ir).includes('__patch_native_paintbox_'), false);
  assert.equal((ir.events ?? []).some(event => event.control === 'canvas'), false);
});

test('Native GUI IR 1.6 compatibility projection is private and preserves original PaintBox', () => {
  const ir = build();
  const compatible = toV15CompatibleV16(ir);
  assert.equal(compatible.version, '1.5');
  const shadow = compatible.forms[0].controls.find(item => item.id === 'canvas');
  assert.equal(shadow.type, 'text');
  assert.equal(ir.forms[0].controls.find(item => item.id === 'canvas').type, 'paintbox');
  assert.equal(JSON.stringify(ir).includes('"type":"paintbox"'), true);
});

test('Native GUI build plan selects additive PaintBox runtime 1.7 automatically', () => {
  const compiled = compile(SOURCE, { name: 'NativePaintBox', kind: 'window' });
  const plan = buildNativeGuiPlan(compiled);
  assert.equal(plan.tier, 'paintbox-v17');
  assert.equal(plan.gui.version, '1.7');
  assert.equal(plan.features.paintbox, true);
  assert.equal(flattenCurrentNativeGuiControls(plan.gui).filter(control => control.type === 'paintbox').length, 1);
});

test('frozen Native GUI IR 1.5 remains fail-closed for PaintBox source', () => {
  assert.throws(
    () => buildNativeGuiIRV15(compile(SOURCE, { name: 'FrozenNative', kind: 'window' })),
    /Native GUI IR 1\.5 does not include PaintBox|Use Native GUI IR 1\.6/
  );
});

test('payload v16 records PaintBox Stage 1 programs for runtime v1.7', () => {
  const ir = build();
  const payload = encodeNativeGuiPayloadV16(ir);
  assert.equal(new TextDecoder().decode(payload.subarray(payload.length - 8, payload.length - 4)), 'PPBX');
  const inspected = inspectNativeGuiPaintBoxesV16(payload);
  assert.equal(inspected.paintboxes.length, 1);
  assert.equal(inspected.paintboxes[0].id, 'canvas');
  assert.equal(inspected.paintboxes[0].width, '320');
  assert.equal(inspected.paintboxes[0].height, '200');
  assert.equal(inspected.paintboxes[0].paintProgram[0].command.operation, 'clear');
  assert.equal(inspected.paintboxes[0].paintProgram[4].kind, 'repeat');
  const sealed = sealNativeGuiRuntimeV16(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), ir, { platform: 'windows' });
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12).getUint32(0, true), 16);
});

test('payload v16 still emits an empty PPBX trailer for Shape-only programs', () => {
  const ir = buildNativeGuiIRV16(compile(SHAPE_SOURCE, { name: 'NativeShapeOnPaintBox', kind: 'window' }));
  const payload = encodeNativeGuiPayloadV16(ir);
  assert.equal(new TextDecoder().decode(payload.subarray(payload.length - 8, payload.length - 4)), 'PPBX');
  const inspected = inspectNativeGuiPaintBoxesV16(payload);
  assert.equal(inspected.paintboxes.length, 0);
  assert.ok(inspected.payloadV15.length > 0);
});

test('Native GUI IR 1.6 PaintBox expressions fail closed unless they are literals or simple state names', () => {
  assert.throws(
    () => build(`create number ticks = 2
window "PaintBox" as main:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  repeat ticks + 1:
    draw clear #ffffff
`),
    /must be a literal or simple state name/
  );
});

test('native PaintBox state expressions reject unresolved and non-scalar state instead of silently skipping drawing', () => {
  assert.throws(
    () => build(`window "PaintBox" as main:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  if missing:
    draw clear #ffffff
`),
    /unknown state 'missing'/
  );
  assert.throws(
    () => build(`window "PaintBox" as main:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  repeat missing:
    draw clear #ffffff
`),
    /unknown state 'missing'/
  );
  assert.throws(
    () => build(`create list labels = ["A", "B"]
window "PaintBox" as main:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  if labels:
    draw clear #ffffff
`),
    /unsupported type 'list'.*number, text and boolean state only/
  );
});

test('native PaintBox runtime refresh hooks cover ordinary, Slider and Timer state changes', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v17.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v17.mm', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v17.cpp', 'utf8');
  const shared = readFileSync('native-runtime/sealed-paintbox-v17.hpp', 'utf8');

  assert.match(win32, /WM_TIMER[^\n]*PatchRefreshPaintBoxesV17|msg == WM_TIMER[\s\S]*PatchRefreshPaintBoxesV17/);
  assert.match(appkit, /PatchEventTargetV17/);
  assert.match(appkit, /PatchSliderTargetV17/);
  assert.match(appkit, /PatchChromeTargetV17/);
  assert.match(appkit, /PatchUpgradePaintTargetsV17/);
  assert.match(gtk, /PatchRewireEventsV17/);
  assert.match(gtk, /PatchOnSliderChangedV17/);
  assert.match(gtk, /PatchOnTimerV17/);
  assert.match(gtk, /PatchRefreshExtendedV17/);
  assert.match(shared, /state->type == ST_TEXT[\s\S]*!state->text\.empty\(\)/);
  assert.match(shared, /PatchPaintSimpleIdentV17/);
});

test('Panel Stage 1 still cannot contain PaintBox', () => {
  assert.throws(
    () => parse(`window "Panel PaintBox" as main:
  panel as group at 24, 24 size 280, 160:
    paintbox as canvas
`),
    error => error instanceof PatchSyntaxError && /cannot nest .* PaintBox/i.test(error.message)
  );
});
