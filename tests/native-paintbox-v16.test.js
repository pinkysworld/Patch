import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import {
  buildNativeGuiIRV16,
  validateNativeGuiIRV16,
  toV15CompatibleV16,
  flattenNativeGuiControlsV16,
  PATCH_NATIVE_GUI_IR_V16_VERSION
} from '../src/native-gui-ir-v16.js';
import { adaptNativePaintBoxForV16Backend } from '../src/native-paintbox-backend-adapter.js';
import {
  encodeNativeGuiPayloadV16,
  inspectNativeGuiPaintBoxesV16,
  inspectNativeGuiShapesV16,
  PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION,
  PATCH_SEALED_NATIVE_GUI_PAINTBOX_EXTENSION_MAGIC
} from '../src/sealed-native-gui-v16.js';

const source = `create number count = 2

window "Paint Native" as main size 720, 480:
  shape rounded as frame fill #eeeeee stroke #222222 stroke-width 2 radius 12 opacity 1 at 20, 20 size 360, 260
  paintbox as canvas at 40, 40 size 320, 200

when canvas paint:
  draw clear #ffffff
  if count > 0:
    draw rectangle 10, 12 size 100, 50 fill #ff0000 stroke #000000 width 2
  else:
    draw ellipse 10, 12 size 100, 50 fill transparent stroke #000000 width 2
  repeat count:
    draw text "Tick" at 12, 20 color #111111 size 14
`;

test('Native GUI IR 1.6 transports pure PaintBox program without widening Change IR', () => {
  const compiled = compile(source, { name: 'NativePaintBox', kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  const ir = buildNativeGuiIRV16(compiled);
  assert.equal(ir.version, PATCH_NATIVE_GUI_IR_V16_VERSION);
  assert.equal(validateNativeGuiIRV16(ir), ir);
  const controls = flattenNativeGuiControlsV16(ir);
  const paintbox = controls.find(control => control.type === 'paintbox');
  assert.ok(paintbox);
  assert.equal(paintbox.id, 'canvas');
  assert.equal(paintbox.paintProgram[0].kind, 'draw');
  assert.equal(paintbox.paintProgram[1].kind, 'if');
  assert.equal(paintbox.paintProgram[1].expr, 'count > 0');
  assert.equal(paintbox.paintProgram[2].kind, 'repeat');
  assert.equal(paintbox.paintProgram[2].expr, 'count');
  assert.equal(ir.events.some(event => event.control === 'canvas' && event.event === 'paint'), false);
});

test('Native GUI IR 1.6 compatibility projection preserves ordering and Shape v1.5', () => {
  const ir = buildNativeGuiIRV16(compile(source, { name: 'NativePaintBoxCompat', kind: 'window' }));
  const adapted = adaptNativePaintBoxForV16Backend(ir);
  assert.equal(adapted.paintboxes.length, 1);
  assert.equal(adapted.paintboxes[0].id, 'canvas');
  assert.equal(adapted.paintboxes[0].shadowType, 'text');
  const compatible = toV15CompatibleV16(ir);
  assert.equal(compatible.version, '1.5');
  assert.equal(flattenNativeGuiControlsV16(ir).length, adapted.compatibleControls.length);
  assert.equal(adapted.compatibleControls[adapted.paintboxes[0].nativeIndex].type, 'text');
  assert.equal(flattenNativeGuiControlsV16(ir).some(control => control.type === 'shape'), true);
});

test('sealed payload v16 appends bounded PaintBox program over exact payload v15', () => {
  const ir = buildNativeGuiIRV16(compile(source, { name: 'NativePaintBoxPayload', kind: 'window' }));
  const payload = encodeNativeGuiPayloadV16(ir);
  const inspected = inspectNativeGuiPaintBoxesV16(payload);
  assert.equal(PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION, 16);
  assert.equal(PATCH_SEALED_NATIVE_GUI_PAINTBOX_EXTENSION_MAGIC, 'PPBX');
  assert.equal(inspected.paintboxes.length, 1);
  assert.equal(inspected.paintboxes[0].id, 'canvas');
  assert.equal(inspected.paintboxes[0].paintProgram[1].then[0].command.operation, 'rectangle');
  assert.equal(inspected.paintboxes[0].paintProgram[1].else[0].command.operation, 'ellipse');
  assert.equal(inspected.paintboxes[0].paintProgram[2].body[0].command.textExpr, '"Tick"');
  const shapeInfo = inspectNativeGuiShapesV16(payload);
  assert.equal(shapeInfo.shapes.length, 1);
  assert.equal(shapeInfo.shapes[0].id, 'frame');
});

test('Native GUI IR 1.6 composes multiple source-visible OnPaint handlers in order', () => {
  const multiple = `window "Paint" as main size 400, 300:
  paintbox as canvas at 20, 20 size 200, 160

when canvas paint:
  draw clear #ffffff

when canvas paint:
  draw line 0, 0 to 100, 100 stroke #111111 width 2
`;
  const ir = buildNativeGuiIRV16(compile(multiple, { name: 'NativePaintBoxMultiple', kind: 'window' }));
  const canvas = flattenNativeGuiControlsV16(ir).find(control => control.type === 'paintbox');
  assert.equal(canvas.paintProgram.length, 2);
  assert.equal(canvas.paintProgram[0].command.operation, 'clear');
  assert.equal(canvas.paintProgram[1].command.operation, 'line');
});

test('Native GUI IR 1.6 rejects runtime paint events and malformed programs', () => {
  const ir = buildNativeGuiIRV16(compile(source, { name: 'NativePaintBoxInvalid', kind: 'window' }));
  const badEvent = structuredClone(ir);
  badEvent.events.push({ control: 'canvas', event: 'paint', actions: [] });
  assert.throws(() => validateNativeGuiIRV16(badEvent), /pure paintProgram metadata/i);

  const badProgram = structuredClone(ir);
  const canvas = badProgram.forms[0].controls.find(control => control.type === 'paintbox');
  canvas.paintProgram = [{ kind: 'change' }];
  assert.throws(() => validateNativeGuiIRV16(badProgram), /unsupported paint node/i);
});
