import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createOfflineLinkPlan, materializeOfflineLinkPlan } from '../src/offline-linker.js';
import { decodeSealedConsolePayload } from '../src/prebuilt-native.js';
import { decodeNativeGuiPayload } from '../src/sealed-native-gui.js';

const consoleSource = 'create number score = 1\nchange score:\n  add 1\nshow score\n';
const windowSource = 'window "Main" as main size 480, 320:\n  text "Hello" at 24, 24 size 160, 30\n';
const tableWindowSource = `window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"
`;
const listWindowSource = `create list fruits = ["Banana", "Mango"]
window "Fruit Picker" as main size 540, 360:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits at 24, 72 size 260, 140
when fruits changed:
  change fruits:
    set = value
`;

function footerVersion(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 12, 4).getUint32(0, true);
}
function executableFrom(plan, platform) {
  return platform === 'macos' ? plan.files.find(file => file.path.startsWith('Contents/MacOS/')) : plan.files[0];
}

test('offline linker seals Console source into a local Windows executable plan', () => {
  const runtime = Uint8Array.from([0x4d, 0x5a, 1, 2, 3, 4]);
  const plan = createOfflineLinkPlan(consoleSource, { platform: 'windows', name: 'OfflineDemo', consoleRuntime: runtime });
  assert.equal(plan.kind, 'console');
  assert.equal(plan.platform, 'windows');
  assert.equal(plan.suggestedOutput, 'OfflineDemo.exe');
  assert.equal(plan.files.length, 1);
  const decoded = decodeSealedConsolePayload(plan.files[0].bytes);
  assert.equal(decoded.metadata.name, 'OfflineDemo');
  assert.deepEqual([...decoded.runtime], [...runtime]);
});

test('offline linker lowers current Window source to Native GUI IR 1.1 and seals payload v10', () => {
  const cases = [
    ['windows', Uint8Array.from([0x4d, 0x5a, 0, 0]), 'OfflineWindow.exe'],
    ['linux', Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0]), 'OfflineWindow'],
    ['macos', Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 0]), 'OfflineWindow.app']
  ];
  for (const [platform, runtime, suggestedOutput] of cases) {
    const plan = createOfflineLinkPlan(windowSource, { platform, name: 'OfflineWindow', guiRuntime: runtime });
    assert.equal(plan.kind, 'window');
    assert.equal(plan.suggestedOutput, suggestedOutput);
    const executable = executableFrom(plan, platform);
    assert.ok(decodeNativeGuiPayload(executable.bytes).length > 0);
    assert.equal(footerVersion(executable.bytes), 10);
  }
});

test('offline Window linker preserves Table in the sealed payload v10 contract', () => {
  const cases = [
    ['windows', Uint8Array.from([0x4d, 0x5a, 0, 0])],
    ['linux', Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0])],
    ['macos', Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 0])]
  ];
  for (const [platform, runtime] of cases) {
    const plan = createOfflineLinkPlan(tableWindowSource, { platform, name: 'SealedTable', guiRuntime: runtime });
    const executable = executableFrom(plan, platform);
    const payload = new TextDecoder().decode(decodeNativeGuiPayload(executable.bytes));
    assert.equal(footerVersion(executable.bytes), 10);
    assert.match(payload, /Name/);
    assert.match(payload, /Grace/);
    assert.match(payload, /Scientist/);
  }
});

test('offline Window linker preserves persistent list state and multi-select ListBox in payload v10', () => {
  const cases = [
    ['windows', Uint8Array.from([0x4d, 0x5a, 0, 0])],
    ['linux', Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0])],
    ['macos', Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 0])]
  ];
  for (const [platform, runtime] of cases) {
    const plan = createOfflineLinkPlan(listWindowSource, { platform, name: 'SealedMulti', guiRuntime: runtime });
    const executable = executableFrom(plan, platform);
    const payload = new TextDecoder().decode(decodeNativeGuiPayload(executable.bytes));
    assert.equal(footerVersion(executable.bytes), 10);
    assert.match(payload, /fruits/);
    assert.match(payload, /Banana/);
    assert.match(payload, /Mango/);
  }
});

