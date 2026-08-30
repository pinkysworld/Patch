import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { NativeGuiError } from '../src/native-gui-frozen-lower.js';
import {
  PATCH_NATIVE_GUI_IR_V18_VERSION,
  buildNativeGuiIRV18,
  validateNativeGuiIRV18,
  flattenNativeGuiControlsV18,
  hasNativeButtonImage,
  toV17CompatibleV18
} from '../src/native-gui-ir-v18.js';
import { validateNativeGuiIRV17 } from '../src/native-gui-ir-v17.js';
import { buildCurrentNativeGuiIR, currentNativeContract } from '../src/native-current-contract.js';

const SOURCE = `window "Files" as main size 460, 240:
  imagelist as app_images size 20, 18:
    image open from "patch-resource:icons.open"
    image save from "patch-resource:icons.save"
  button "Open" as open_button image app_images.open at 24, 24 size 120, 36
  button "Open again" as open_again image app_images.open at 24, 72 size 140, 36
`;

function build(source = SOURCE) {
  return buildNativeGuiIRV18(compile(source, { name: 'ButtonImages', kind: 'window', entry: 'main.patch' }));
}

test('Native GUI IR 1.8 preserves Button ImageList resource metadata', () => {
  const ir = build();
  assert.equal(PATCH_NATIVE_GUI_IR_V18_VERSION, '1.8');
  assert.equal(ir.version, '1.8');
  assert.equal(hasNativeButtonImage(ir), true);
  const controls = flattenNativeGuiControlsV18(ir);
  const open = controls.find(control => control.id === 'open_button');
  assert.deepEqual(open.image, {
    imageListId: 'app_images',
    imageItem: 'open',
    resourceId: 'icons.open',
    logicalWidth: 20,
    logicalHeight: 18
  });
  assert.deepEqual(controls.find(control => control.id === 'open_again').image, open.image);
  assert.equal(validateNativeGuiIRV18(ir), ir);
});

test('Native GUI IR 1.8 projects exactly to a valid image-free IR 1.7 underlay', () => {
  const ir = build();
  const compatible = toV17CompatibleV18(ir);
  assert.equal(compatible.version, '1.7');
  assert.equal(hasNativeButtonImage(compatible), false);
  assert.equal(flattenNativeGuiControlsV18(ir).filter(control => control.image).length, 2);
  for (const form of compatible.forms) {
    for (const control of form.controls) assert.equal(control.image, undefined);
  }
  assert.equal(validateNativeGuiIRV17(compatible), compatible);
});

test('IR 1.8 supports Button image metadata inside a supported Panel hierarchy', () => {
  const source = `window "Panel image" as main size 500, 300:
  imagelist as app_images size 16, 16:
    image open from "patch-resource:icons.open"
  panel as tools at 20, 20 size 300, 120:
    button "Open" as open_button image app_images.open at 8, 8 size 120, 36
`;
  const ir = build(source);
  const button = flattenNativeGuiControlsV18(ir).find(control => control.id === 'open_button');
  assert.equal(button.parentPanelIndex >= 0, true);
  assert.equal(button.image.resourceId, 'icons.open');
});

test('IR 1.8 validation fails closed for malformed Button image metadata', () => {
  const ir = build();
  const broken = structuredClone(ir);
  const button = broken.forms[0].controls.find(control => control.id === 'open_button');
  button.image.logicalWidth = 0;
  assert.throws(
    () => validateNativeGuiIRV18(broken),
    error => error instanceof NativeGuiError && /logical width/.test(error.message)
  );

  const wrongControl = structuredClone(ir);
  wrongControl.forms[0].controls.find(control => control.id === 'open_button').type = 'text';
  assert.throws(
    () => validateNativeGuiIRV18(wrongControl),
    error => error instanceof NativeGuiError && /only on Button/.test(error.message)
  );
});

test('current product contract remains fail-closed at IR 1.7 until desktop runtime promotion', () => {
  const contract = currentNativeContract();
  assert.equal(contract.id, 'native-gui-1.7/payload-17/runtime-1.8');
  assert.equal(contract.guiIr, '1.7');
  assert.throws(
    () => buildCurrentNativeGuiIR(compile(SOURCE, { name: 'CurrentStillFrozen', kind: 'window', entry: 'main.patch' })),
    /does not transport image app_images\.open/
  );
});
