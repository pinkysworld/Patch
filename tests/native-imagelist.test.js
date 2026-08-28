import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import {
  buildNativeGuiIRV18,
  validateNativeGuiIRV18,
  toV17CompatibleV18,
  flattenNativeGuiControlsV18,
  hasNativeImageList,
  hasNativeButtonImage
} from '../src/native-gui-ir-v18.js';
import { buildNativeGuiIRV17 } from '../src/native-gui-ir-v17.js';
import { buildNativeGuiPlan } from '../src/native-gui-build-plan.js';
import {
  flattenCurrentNativeGuiControls,
  currentNativeContract,
  sealCurrentNativeGuiRuntime,
  decodeCurrentNativeGuiPayload,
  inspectCurrentNativeGuiImageLists
} from '../src/native-current-contract.js';
import {
  encodeNativeGuiPayloadV18,
  inspectNativeGuiImageListsV18,
  sealNativeGuiRuntimeV18
} from '../src/sealed-native-gui-v18.js';
import { resolveNativePictureResources } from '../src/native-picture-resources.js';
import { NativeGuiError } from '../src/native-gui-frozen-lower.js';

const SOURCE = readFileSync('examples/imagelist-window.patch', 'utf8');
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==';
const RESOURCE = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: Buffer.from(TINY_PNG, 'base64').length,
  sha256: '0'.repeat(64),
  data: TINY_PNG
});

function build(source = SOURCE) {
  return buildNativeGuiIRV18(compile(source, { name: 'NativeImageList', kind: 'window' }));
}

test('current native contract is IR 1.8 / payload 18 / runtime 1.9', () => {
  const contract = currentNativeContract();
  assert.equal(contract.id, 'native-gui-1.8/payload-18/runtime-1.9');
  assert.equal(contract.guiIr, '1.8');
  assert.equal(contract.payload, 18);
  assert.equal(contract.runtime, '1.9');
  assert.equal(contract.runtimeTags.windows, 'native-win32-runtime-v1.9');
});

test('Native GUI IR 1.8 carries ImageList and Button images and strips them from the 1.7 underlay', () => {
  const ir = build();
  assert.equal(ir.version, '1.8');
  assert.equal(hasNativeImageList(ir), true);
  assert.equal(hasNativeButtonImage(ir), true);
  assert.equal(ir.imageLists.length, 1);
  assert.equal(ir.imageLists[0].id, 'icons');
  assert.equal(ir.imageLists[0].items[0].name, 'open');
  const button = flattenNativeGuiControlsV18(ir).find(control => control.id === 'open_button');
  assert.equal(button.imageListId, 'icons');
  assert.equal(button.imageItem, 'open');
  assert.equal(button.imageSource, 'patch-resource:icons.open');
  const compatible = toV17CompatibleV18(ir);
  assert.equal(compatible.version, '1.7');
  assert.equal(compatible.imageLists, undefined);
  const shadow = compatible.forms[0].controls.find(item => item.id === 'open_button');
  assert.equal(shadow.imageListId, undefined);
  assert.equal(validateNativeGuiIRV18(ir), ir);
});

test('Native GUI IR 1.7 still fail-closes ImageList Button images', () => {
  const compiled = compile(SOURCE, { name: 'LegacyImageList', kind: 'window' });
  assert.throws(() => buildNativeGuiIRV17(compiled), error => (
    error instanceof NativeGuiError && /ImageList consumers remain fail-closed/i.test(error.message)
  ));
});

test('native resource resolve turns ImageList locators into PNG data URIs', () => {
  const ir = build();
  const resolved = resolveNativePictureResources(ir, [RESOURCE]);
  assert.match(resolved.ir.imageLists[0].items[0].source, /^data:image\/png;base64,/);
  const button = flattenNativeGuiControlsV18(resolved.ir).find(control => control.id === 'open_button');
  assert.match(button.imageSource, /^data:image\/png;base64,/);
  assert.equal(resolved.resolved.some(item => item.consumer === 'imagelist'), true);
  assert.equal(resolved.resolved.some(item => item.consumer === 'button-image'), true);
});

test('native ImageList rejects WebP resources fail-closed', () => {
  const ir = build();
  const webp = { ...RESOURCE, mediaType: 'image/webp', id: 'icons.open' };
  assert.throws(() => resolveNativePictureResources(ir, [webp]), /webp|not a native Ready/i);
});

test('payload v18 wraps v17 with an empty or populated PILT trailer', () => {
  const ir = resolveNativePictureResources(build(), [RESOURCE]).ir;
  const payload = encodeNativeGuiPayloadV18(ir);
  const inspected = inspectNativeGuiImageListsV18(payload);
  assert.equal(inspected.imageLists.length, 1);
  assert.equal(inspected.buttons.length, 1);
  assert.equal(inspected.buttons[0].id, 'open_button');
  assert.match(inspected.buttons[0].source, /^data:image\/png;base64,/);
  const empty = encodeNativeGuiPayloadV18(buildNativeGuiIRV18(compile(readFileSync('examples/paintbox-image-window.patch', 'utf8'), { name: 'Paint', kind: 'window' })));
  const emptyInspected = inspectNativeGuiImageListsV18(empty);
  assert.equal(emptyInspected.imageLists.length, 0);
  assert.equal(emptyInspected.buttons.length, 0);
});

test('current sealer emits payload 18 and inspects ImageList overlays', () => {
  const ir = resolveNativePictureResources(build(), [RESOURCE]).ir;
  const runtime = new Uint8Array([0x4d, 0x5a, 0x00, 0x00]);
  const sealed = sealCurrentNativeGuiRuntime(runtime, ir, { platform: 'windows', resources: [RESOURCE] });
  const payload = decodeCurrentNativeGuiPayload(sealed);
  const inspected = inspectCurrentNativeGuiImageLists(payload);
  assert.equal(inspected.buttons.length, 1);
  const mz = new Uint8Array([0x4d, 0x5a]);
  const sealedDirect = sealNativeGuiRuntimeV18(mz, ir, { platform: 'windows' });
  assert.ok(sealedDirect.length > mz.length);
});

test('build plan selects imagelist-v19 when Button images are present', () => {
  const compiled = compile(SOURCE, { name: 'PlanImageList', kind: 'window' });
  const plan = buildNativeGuiPlan(compiled);
  assert.equal(plan.tier, 'imagelist-v19');
  assert.equal(plan.gui.version, '1.8');
  assert.equal(plan.features.imageList, true);
  assert.equal(plan.features.buttonImage, true);
  assert.equal(flattenCurrentNativeGuiControls(plan.gui).some(control => control.imageItem === 'open'), true);
});
