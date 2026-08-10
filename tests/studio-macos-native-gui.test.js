import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { PATCH_SEALED_NATIVE_GUI_VERSION, decodeNativeGuiPayload } from '../src/sealed-native-gui.js';
import { buildMacosNativeGuiPackage } from '../src/sealed-native-package.js';

const source = fs.readFileSync('examples/forms-navigation.patch', 'utf8');
const compiled = compile(source, { name: 'MacNativeTest', kind: 'window', entry: 'forms-navigation.patch' });
const gui = buildNativeGuiIR(compiled);
const studio = fs.readFileSync('web/native-build.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/native-macos-runtime.yml', 'utf8');

test('browser package seals Native GUI IR into a minimal macOS app bundle ZIP', () => {
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 3);
  const fakeMachO = Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 12, 0, 0, 1, 10, 20, 30, 40]);
  const ready = buildMacosNativeGuiPackage(fakeMachO, gui, { name: 'My Mac App' });
  assert.equal(ready.filename, 'My_Mac_App-macos-window.zip');
  assert.equal(ready.bundle, 'My_Mac_App.app');
  assert.equal(ready.executable, 'My_Mac_App.app/Contents/MacOS/My_Mac_App');
  assert.deepEqual(ready.sealedBytes.subarray(0, fakeMachO.length), fakeMachO);
  assert.ok(decodeNativeGuiPayload(ready.sealedBytes).length > 64);
  assert.equal(ready.bytes[0], 0x50);
  assert.equal(ready.bytes[1], 0x4b);

  const zipText = new TextDecoder().decode(ready.bytes);
  assert.match(zipText, /My_Mac_App\.app\/Contents\/MacOS\/My_Mac_App/);
  assert.match(zipText, /My_Mac_App\.app\/Contents\/Info\.plist/);
  assert.match(zipText, /CFBundleExecutable/);
  assert.match(zipText, /My_Mac_App/);
  assert.doesNotMatch(zipText, /Electron|Chromium|patch-app\.json/);

  const centralOffset = findSignature(ready.bytes, [0x50, 0x4b, 0x01, 0x02]);
  assert.ok(centralOffset > 0);
  const central = new DataView(ready.bytes.buffer, ready.bytes.byteOffset + centralOffset, 46);
  const externalAttributes = central.getUint32(38, true);
  assert.equal((externalAttributes >>> 16) & 0xffff, 0o100755);
});

test('Studio defaults macOS Window downloads to native AppKit sealing without token', () => {
  assert.ok(studio.includes("const MACOS_NATIVE_GUI_RUNTIME = './runtimes/patch-macos-native-gui-runtime.bin'"));
  assert.ok(studio.includes('buildMacosNativeGuiPackage'));
  assert.ok(studio.includes("platform === 'macos' && kind === 'window'"));
  assert.ok(studio.includes('Native AppKit app (no token, unsigned)'));
  assert.ok(studio.includes('macOS native AppKit app downloaded · unsigned · no token · no Electron'));
  assert.ok(studio.includes("['windows', 'macos', 'linux'].includes(platform)"));
});

test('Studio is explicit about unsigned macOS sealed apps and keeps AOT/compatibility routes', () => {
  assert.ok(studio.includes('browser-side sealing changes the executable'));
  assert.ok(studio.includes('Gatekeeper may therefore require Control-click → Open'));
  assert.ok(studio.includes('Compatibility package (Electron, no token)'));
  assert.ok(studio.includes('Native AOT app (GitHub Actions)'));
});

test('macOS native runtime workflow builds universal AppKit runtime, smokes ListBox and publishes v0.3', () => {
  assert.ok(workflow.includes('native-runtime/appkit-sealed-gui.mm'));
  assert.ok(workflow.includes('scripts/seal-native-macos.js'));
  assert.ok(workflow.includes('-arch arm64 -arch x86_64'));
  assert.ok(workflow.includes('lipo -archs'));
  assert.ok(workflow.includes('dist-runtime/PatchSealedForms --patch-smoke'));
  assert.ok(workflow.includes('examples/combo-window.patch'));
  assert.ok(workflow.includes('dist-runtime/PatchSealedCombo --patch-smoke'));
  assert.ok(workflow.includes('examples/listbox-window.patch'));
  assert.ok(workflow.includes('dist-runtime/PatchSealedListBox --patch-smoke'));
  assert.ok(workflow.includes('Expected sealed native GUI payload v3'));
  assert.ok(workflow.includes('patch-macos-native-gui-runtime.bin'));
  assert.ok(workflow.includes('native-macos-runtime-v0.3'));
  assert.equal(workflow.includes('native-macos-runtime-v0.2'), false);
  assert.match(workflow, /unsigned universal AppKit/i);
  assert.ok(workflow.includes('Signing/notarization is separate'));
  assert.equal(workflow.includes('build-native-window.js'), false);
});

function findSignature(bytes, signature) {
  for (let i = 0; i <= bytes.length - signature.length; i += 1) {
    if (signature.every((value, index) => bytes[i + index] === value)) return i;
  }
  return -1;
}
