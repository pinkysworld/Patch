import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildCurrentNativeGuiIR, PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, decodeCurrentNativeGuiPayload } from '../src/native-current-contract.js';
import { buildLinuxNativeGuiPackage } from '../src/sealed-native-package.js';

const source = fs.readFileSync('examples/forms-navigation.patch', 'utf8');
const gui = buildCurrentNativeGuiIR(compile(source, { name: 'LinuxNativeTest', kind: 'window', entry: 'forms-navigation.patch' }));
const studio = fs.readFileSync('web/native-build.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/native-linux-runtime.yml', 'utf8');

test('browser package seals current Native GUI IR 1.4 payload v14 into one Linux ELF executable', () => {
  assert.equal(gui.version, '1.4');
  assert.equal(PATCH_CURRENT_NATIVE_PAYLOAD_VERSION, 14);
  const fakeElf = Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 10, 20, 30, 40]);
  const ready = buildLinuxNativeGuiPackage(fakeElf, gui, { name: 'My Linux App', payloadVersion: PATCH_CURRENT_NATIVE_PAYLOAD_VERSION });
  assert.equal(ready.filename, 'My_Linux_App-linux-window.zip');
  assert.equal(ready.executable, 'My_Linux_App');
  assert.deepEqual(ready.sealedBytes.subarray(0, fakeElf.length), fakeElf);
  assert.ok(decodeCurrentNativeGuiPayload(ready.sealedBytes).length > 64);
  const centralOffset = findSignature(ready.bytes, [0x50, 0x4b, 0x01, 0x02]);
  assert.ok(centralOffset > 0);
  const central = new DataView(ready.bytes.buffer, ready.bytes.byteOffset + centralOffset, 46);
  assert.equal((central.getUint32(38, true) >>> 16) & 0xffff, 0o100755);
});

test('Studio defaults Linux Window downloads to native GTK runtime v1.5 sealing without token', () => {
  assert.ok(studio.includes("const LINUX_NATIVE_GUI_RUNTIME = './runtimes/patch-linux-native-gui-runtime.bin'"));
  assert.ok(studio.includes('buildLinuxNativeGuiPackage'));
  assert.ok(studio.includes('Native GTK app (no token, recommended)'));
  assert.ok(studio.includes('Linux native GTK runtime v1.5 app downloaded · no token · no Electron'));
  assert.ok(studio.includes('Native GUI IR 1.4'));
  assert.ok(studio.includes('payload v14'));
  assert.ok(studio.includes('GtkScale'));
});

test('Linux compatibility packaging remains explicit and AOT route remains available', () => {
  assert.ok(studio.includes('Compatibility package (Electron, no token)'));
  assert.ok(studio.includes('Native AOT app (GitHub Actions)'));
  assert.ok(studio.includes('return NATIVE_WINDOW_AOT_WORKFLOW'));
});

test('Linux native runtime workflow keeps historical v0.8 compatibility evidence', () => {
  for (const marker of [
    'native-runtime/gtk-sealed-gui-v08.cpp','tests/sealed-native-accessibility.test.js','scripts/seal-native-linux.js',
    'examples/radio-window.patch','PatchSealedRadio','examples/menu-dialog-window.patch','PatchSealedMenuDialog',
    'examples/result-dialog-window.patch','PatchSealedResultDialog','Expected sealed native GUI payload v7',
    'patch-linux-native-gui-runtime.bin','native-linux-runtime-v0.8'
  ]) assert.ok(workflow.includes(marker), marker);
  assert.equal(workflow.includes('native-linux-runtime-v0.6'), false);
  assert.equal(workflow.includes('build-native-window.js'), false);
});

function findSignature(bytes, signature) {
  for (let i = 0; i <= bytes.length - signature.length; i += 1) if (signature.every((value, index) => bytes[i + index] === value)) return i;
  return -1;
}
