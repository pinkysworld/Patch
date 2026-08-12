import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PATCH_SEALED_NATIVE_GUI_MAGIC, PATCH_SEALED_NATIVE_GUI_VERSION } from '../src/sealed-native-gui.js';

const win = fs.readFileSync('native-runtime/win32-sealed-gui-v08.cpp', 'utf8');
const mac = fs.readFileSync('native-runtime/appkit-sealed-gui-v08.mm', 'utf8');
const gtk = fs.readFileSync('native-runtime/gtk-sealed-gui-v08.cpp', 'utf8');
const winWorkflow = fs.readFileSync('.github/workflows/native-win32-runtime.yml', 'utf8');
const macWorkflow = fs.readFileSync('.github/workflows/native-macos-runtime.yml', 'utf8');
const linuxWorkflow = fs.readFileSync('.github/workflows/native-linux-runtime.yml', 'utf8');
const pagesWorkflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');

test('sealed runtime accessibility v0.8 deliberately preserves payload v7 and overlays v0.7 runtime logic', () => {
  assert.equal(PATCH_SEALED_NATIVE_GUI_MAGIC, 'PCHGUI01');
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 7);
  assert.match(win, /v0\.8/);
  assert.match(mac, /v0\.8/);
  assert.match(gtk, /v0\.8/);
  assert.match(win, /#include "win32-sealed-gui-v07\.cpp"/);
  assert.match(mac, /#include "appkit-sealed-gui-v07\.mm"/);
  assert.match(gtk, /#include "gtk-sealed-gui-v07\.cpp"/);
  for (const workflow of [winWorkflow, macWorkflow, linuxWorkflow]) {
    assert.match(workflow, /payload-v7|payload v7/i);
    assert.match(workflow, /version[^\n]*7|v7/);
  }
});

test('sealed Win32 v0.8 writes and reads Microsoft Active Accessibility names', () => {
  for (const marker of [
    'IAccPropServices',
    'SetHwndPropStr',
    'PROPID_ACC_NAME',
    'AccessibleObjectFromWindow',
    'IID_IAccessible',
    'get_accName',
    'oleaut32.lib',
    'ApplyPatchAccessibilityV08',
    'RunPatchAccessibilitySmokeV08',
    'CK_INPUT', 'CK_COMBO', 'CK_LISTBOX', 'CK_TABS', 'CK_RADIO',
    'PatchRadioNameV08'
  ]) assert.ok(win.includes(marker), marker);
});

test('sealed AppKit v0.8 writes and reads accessibility labels', () => {
  for (const marker of [
    'setAccessibilityLabel',
    'accessibilityLabel',
    'ApplyPatchAccessibilityV08',
    'RunPatchAccessibilitySmokeV08',
    'CK_INPUT', 'CK_COMBO', 'CK_LISTBOX', 'CK_TABS', 'CK_RADIO',
    'PatchRadioNameV08'
  ]) assert.ok(mac.includes(marker), marker);
});

test('sealed GTK3 v0.8 writes and reads ATK accessible names', () => {
  for (const marker of [
    '#include <atk/atk.h>',
    'gtk_widget_get_accessible',
    'atk_object_set_name',
    'atk_object_get_name',
    'ApplyPatchAccessibilityV08',
    'RunPatchAccessibilitySmokeV08',
    'CK_INPUT', 'CK_COMBO', 'CK_LISTBOX', 'CK_TABS', 'CK_RADIO',
    'PatchRadioNameV08'
  ]) assert.ok(gtk.includes(marker), marker);
});

test('all sealed runtime workflows build v0.8 but still assert payload version 7', () => {
  assert.match(winWorkflow, /win32-sealed-gui-v08\.cpp/);
  assert.match(winWorkflow, /native-win32-runtime-v0\.8/);
  assert.match(winWorkflow, /\$version -ne 7/);

  assert.match(macWorkflow, /appkit-sealed-gui-v08\.mm/);
  assert.match(macWorkflow, /native-macos-runtime-v0\.8/);
  assert.match(macWorkflow, /version !== 7/);

  assert.match(linuxWorkflow, /gtk-sealed-gui-v08\.cpp/);
  assert.match(linuxWorkflow, /native-linux-runtime-v0\.8/);
  assert.match(linuxWorkflow, /readUInt32LE\(sealed\.length-12\)!==7/);
});

test('Pages consumes only the accessibility-capable sealed runtime release line', () => {
  assert.match(pagesWorkflow, /WIN32_RUNTIME_TAG: native-win32-runtime-v0\.8/);
  assert.match(pagesWorkflow, /LINUX_NATIVE_RUNTIME_TAG: native-linux-runtime-v0\.8/);
  assert.match(pagesWorkflow, /MACOS_NATIVE_RUNTIME_TAG: native-macos-runtime-v0\.8/);
  assert.doesNotMatch(pagesWorkflow, /native-(?:win32|linux|macos)-runtime-v0\.7/);
});
