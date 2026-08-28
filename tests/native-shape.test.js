import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import {
  buildNativeGuiIRV15,
  validateNativeGuiIRV15,
  toV14CompatibleV15,
  flattenNativeGuiControlsV15,
  hasNativeShapeStage1
} from '../src/native-gui-ir-v15.js';
import { buildNativeGuiIRV14 } from '../src/native-gui-ir-v14.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import { flattenCurrentNativeGuiControls, currentNativeContract } from '../src/native-current-contract.js';
import {
  encodeNativeGuiPayloadV15,
  inspectNativeGuiShapesV15,
  sealNativeGuiRuntimeV15
} from '../src/sealed-native-gui-v15.js';

const SOURCE = readFileSync('examples/shape-window.patch', 'utf8');

function build(source = SOURCE) {
  return buildNativeGuiIRV15(compile(source, { name: 'NativeShape', kind: 'window' }));
}

test('current native contract is IR 1.5 / payload 15 / runtime 1.6', () => {
  const contract = currentNativeContract();
  assert.equal(contract.id, 'native-gui-1.5/payload-15/runtime-1.6');
  assert.equal(contract.guiIr, '1.5');
  assert.equal(contract.payload, 15);
  assert.equal(contract.runtime, '1.6');
  assert.equal(contract.runtimeTags.windows, 'native-win32-runtime-v1.6');
});

test('Native GUI IR 1.5 carries Shape kinds fill stroke radius and opacity', () => {
  const ir = build();
  assert.equal(ir.version, '1.5');
  assert.equal(hasNativeShapeStage1(ir), true);
  const controls = flattenNativeGuiControlsV15(ir);
  assert.deepEqual(controls.filter(control => control.type === 'shape').map(control => control.id), ['box', 'card', 'badge', 'divider']);
  const card = controls.find(control => control.id === 'card');
  assert.equal(card.shapeKind, 'rounded');
  assert.equal(card.fill, '#fef3c7');
  assert.equal(card.stroke, '#d97706');
  assert.equal(card.strokeWidth, 3);
  assert.equal(card.cornerRadius, 16);
  assert.equal(card.opacity, 1);
  const badge = controls.find(control => control.id === 'badge');
  assert.equal(badge.shapeKind, 'ellipse');
  assert.equal(badge.opacity, 0.85);
  const divider = controls.find(control => control.id === 'divider');
  assert.equal(divider.shapeKind, 'line');
  assert.equal(divider.fill, 'transparent');
  assert.equal(validateNativeGuiIRV15(ir), ir);
  assert.equal(JSON.stringify(ir).includes('__patch_native_shape_'), false);
});

test('Native GUI IR 1.5 compatibility projection is private and preserves original Shape', () => {
  const ir = build();
  const compatible = toV14CompatibleV15(ir);
  assert.equal(compatible.version, '1.4');
  const shadow = compatible.forms[0].controls.find(item => item.id === 'card');
  assert.equal(shadow.type, 'text');
  assert.equal(ir.forms[0].controls.find(item => item.id === 'card').type, 'shape');
  assert.equal(JSON.stringify(ir).includes('"type":"shape"'), true);
});

test('Native GUI build plan selects additive Shape runtime 1.6 automatically', () => {
  const compiled = compile(SOURCE, { name: 'NativeShape', kind: 'window' });
  const plan = buildNativeGuiPlan(compiled);
  assert.equal(plan.tier, 'shape-v16');
  assert.equal(plan.gui.version, '1.5');
  assert.equal(plan.features.shape, true);
  assert.equal(flattenCurrentNativeGuiControls(plan.gui).filter(control => control.type === 'shape').length, 4);
});

test('frozen Native GUI IR 1.4 remains fail-closed for Shape source', () => {
  assert.throws(
    () => buildNativeGuiIRV14(compile(SOURCE, { name: 'FrozenNative', kind: 'window' })),
    /Native GUI IR 1\.4 does not include Shape|Use Native GUI IR 1\.5/
  );
});

test('payload v15 records Shape Stage 1 metadata for runtime v1.6', () => {
  const ir = build();
  const payload = encodeNativeGuiPayloadV15(ir);
  assert.equal(new TextDecoder().decode(payload.subarray(payload.length - 8, payload.length - 4)), 'PSHP');
  const inspected = inspectNativeGuiShapesV15(payload);
  assert.deepEqual(inspected.shapes.map(item => item.shapeKind), ['rectangle', 'rounded', 'ellipse', 'line']);
  assert.equal(inspected.shapes.find(item => item.id === 'card').cornerRadius, '16');
  assert.equal(inspected.shapes.find(item => item.id === 'badge').opacity, '0.85');
  const sealed = sealNativeGuiRuntimeV15(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), ir, { platform: 'windows' });
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12).getUint32(0, true), 15);
});

test('Shape can nest inside a Panel without becoming a second persistent model', () => {
  const ir = build(`window "Panel Shape" as main:
  panel as group at 24, 24 size 280, 160:
    shape rounded as card fill #dbeafe stroke #2563eb stroke-width 2 radius 12 opacity 1
    text "Caption"
`);
  const card = flattenNativeGuiControlsV15(ir).find(control => control.id === 'card');
  assert.equal(card.type, 'shape');
  assert.ok(card.parentPanelIndex >= 0);
});
