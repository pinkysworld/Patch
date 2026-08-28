import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import {
  PATCH_CURRENT_NATIVE_CONTRACT_ID,
  PATCH_CURRENT_NATIVE_GUI_IR_VERSION,
  PATCH_CURRENT_NATIVE_PAYLOAD_VERSION,
  PATCH_CURRENT_NATIVE_RUNTIME_VERSION,
  buildCurrentNativeGuiIR
} from '../src/native-current-contract.js';

const source = fs.readFileSync('examples/workshop-desk.patch', 'utf8');

test('Workshop Desk Ready support includes TreeView and Slider while Table list assignment stays fail-closed', () => {
  const compiled = compile(source, { name: 'WorkshopDesk', kind: 'window', entry: 'main.patch' });
  const support = validateWindowRuntimeSupport(compiled, {
    allowTables: true,
    allowLists: true,
    allowListControls: true,
    allowMenuDecorations: true,
    allowTree: true,
    allowSlider: true
  });

  assert.equal(support.treeViews, 1);
  assert.equal(support.sliders, 2);
  assert.equal(PATCH_CURRENT_NATIVE_CONTRACT_ID, 'native-gui-1.4/payload-14/runtime-1.5');
  assert.equal(PATCH_CURRENT_NATIVE_GUI_IR_VERSION, '1.4');
  assert.equal(PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, 14);
  assert.equal(PATCH_CURRENT_NATIVE_RUNTIME_VERSION, '1.5');

  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /native Table row value is list-valued and cannot be assigned to scalar native state yet/
  );
});

test('Workshop Desk still fails closed when TreeView is not explicitly enabled at a legacy boundary', () => {
  const compiled = compile(source, { name: 'WorkshopDesk', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTables: true, allowLists: true, allowListControls: true, allowSlider: true }),
    /TreeView is not enabled for this Window target/
  );
});
