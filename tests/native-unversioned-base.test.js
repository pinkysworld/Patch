import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PATCH_NATIVE_GUI_IR_VERSION } from '../src/native-gui-ir.js';
import { PATCH_SEALED_NATIVE_GUI_VERSION } from '../src/sealed-native-gui.js';

const read = path => fs.readFileSync(path, 'utf8');

const historicalSealers = [
  'scripts/seal-native-win32.js',
  'scripts/seal-native-linux.js',
  'scripts/seal-native-macos.js'
];
const historicalRuntimeWorkflows = [
  ['.github/workflows/native-win32-runtime.yml', 'Patch Native Win32 Runtime v0.8 (historical)'],
  ['.github/workflows/native-linux-runtime.yml', 'Patch Native Linux Runtime v0.8 (historical)'],
  ['.github/workflows/native-macos-runtime.yml', 'Patch Native macOS Runtime v0.8 (historical)']
];
const productWorkflows = [
  '.github/workflows/native-win32-gui.yml',
  '.github/workflows/native-gtk-gui.yml',
  '.github/workflows/native-appkit-gui.yml',
  '.github/workflows/native-gui-unified.yml',
  '.github/workflows/native-distribution.yml',
  '.github/workflows/windows-single-exe.yml',
  '.github/workflows/native-window-aot.yml'
];
const historicalBases = [
  ['src/native-gui-ir.js', 'Native GUI IR 0.7'],
  ['src/sealed-native-gui.js', 'sealed payload v8'],
  ['src/win32-gui.js', 'Win32 backend 0.6'],
  ['src/gtk-gui.js', 'GTK backend 0.6'],
  ['src/appkit-gui.js', 'AppKit backend 0.6'],
  ['native-runtime/win32-sealed-gui.cpp', 'sealed payload v6'],
  ['native-runtime/gtk-sealed-gui.cpp', 'sealed payload v6'],
  ['native-runtime/appkit-sealed-gui.mm', 'sealed payload v6']
];

test('unversioned native files are labeled historical include-chain bases, not Ready', () => {
  assert.equal(PATCH_NATIVE_GUI_IR_VERSION, '0.7');
  assert.equal(PATCH_SEALED_NATIVE_GUI_VERSION, 8);
  for (const [file, marker] of historicalBases) {
    const source = read(file);
    assert.match(source, /HISTORICAL INCLUDE-CHAIN BASE/, file);
    assert.match(source, /not the Ready runtime/i, file);
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), file);
  }
  assert.match(read('native-runtime/win32-sealed-gui.cpp'), /PATCH_PAYLOAD_VERSION = 6/);
  assert.match(read('native-runtime/gtk-sealed-gui.cpp'), /PATCH_PAYLOAD_VERSION = 6/);
  assert.match(read('native-runtime/appkit-sealed-gui.mm'), /PATCH_PAYLOAD_VERSION = 6/);
});

test('historical seal-native scripts fail closed unless payload v7 or v8 is explicit', () => {
  for (const script of historicalSealers) {
    const source = read(script);
    assert.match(source, /HISTORICAL sealer/, script);
    assert.doesNotMatch(source, /PATCH_SEALED_GUI_VERSION \?\? 7/, script);
    assert.match(source, /payloadVersion !== 7 && payloadVersion !== 8/, script);
    assert.match(source, /sealed-native-package\.js/, script);

    const env = { ...process.env };
    delete env.PATCH_SEALED_GUI_VERSION;
    const missing = spawnSync(process.execPath, [script, 'examples/forms-navigation.patch', 'runtime.bin', 'out.bin'], { encoding: 'utf8', env });
    assert.equal(missing.status, 2, script);
    assert.match(missing.stderr, /historical payload-v7\/v8 sealer/i);

    env.PATCH_SEALED_GUI_VERSION = '13';
    const current = spawnSync(process.execPath, [script, 'examples/forms-navigation.patch', 'runtime.bin', 'out.bin'], { encoding: 'utf8', env });
    assert.equal(current.status, 2, script);
    assert.match(current.stderr, /payload v12 or v13/);
  }
});

test('automatic v0.8 runtime workflows are named historical and pin payload v7', () => {
  for (const [file, name] of historicalRuntimeWorkflows) {
    const workflow = read(file);
    assert.match(workflow, new RegExp(`^name: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), file);
    assert.match(workflow, /HISTORICAL v0\.8 compatibility runtime/, file);
    assert.match(workflow, /PATCH_SEALED_GUI_VERSION: '7'/, file);
    assert.match(workflow, /src\/native-gui-ir\.js/, file);
    assert.match(workflow, /src\/sealed-native-gui\.js/, file);
    assert.equal(workflow.includes('src/compiler.js'), false, file);
    assert.equal(workflow.includes('src/parser.js'), false, file);
    assert.equal(workflow.includes('web/native-build.js'), false, file);
    assert.equal(workflow.includes('src/sealed-native-package.js'), false, file);
  }
});

test('Pages no longer waits on historical v0.8 runtime workflows', () => {
  const pages = read('.github/workflows/pages.yml');
  assert.doesNotMatch(pages, /Patch Native Win32 Runtime,/);
  assert.doesNotMatch(pages, /Patch Native Linux Runtime,/);
  assert.doesNotMatch(pages, /Patch Native macOS Runtime,/);
  assert.equal(pages.includes('.github/workflows/native-win32-runtime.yml'), false);
  assert.equal(pages.includes('.github/workflows/native-linux-runtime.yml'), false);
  assert.equal(pages.includes('.github/workflows/native-macos-runtime.yml'), false);
  assert.match(pages, /Patch Native Sealed TreeView Runtime v1\.3/);
  assert.match(pages, /Patch Native Sealed Slider Runtime v1\.4/);
});

test('product native workflows watch current and frozen contracts, not unversioned bases', () => {
  for (const file of productWorkflows) {
    const workflow = read(file);
    assert.match(workflow, /src\/native-current-contract\.js/, file);
    assert.match(workflow, /src\/native-frozen-contract\.js/, file);
    assert.doesNotMatch(workflow, /^\s+- src\/native-gui-ir\.js$/m, file);
    assert.doesNotMatch(workflow, /^\s+- src\/win32-gui-v08\.js$/m, file);
    assert.doesNotMatch(workflow, /^\s+- src\/gtk-gui-v08\.js$/m, file);
    assert.doesNotMatch(workflow, /^\s+- src\/appkit-gui-v08\.js$/m, file);
    assert.doesNotMatch(workflow, /^\s+- src\/win32-gui\.js$/m, file);
    assert.doesNotMatch(workflow, /^\s+- src\/gtk-gui\.js$/m, file);
    assert.doesNotMatch(workflow, /^\s+- src\/appkit-gui\.js$/m, file);
  }
});