test('macOS Console linking can fall back to a portable embedded-Node app when SEA is unavailable', () => {
  const nodeRuntime = Uint8Array.from([1, 2, 3, 4, 5]);
  const plan = createOfflineLinkPlan(consoleSource, {
    platform: 'macos', name: 'IntelConsole', nodeRuntime
  });
  assert.equal(plan.outputKind, 'macOS portable Console .app bundle');
  assert.equal(plan.suggestedOutput, 'IntelConsole.app');
  assert.ok(plan.files.some(file => file.path === 'Contents/MacOS/IntelConsole'));
  assert.ok(plan.files.some(file => file.path === 'Contents/Resources/app.wasm'));
  const node = plan.files.find(file => file.path === 'Contents/Resources/node');
  assert.deepEqual([...node.bytes], [...nodeRuntime]);
  const runner = new TextDecoder().decode(plan.files.find(file => file.path === 'Contents/Resources/run.cjs').bytes);
  assert.match(runner, /WebAssembly\.instantiate/);
  assert.match(runner, /show_number/);
});

test('FreeBSD offline linker uses portable C99 and fails closed for Window projects', () => {
  const plan = createOfflineLinkPlan(consoleSource, { platform: 'freebsd', name: 'FreeDemo' });
  assert.equal(plan.outputKind, 'FreeBSD native executable via portable C99');
  assert.match(plan.cSource, /#include/);
  assert.throws(() => createOfflineLinkPlan(windowSource, { platform: 'freebsd', name: 'NoGui' }), /Console projects only/);
});

test('offline linker materializes the selected platform artifact without a network step', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-link-test-'));
  try {
    const plan = createOfflineLinkPlan(consoleSource, {
      platform: 'windows', name: 'Materialized', consoleRuntime: Uint8Array.from([0x4d, 0x5a, 7, 8])
    });
    const linked = materializeOfflineLinkPlan(plan, { out: path.join(dir, 'Result') });
    assert.equal(linked.output, path.join(dir, 'Result.exe'));
    assert.ok(fs.statSync(linked.output).size > 8);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('patch CLI exposes link using an injected offline Console runtime', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-cli-test-'));
  try {
    const source = path.join(dir, 'demo.patch');
    const runtime = path.join(dir, 'console-runtime.bin');
    const out = path.join(dir, 'CliDemo');
    fs.writeFileSync(source, consoleSource, 'utf8');
    fs.writeFileSync(runtime, Uint8Array.from([0x4d, 0x5a, 3, 2, 1]));
    const stdout = execFileSync(process.execPath, ['src/cli-entry.js', 'link', source, '--out', out, '--name', 'CliDemo'], {
      cwd: process.cwd(),
      env: { ...process.env, PATCH_OFFLINE_CONSOLE_RUNTIME: runtime },
      encoding: 'utf8'
    });
    const expected = process.platform === 'win32' ? `${out}.exe` : process.platform === 'darwin' ? `${out}.app` : out;
    if (process.platform === 'freebsd') assert.match(stdout, /backend: portable Patch C99/);
    else {
      assert.ok(fs.existsSync(expected));
      assert.match(stdout, /backend: local Patch compilation \+ embedded native runtime sealing/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('offline compiler builder and SEA runner remain dependency-free syntax-valid entrypoints', () => {
  execFileSync(process.execPath, ['--check', 'scripts/build-offline-compiler.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/offline-compiler-runner.cjs'], { stdio: 'pipe' });
  const builder = fs.readFileSync('scripts/build-offline-compiler.js', 'utf8');
  const runner = fs.readFileSync('scripts/offline-compiler-runner.cjs', 'utf8');
  assert.match(builder, /--build-sea/);
  assert.match(builder, /runtime\/node\.bin\.gz/);
  assert.match(builder, /runtime\/console\.bin\.gz/);
  assert.match(builder, /runtime\/gui\.bin\.gz/);
  assert.match(runner, /getAssetKeys/);
  assert.match(runner, /spawnSync\(nodeRuntime/);
  assert.doesNotMatch(runner, /import\(pathToFileURL/);
  assert.doesNotMatch(builder, /npm install|npx /);
});
