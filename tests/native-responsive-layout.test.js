import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR, flattenNativeGuiControls } from '../src/native-gui-ir.js';
import { emitWin32GuiCpp } from '../src/win32-gui-v08.js';
import { emitAppKitGuiObjCpp } from '../src/appkit-gui-v08.js';
import { emitGtkGuiCpp } from '../src/gtk-gui-v08.js';

const source = `window "Responsive" as main size 640, 420:
  # @layout anchor left right top
  button "Save" as save at 24, 24 size 120, 36
  # @layout anchor right bottom
  button "More" as more at 396, 350 size 220, 36
  # @layout dock bottom
  text "Status" at 24, 380 size 200, 30
`;

test('compiled layout policy reaches Native GUI controls without changing serialized IR 0.7', () => {
  const compiled = compile(source, { kind: 'window' });
  const gui = buildNativeGuiIR(compiled);
  const controls = flattenNativeGuiControls(gui);
  assert.equal(gui.version, '0.7');
  assert.deepEqual(controls[0].layout.policy, { kind: 'anchor', edges: ['left', 'right', 'top'] });
  assert.deepEqual(controls[1].layout.policy, { kind: 'anchor', edges: ['right', 'bottom'] });
  assert.deepEqual(controls[2].layout.policy, { kind: 'dock', side: 'bottom' });
  assert.doesNotMatch(JSON.stringify(gui), /"policy"/);
});

test('Win32 AOT handles Form resize through WM_SIZE', () => {
  const gui = buildNativeGuiIR(compile(source, { kind: 'window' }));
  const generated = emitWin32GuiCpp(gui);
  assert.match(generated, /case WM_SIZE:/);
  assert.match(generated, /ApplyPatchResponsiveLayout\(form, LOWORD\(lParam\), HIWORD\(lParam\)\)/);
  assert.match(generated, /MoveWindow\(gControls\[0\]/);
  assert.match(generated, /const int dw=formWidth-640, dh=formHeight-420/);
});

test('AppKit AOT handles live NSWindow resizing', () => {
  const gui = buildNativeGuiIR(compile(source, { kind: 'window' }));
  const generated = emitAppKitGuiObjCpp(gui);
  assert.match(generated, /windowDidResize:/);
  assert.match(generated, /ApplyPatchResponsiveLayout\(\(int\)self\.formIndex/);
  assert.match(generated, /gControls\[0\]\.frame=NSMakeRect/);
});

test('GTK AOT handles live content allocation changes', () => {
  const gui = buildNativeGuiIR(compile(source, { kind: 'window' }));
  const generated = emitGtkGuiCpp(gui);
  assert.match(generated, /"size-allocate"/);
  assert.match(generated, /OnPatchFormAllocate/);
  assert.match(generated, /gtk_fixed_move\(GTK_FIXED\(gFixed\[formIndex\]\), gControls\[0\]/);
});

test('fixed native apps do not gain resize dispatch code', () => {
  const fixed = `window "Fixed" size 400, 260:\n  button "OK" as ok at 20, 20 size 100, 34\n`;
  const gui = buildNativeGuiIR(compile(fixed, { kind: 'window' }));
  assert.doesNotMatch(emitWin32GuiCpp(gui), /case WM_SIZE:/);
  assert.doesNotMatch(emitAppKitGuiObjCpp(gui), /windowDidResize:/);
  assert.doesNotMatch(emitGtkGuiCpp(gui), /"size-allocate"/);
});
