import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { PATCH_SEALED_NATIVE_GUI_VERSION, decodeNativeGuiPayload } from '../src/sealed-native-gui.js';
import { buildLinuxNativeGuiPackage } from '../src/sealed-native-package.js';

const source = fs.readFileSync('examples/forms-navigation.patch', 'utf8');
const gui = buildNativeGuiIR(compile(source, { name: 'LinuxNativeTest', kind: 'window', entry: 'forms-navigation.patch' }));
const studio = fs.readFileSync('web/native-build.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/native-linux-runtime.yml', 'utf8');

test('browser package seals Native GUI IR v0.7 payload v8 into one Linux ELF executable', () => {
  assert.equal(gui.version, '0.7');
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 8);
  const fakeElf = Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 10, 20, 30, 40]);
  const ready = buildLinuxNativeGuiPackage(fakeElf, gui, { name: 'My Linux App' });
  assert.equal(ready.filename, 'My_Linux_App-linux-window.zip');
  assert.equal(ready.executable, 'My_Linux_App');
  assert.deepEqual(ready.sealedBytes.subarray(0, fakeElf.length), fakeElf);
  assert.ok(decodeNativeGuiPayload(ready.sealedBytes).length > 64);
  const centralOffset = findSignature(ready.bytes, [0x50, 0x4b, 0x01, 0x02]);
  assert.ok(centralOffset > 0);
  const central = new DataView(ready.bytes.buffer, ready.bytes.byteOffset + centralOffset, 46);
  assert.equal((central.getUint32(38, true) >>> 16) & 0xffff, 0o100755);
});

test('Studio defaults Linux Window downloads to native GTK runtime v1.4 sealing without token', () => {
  assert.ok(studio.includes("const LINUX_NATIVE_GUI_RUNTIME = './runtimes/patch-linux-native-gui-runtime.bin'"));
  assert.ok(studio.includes('buildLinuxNativeGuiPackage'));
  assert.ok(studio.includes('Native GTK app (no token, recommended)'));
  assert.ok(studio.includes('Linux native GTK runtime v1.4 app downloaded · no token · no Electron'));
  assert.ok(studio.includes('Native GUI IR 1.3'));
  assert.ok(studio.includes('payload v13'));
  assert.ok(studio.includes('GtkScale'));
});

test('Linux compatibility packaging remains explicit and AOT route remains available', () => {
  assert.ok(studio.includes('Compatibility package (Electron, no token)'));
  assert.ok(studio.includes('Native AOT app (GitHub Actions)'));
  assert.ok(studio.includes('return NATIVE_WINDOW_AOT_WORKFLOW'));
});

test('Linux native runtime workflow smokes Result Dialogs and publishes accessible GTK runtime v0.8', () => {
  for (const marker of [
    'native-runtime/gtk-sealed-gui-v08.cpp',
    'tests/sealed-native-accessibility.test.js',
    'scripts/seal-native-linux.js',
    'examples/radio-window.patch',
    'PatchSealedRadio',
    'examples/menu-dialog-window.patch',
    'PatchSealedMenuDialog',
    'examples/result-dialog-window.patch',
    'PatchSealedResultDialog',
    'Expected sealed native GUI payload v7',
    'patch-linux-native-gui-runtime.bin',
    'native-linux-runtime-v0.8'
  ]) assert.ok(workflow.includes(marker), marker);
  assert.equal(workflow.includes('native-linux-runtime-v0.6'), false);
  assert.equal(workflow.includes('build-native-window.js'), false);
});

function findSignature(bytes, signature) {
  for (let i = 0; i <= bytes.length - signature.length; i += 1) if (signature.every((value, index) => bytes[i + index] === value)) return i;
  return -1;
}
