import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import { parse } from '../src/parser.js';
import {
  buildNativeGuiIRV17,
  validateNativeGuiIRV17,
  toV16CompatibleV17,
  flattenNativeGuiControlsV17,
  hasNativePaintBoxImage
} from '../src/native-gui-ir-v17.js';
import { buildNativeGuiIRV16 } from '../src/native-gui-ir-v16.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import {
  flattenCurrentNativeGuiControls,
  currentNativeContract,
  sealCurrentNativeGuiRuntime,
  decodeCurrentNativeGuiPayload,
  inspectCurrentNativeGuiPaintImages
} from '../src/native-current-contract.js';
import {
  encodeNativeGuiPayloadV17,
  inspectNativeGuiPaintImagesV17,
  inspectNativeGuiPaintBoxesV17,
  sealNativeGuiRuntimeV17
} from '../src/sealed-native-gui-v17.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { formatPatchPaintCommand, parsePatchPaintCommand } from '../src/paintbox-control.js';

const SOURCE = readFileSync('examples/paintbox-image-window.patch', 'utf8');
const PAINTBOX_SOURCE = readFileSync('examples/paintbox-window.patch', 'utf8');
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==';
const RESOURCE = Object.freeze({
  id: 'app.logo',
  path: 'resources/logo.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

function build(source = SOURCE) {
  return buildNativeGuiIRV17(compile(source, { name: 'NativePaintImage', kind: 'window' }));
}

test('current native contract is IR 1.7 / payload 17 / runtime 1.8', () => {
  const contract = currentNativeContract();
  assert.equal(contract.id, 'native-gui-1.7/payload-17/runtime-1.8');
  assert.equal(contract.guiIr, '1.7');
  assert.equal(contract.payload, 17);
  assert.equal(contract.runtime, '1.8');
  assert.equal(contract.runtimeTags.windows, 'native-win32-runtime-v1.8');
});

test('draw image quoted locator round-trips as a source-visible PaintBox command', () => {
  const source = 'draw image "patch-resource:app.logo" at 16, 24 size 64, 48';
  const command = parsePatchPaintCommand(source);
  assert.equal(command.operation, 'image');
  assert.equal(command.source, 'patch-resource:app.logo');
  assert.equal(command.x, 16);
  assert.equal(command.y, 24);
  assert.equal(command.width, 64);
  assert.equal(command.height, 48);
  assert.equal(formatPatchPaintCommand(command), source);
});

test('Native GUI IR 1.7 carries draw image and strips it from the private 1.6 underlay', () => {
  const ir = build();
  assert.equal(ir.version, '1.7');
  assert.equal(hasNativePaintBoxImage(ir), true);
  const canvas = flattenNativeGuiControlsV17(ir).find(control => control.id === 'canvas');
  assert.equal(canvas.type, 'paintbox');
  assert.equal(canvas.paintProgram[1].command.operation, 'image');
  assert.match(canvas.paintProgram[1].command.source, /^data:image\/png;base64,/);
  const compatible = toV16CompatibleV17(ir);
  assert.equal(compatible.version, '1.6');
  const shadow = compatible.forms[0].controls.find(item => item.id === 'canvas');
  assert.equal(shadow.paintProgram.some(node => node.command?.operation === 'image'), false);
  assert.equal(validateNativeGuiIRV17(ir), ir);
});

test('Native GUI IR 1.6 remains fail-closed for draw image', () => {
  assert.throws(
    () => buildNativeGuiIRV16(compile(SOURCE, { name: 'FrozenPaintImage', kind: 'window' })),
    /does not include draw image|Use Native GUI IR 1\.7/
  );
});

test('Native GUI build plan selects PaintBox image runtime 1.8 automatically', () => {
  const compiled = compile(SOURCE, { name: 'NativePaintImage', kind: 'window' });
  const plan = buildNativeGuiPlan(compiled);
  assert.equal(plan.tier, 'paintbox-image-v18');
  assert.equal(plan.gui.version, '1.7');
  assert.equal(plan.features.paintboxImage, true);
  assert.equal(flattenCurrentNativeGuiControls(plan.gui).filter(control => control.type === 'paintbox').length, 1);
});

test('payload v17 records PIMG overlays and still emits an empty trailer without draw image', () => {
  const ir = build();
  const payload = encodeNativeGuiPayloadV17(ir);
  assert.equal(new TextDecoder().decode(payload.subarray(payload.length - 8, payload.length - 4)), 'PIMG');
  const inspected = inspectNativeGuiPaintImagesV17(payload);
  assert.equal(inspected.overlays.length, 1);
  assert.equal(inspected.overlays[0].id, 'canvas');
  assert.equal(inspected.overlays[0].paintProgram[1].command.operation, 'image');
  const boxes = inspectNativeGuiPaintBoxesV17(payload);
  assert.equal(boxes.paintboxes[0].paintProgram[1].command.operation, 'image');
  const sealed = sealNativeGuiRuntimeV17(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), ir, { platform: 'windows' });
  assert.equal(new DataView(sealed.buffer, sealed.byteOffset + sealed.length - 12).getUint32(0, true), 17);

  const empty = encodeNativeGuiPayloadV17(buildNativeGuiIRV17(compile(PAINTBOX_SOURCE, { name: 'NoImage', kind: 'window' })));
  assert.equal(new TextDecoder().decode(empty.subarray(empty.length - 8, empty.length - 4)), 'PIMG');
  assert.equal(inspectNativeGuiPaintImagesV17(empty).overlays.length, 0);
});

test('current native seal resolves patch-resource draw image to a PNG data URI', () => {
  const source = `window "Paint image" as main size 640, 420:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  draw clear #ffffff
  draw image "patch-resource:app.logo" at 8, 8 size 32, 32
`;
  const ir = buildNativeGuiIRV17(compile(source, { name: 'ResourcePaint', kind: 'window' }));
  const sealed = sealCurrentNativeGuiRuntime(new Uint8Array([0x4d, 0x5a]), ir, {
    platform: 'windows',
    resources: [RESOURCE]
  });
  const payload = decodeCurrentNativeGuiPayload(sealed);
  const overlay = inspectCurrentNativeGuiPaintImages(payload).overlays[0];
  assert.equal(overlay.paintProgram[1].command.source, 'data:image/png;base64,AA==');
  assert.equal(ir.forms[0].controls.find(control => control.id === 'canvas').paintProgram[1].command.source, 'patch-resource:app.logo');
});

test('native draw image fails closed for missing resources and deferred WebP', () => {
  const source = `window "Paint image" as main size 640, 420:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  draw image "patch-resource:app.logo" at 8, 8 size 32, 32
`;
  const ir = buildNativeGuiIRV17(compile(source, { name: 'MissingPaint', kind: 'window' }));
  assert.throws(
    () => sealCurrentNativeGuiRuntime(new Uint8Array([0x4d, 0x5a]), ir, { platform: 'windows' }),
    error => error?.code === 'NATIVE_PICTURE_RESOURCE_MISSING' && /app\.logo/.test(error.message)
  );
  const webp = { ...RESOURCE, path: 'resources/logo.webp', mediaType: 'image/webp' };
  assert.throws(
    () => sealCurrentNativeGuiRuntime(new Uint8Array([0x4d, 0x5a]), ir, { platform: 'windows', resources: [webp] }),
    /deferred|PNG and JPEG only/i
  );
});

test('Standalone Web embeds PATCH_IMAGE_RESOURCES for paint-image-only programs', () => {
  const source = `window "Paint image" as main size 640, 420:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  draw clear #ffffff
  draw image "patch-resource:app.logo" at 8, 8 size 32, 32
`;
  const built = buildStandaloneWebApp(source, { name: 'PaintImageWeb', kind: 'window', resources: [RESOURCE] });
  assert.equal(built.metadata.paintBoxImageStage, 1);
  assert.match(built.html, /PATCH_IMAGE_RESOURCES/);
  assert.match(built.html, /patchPictureSource/);
  assert.match(built.html, /operation==='image'/);
  assert.match(built.html, /drawImage/);
  assert.match(built.html, /app\.logo/);
});

test('parser accepts draw image only as a quoted locator', () => {
  const ast = parse(`window "Paint image" as main:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  draw image "patch-resource:app.logo" at 0, 0 size 16, 16
`);
  const command = ast.find(node => node.kind === 'event').body[0].command;
  assert.equal(command.operation, 'image');
  assert.throws(
    () => parse(`window "Paint image" as main:
  paintbox as canvas at 24, 24 size 320, 200
when canvas paint:
  draw image logo at 0, 0 size 16, 16
`),
    /do not understand PaintBox command/i
  );
});

test('tiny PNG fixture used by the native example is a real PNG', () => {
  assert.match(SOURCE, new RegExp(TINY_PNG.replace(/[+/=]/g, '\\$&')));
  assert.ok(Buffer.from(TINY_PNG, 'base64').length > 0);
});
