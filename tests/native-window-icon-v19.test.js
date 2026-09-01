import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { NativeGuiError } from '../src/native-gui-frozen-lower.js';
import {
  PATCH_NATIVE_GUI_IR_V19_VERSION,
  buildNativeGuiIRV19,
  validateNativeGuiIRV19,
  flattenNativeGuiControlsV19,
  hasNativeWindowIcon,
  toV18CompatibleV19
} from '../src/native-gui-ir-v19.js';
import { validateNativeGuiIRV18, hasNativeButtonImage } from '../src/native-gui-ir-v18.js';
import { buildCurrentNativeGuiIR, currentNativeContract, currentNativeHasWindowIcon } from '../src/native-current-contract.js';

const SOURCE = `window "Files" as main size 460, 240 icon "patch-resource:app.icon":
  imagelist as app_images size 20, 18:
    image open from "patch-resource:icons.open"
  button "Open" as open_button image app_images.open at 24, 24 size 120, 36

window "Settings" as settings size 420, 220 icon "patch-resource:settings.icon":
  button "Close" as close_button at 24, 24 size 120, 36
`;

function build(source = SOURCE) {
  return buildNativeGuiIRV19(compile(source, { name: 'WindowIcons', kind: 'window', entry: 'main.patch' }));
}

test('Native GUI IR 1.9 preserves Form icons over the IR 1.8 Button ImageList contract', () => {
  const ir = build();
  assert.equal(PATCH_NATIVE_GUI_IR_V19_VERSION, '1.9');
  assert.equal(ir.version, '1.9');
  assert.equal(hasNativeWindowIcon(ir), true);
  assert.equal(hasNativeButtonImage(ir), true);
  assert.deepEqual(ir.forms[0].icon, { resourceId: 'app.icon', application: true });
  assert.deepEqual(ir.forms[1].icon, { resourceId: 'settings.icon', application: false });
  const open = flattenNativeGuiControlsV19(ir).find(control => control.id === 'open_button');
  assert.equal(open.image.resourceId, 'icons.open');
  assert.equal(validateNativeGuiIRV19(ir), ir);
});

test('Native GUI IR 1.9 projects exactly to a valid icon-free IR 1.8 underlay while retaining Button images', () => {
  const ir = build();
  const compatible = toV18CompatibleV19(ir);
  assert.equal(compatible.version, '1.8');
  assert.equal(hasNativeWindowIcon(compatible), false);
  assert.equal(hasNativeButtonImage(compatible), true);
  assert.equal(compatible.forms[0].icon, undefined);
  assert.equal(compatible.forms[1].icon, undefined);
  assert.equal(validateNativeGuiIRV18(compatible), compatible);
});

test('IR 1.9 selects the first icon-bearing Form as application icon even when the first Form has no icon', () => {
  const source = `window "Plain" as main size 320, 180:
  text "Plain"

window "Settings" as settings size 420, 220 icon "patch-resource:settings.icon":
  text "Settings"

window "About" as about size 360, 200 icon "patch-resource:about.icon":
  text "About"
`;
  const ir = build(source);
  assert.equal(ir.forms[0].icon, undefined);
  assert.deepEqual(ir.forms[1].icon, { resourceId: 'settings.icon', application: true });
  assert.deepEqual(ir.forms[2].icon, { resourceId: 'about.icon', application: false });
});

test('IR 1.9 supports programs without icons without changing their IR 1.8 semantics', () => {
  const source = `window "Plain" as main size 320, 180:
  button "OK" as ok_button at 24, 24 size 100, 36
`;
  const ir = build(source);
  assert.equal(hasNativeWindowIcon(ir), false);
  assert.equal(ir.version, '1.9');
  assert.equal(validateNativeGuiIRV18(toV18CompatibleV19(ir)).version, '1.8');
});

test('IR 1.9 fails closed for non-project icon locators and malformed icon metadata', () => {
  const external = `window "External" as main icon "https://example.test/icon.png":
  text "External"
`;
  assert.throws(
    () => build(external),
    error => error instanceof NativeGuiError && /project resource locator/.test(error.message)
  );

  const malformed = structuredClone(build());
  malformed.forms[0].icon.resourceId = 'bad id';
  assert.throws(
    () => validateNativeGuiIRV19(malformed),
    error => error instanceof NativeGuiError && /invalid icon resource id/.test(error.message)
  );

  const wrongApplicationOwner = structuredClone(build());
  wrongApplicationOwner.forms[0].icon.application = false;
  wrongApplicationOwner.forms[1].icon.application = true;
  assert.throws(
    () => validateNativeGuiIRV19(wrongApplicationOwner),
    error => error instanceof NativeGuiError && /first icon-bearing Form/.test(error.message)
  );
});

test('current native product contract promotes IR 1.9 and transports Window icons', () => {
  const contract = currentNativeContract();
  assert.equal(contract.id, 'native-gui-1.9/payload-19/runtime-1.10');
  assert.equal(contract.guiIr, '1.9');
  const current = buildCurrentNativeGuiIR(compile(SOURCE, { name: 'CurrentWindowIcons', kind: 'window', entry: 'main.patch' }));
  assert.equal(current.version, '1.9');
  assert.equal(currentNativeHasWindowIcon(current), true);
  assert.deepEqual(current.forms[0].icon, { resourceId: 'app.icon', application: true });
});
