import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR, flattenNativeGuiControls } from '../src/native-gui-ir.js';
import {
  PATCH_SEALED_NATIVE_GUI_VERSION,
  PATCH_SEALED_NATIVE_GUI_PREVIOUS_VERSION,
  encodeNativeGuiPayload,
  sealNativeGuiRuntime
} from '../src/sealed-native-gui.js';

const source = fs.readFileSync('examples/responsive-window.patch', 'utf8');
const gui = buildNativeGuiIR(compile(source, { name: 'ResponsiveReady', kind: 'window' }));
const header = fs.readFileSync('native-runtime/sealed-responsive-v09.hpp', 'utf8');
const win = fs.readFileSync('native-runtime/win32-sealed-gui-v09.cpp', 'utf8');
const mac = fs.readFileSync('native-runtime/appkit-sealed-gui-v09.mm', 'utf8');
const gtk = fs.readFileSync('native-runtime/gtk-sealed-gui-v09.cpp', 'utf8');
const workflow = fs.readFileSync('.github/workflows/native-responsive-runtime.yml', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const offline = fs.readFileSync('.github/workflows/offline-compiler.yml', 'utf8');
const winSealer = fs.readFileSync('scripts/seal-native-win32.js', 'utf8');
const macSealer = fs.readFileSync('scripts/seal-native-macos.js', 'utf8');
const linuxSealer = fs.readFileSync('scripts/seal-native-linux.js', 'utf8');

test('sealed GUI v8 is current while v7 remains explicit compatibility', () => {
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 8);
  assert.equal(PATCH_SEALED_NATIVE_GUI_PREVIOUS_VERSION, 7);
  const controls = flattenNativeGuiControls(gui);
  const defaultPayload = encodeNativeGuiPayload(gui);
  const v7 = encodeNativeGuiPayload(gui, { version: 7 });
  const v8 = encodeNativeGuiPayload(gui, { version: 8 });
  assert.deepEqual(defaultPayload, v8);
  assert.equal(v8.length - v7.length, controls.length * 2);
  assert.throws(() => encodeNativeGuiPayload(gui, { version: 9 }), /unsupported sealed native gui version/i);

  const fakePe = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4]);
  const sealed7 = sealNativeGuiRuntime(fakePe, gui, { version: 7 });
  const sealed8 = sealNativeGuiRuntime(fakePe, gui);
  assert.equal(new DataView(sealed7.buffer, sealed7.byteOffset + sealed7.length - 12, 4).getUint32(0, true), 7);
  assert.equal(new DataView(sealed8.buffer, sealed8.byteOffset + sealed8.length - 12, 4).getUint32(0, true), 8);
});

test('legacy v0.8 sealing scripts remain pinned to payload v7', () => {
  for (const sourceText of [winSealer, macSealer, linuxSealer]) {
    assert.match(sourceText, /PATCH_SEALED_GUI_VERSION \?\? 7/);
    assert.match(sourceText, /version: payloadVersion/);
  }
  assert.match(workflow, /PATCH_SEALED_GUI_VERSION: 8/);
});

test('shared v0.9 decoder strips exactly the v8 layout extension before invoking the proven v7 parser', () => {
  for (const marker of [
    'PatchConvertPayloadV8ToV7',
    'PatchLayoutPolicyV09',
    'PatchValidLayoutPolicyV09',
    'PatchApplyLayoutPolicyV09',
    'policy.kind == 1',
    'policy.kind == 2'
  ]) assert.ok(header.includes(marker), marker);
  assert.match(header, /cursor\.takeU8\(\), cursor\.takeU8\(\)/);
});

test('sealed Win32 v0.9 consumes payload v8 and responds to WM_SIZE', () => {
  for (const marker of ['version != 8','PatchConvertPayloadV8ToV7','ApplyPatchResponsiveLayoutV09','WM_SIZE','MoveWindow','RunPatchResponsiveSmokeV09','ApplyPatchAccessibilityV09']) assert.ok(win.includes(marker), marker);
});

test('sealed AppKit v0.9 consumes payload v8 and observes live window resizing', () => {
  for (const marker of ['version != 8','PatchConvertPayloadV8ToV7','ApplyPatchResponsiveLayoutV09','NSWindowDidResizeNotification','windowDidResize:','RunPatchResponsiveSmokeV09','ApplyPatchAccessibilityV09']) assert.ok(mac.includes(marker), marker);
});

test('sealed GTK v0.9 consumes payload v8 and follows GtkFixed allocation changes', () => {
  for (const marker of ['version != 8','PatchConvertPayloadV8ToV7','ApplyPatchResponsiveLayoutV09','size-allocate','gtk_fixed_move','RunPatchResponsiveSmokeV09','ApplyPatchAccessibilityV09']) assert.ok(gtk.includes(marker), marker);
});

test('responsive runtime workflow builds and publishes one v0.9 release line per supported desktop backend', () => {
  assert.match(workflow, /win32-sealed-gui-v09\.cpp/);
  assert.match(workflow, /appkit-sealed-gui-v09\.mm/);
  assert.match(workflow, /gtk-sealed-gui-v09\.cpp/);
  assert.match(workflow, /native-win32-runtime-v0\.9/);
  assert.match(workflow, /native-macos-runtime-v0\.9/);
  assert.match(workflow, /native-linux-runtime-v0\.9/);
  assert.match(workflow, /examples\/responsive-window\.patch/);
  assert.match(workflow, /readUInt32LE\(sealed\.length-12\)!==8/);
});

test('Pages and offline compiler consume only the published v0.9 responsive runtime line', () => {
  for (const tag of ['native-win32-runtime-v0.9','native-macos-runtime-v0.9','native-linux-runtime-v0.9']) {
    assert.ok(pages.includes(tag), `Pages missing ${tag}`);
    assert.ok(offline.includes(tag), `offline compiler missing ${tag}`);
  }
  assert.match(pages, /cancel-in-progress: \$\{\{ github\.event_name == 'push' \}\}/);
  assert.match(offline, /examples\/responsive-window\.patch/);
  assert.match(offline, /--patch-smoke/);
});
