import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { PATCH_SEALED_NATIVE_GUI_VERSION, decodeNativeGuiPayload } from '../src/sealed-native-gui.js';
import { buildMacosNativeGuiPackage } from '../src/sealed-native-package.js';

const source = fs.readFileSync('examples/forms-navigation.patch', 'utf8');
const gui = buildNativeGuiIR(compile(source, { name: 'MacNativeTest', kind: 'window', entry: 'forms-navigation.patch' }));
const studio = fs.readFileSync('web/native-build.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/native-macos-runtime.yml', 'utf8');

test('browser package seals Native GUI IR v0.7 payload v8 into a minimal macOS app bundle ZIP', () => {
  assert.equal(gui.version, '0.7');
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 8);
  const fakeMachO = Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 12, 0, 0, 1, 10, 20, 30, 40]);
  const ready = buildMacosNativeGuiPackage(fakeMachO, gui, { name: 'My Mac App' });
  assert.equal(ready.filename, 'My_Mac_App-macos-window.zip');
  assert.equal(ready.bundle, 'My_Mac_App.app');
  assert.equal(ready.executable, 'My_Mac_App.app/Contents/MacOS/My_Mac_App');
  assert.deepEqual(ready.sealedBytes.subarray(0, fakeMachO.length), fakeMachO);
  assert.ok(decodeNativeGuiPayload(ready.sealedBytes).length > 64);
  const zipText = new TextDecoder().decode(ready.bytes);
  assert.match(zipText, /My_Mac_App\.app\/Contents\/MacOS\/My_Mac_App/);
  assert.match(zipText, /CFBundleExecutable/);
  assert.doesNotMatch(zipText, /Electron|Chromium|patch-app\.json/);
  const centralOffset = findSignature(ready.bytes, [0x50, 0x4b, 0x01, 0x02]);
  assert.ok(centralOffset > 0);
  const central = new DataView(ready.bytes.buffer, ready.bytes.byteOffset + centralOffset, 46);
  assert.equal((central.getUint32(38, true) >>> 16) & 0xffff, 0o100755);
});

test('Studio defaults macOS Window downloads to native AppKit runtime v1.4 sealing without token', () => {
  assert.ok(studio.includes("const MACOS_NATIVE_GUI_RUNTIME = './runtimes/patch-macos-native-gui-runtime.bin'"));
  assert.ok(studio.includes('buildMacosNativeGuiPackage'));
  assert.ok(studio.includes('Native AppKit app (no token, unsigned)'));
  assert.ok(studio.includes('macOS native AppKit runtime v1.4 app downloaded · unsigned · no token · no Electron'));
  assert.ok(studio.includes('Native GUI IR 1.3'));
  assert.ok(studio.includes('payload v13'));
  assert.ok(studio.includes('NSSlider'));
});

test('Studio is explicit about unsigned macOS sealed apps and keeps AOT/compatibility routes', () => {
  assert.ok(studio.includes('browser-side sealing changes the executable'));
  assert.ok(studio.includes('Gatekeeper may therefore require Control-click → Open'));
  assert.ok(studio.includes('Compatibility package (Electron, no token)'));
  assert.ok(studio.includes('Native AOT app (GitHub Actions)'));
});

test('macOS native runtime workflow smokes Result Dialogs and publishes universal accessible AppKit runtime v0.8', () => {
  for (const marker of [
    'native-runtime/appkit-sealed-gui-v08.mm',
    'tests/sealed-native-accessibility.test.js',
    'scripts/seal-native-macos.js',
    '-arch arm64 -arch x86_64',
    'lipo -archs',
    'examples/radio-window.patch',
    'PatchSealedRadio',
    'examples/menu-dialog-window.patch',
    'PatchSealedMenuDialog',
    'examples/result-dialog-window.patch',
    'PatchSealedResultDialog',
    'Expected sealed native GUI payload v7',
    'patch-macos-native-gui-runtime.bin',
    'native-macos-runtime-v0.8',
    'final signing/notarization remains separate'
  ]) assert.ok(workflow.includes(marker), marker);
  assert.equal(workflow.includes('native-macos-runtime-v0.6'), false);
  assert.match(workflow, /unsigned universal AppKit/i);
  assert.equal(workflow.includes('build-native-window.js'), false);
});

function findSignature(bytes, signature) {
  for (let i = 0; i <= bytes.length - signature.length; i += 1) if (signature.every((value, index) => bytes[i + index] === value)) return i;
  return -1;
}
