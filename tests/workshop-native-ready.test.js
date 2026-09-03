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
  buildCurrentNativeGuiIR,
  flattenCurrentNativeGuiControls
} from '../src/native-current-contract.js';

const source = fs.readFileSync('examples/workshop-desk.patch', 'utf8');

test('Workshop Desk builds on current Ready across the complete Component Registry 0.9 showcase', () => {
  const compiled = compile(source, { name: 'WorkshopDesk', kind: 'window', entry: 'main.patch' });
  const support = validateWindowRuntimeSupport(compiled, {
    allowTables: true,
    allowLists: true,
    allowListControls: true,
    allowMenuDecorations: true,
    allowTree: true,
    allowSlider: true,
    allowPaintBox: true,
    allowImageList: true
  });

  assert.equal(support.treeViews, 3);
  assert.equal(support.sliders, 5);
  assert.equal(support.paintboxes, 2);
  assert.equal(support.imageLists, 1);
  assert.equal(PATCH_CURRENT_NATIVE_CONTRACT_ID, 'native-gui-1.9/payload-19/runtime-1.10');
  assert.equal(PATCH_CURRENT_NATIVE_GUI_IR_VERSION, '1.9');
  assert.equal(PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, 19);
  assert.equal(PATCH_CURRENT_NATIVE_RUNTIME_VERSION, '1.10');

  const ir = buildCurrentNativeGuiIR(compiled);
  const controls = flattenCurrentNativeGuiControls(ir);
  const paintboxes = controls.filter(control => control.type === 'paintbox');
  assert.equal(ir.version, '1.9');
  assert.equal(controls.filter(control => control.type === 'tree').length, 3);
  assert.equal(controls.filter(control => control.type === 'slider').length, 5);
  assert.equal(controls.filter(control => control.type === 'timer').length, 3);
  assert.equal(controls.filter(control => control.type === 'panel').length, 2);
  assert.equal(controls.filter(control => control.type === 'shape').length, 2);
  assert.equal(controls.filter(control => control.type === 'picture').length, 2);
  assert.equal(controls.filter(control => control.type === 'paintbox').length, 2);
  assert.equal(controls.filter(control => control.type === 'imagelist').length, 1);
  assert.equal(paintboxes.length, 2);
  assert.match(JSON.stringify(paintboxes.find(control => control.id === 'ticket_canvas')?.paintProgram), /"operation":"image"/);
  assert.match(JSON.stringify(paintboxes.find(control => control.id === 'ticket_canvas')?.paintProgram), /data:image\/png;base64,/);
  assert.match(JSON.stringify(paintboxes.find(control => control.id === 'gallery_canvas')?.paintProgram), /"operation":"rectangle"/);
});

test('Workshop Desk still fails closed when TreeView is not explicitly enabled at a legacy boundary', () => {
  const compiled = compile(source, { name: 'WorkshopDesk', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTables: true, allowLists: true, allowListControls: true, allowSlider: true, allowPaintBox: true, allowImageList: true }),
    /TreeView is not enabled for this Window target/
  );
});
