import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createOfflineLinkPlan, materializeOfflineLinkPlan } from '../src/offline-linker.js';
import { decodeSealedConsolePayload } from '../src/prebuilt-native.js';
import { decodeNativeGuiPayloadV12, inspectNativeGuiTreesV12 } from '../src/sealed-native-gui-v12.js';
import { inspectNativeGuiSlidersV13 } from '../src/sealed-native-gui-v13.js';
import { decodeNativeGuiPayloadV14, inspectNativeGuiChromeV14, inspectNativeGuiSlidersV14 } from '../src/sealed-native-gui-v14.js';
import { decodeNativeGuiPayloadV17, inspectNativeGuiPaintImagesV17, inspectNativeGuiChromeV17, inspectNativeGuiSlidersV17 } from '../src/sealed-native-gui-v17.js';
import { inspectNativeGuiPaintBoxesV16 } from '../src/sealed-native-gui-v16.js';
import { inspectNativeGuiShapesV15 } from '../src/sealed-native-gui-v15.js';

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
const treeWindowSource = `create list selected = []
window "Files" as main size 560, 380:
  tree as files at 24, 56 size 300, 240:
    node "src"
      node "compiler.js"
      node "parser.js"
    node "docs"
      node "README.md"
when files changed:
  change selected:
    set = value
`;
const sliderWindowSource = `create number volume = 20
window "Mixer" as main size 520, 220:
  slider 0..100 as volume step 5 at 24, 32 size 320, 44
  text "Volume {volume}" at 24, 92 size 220, 30
when volume changed:
  change volume:
    set = value
`;
const chromeWindowSource = `create number ticks = 0
create text status = "Ready"
create text poster = "Ship"
window "Chrome" as main size 640, 420:
  panel as group at 24, 24 size 280, 160:
    text "Grouped tools"
    picture "Ship" as poster
    button "Ping" as ping
  timer as clock interval 1000 at 320, 24 size 180, 36
  statusbar "{status}" as status at 0, 392 size 640, 28
when clock ticked:
  change ticks:
    add 1
when ping clicked:
  change status:
    set = "Ping"
when poster clicked:
  change status:
    set = "Picture"
`;

function footerVersion(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 12, 4).getUint32(0, true);
}
function executableFrom(plan, platform) {
  return platform === 'macos' ? plan.files.find(file => file.path.startsWith('Contents/MacOS/')) : plan.files[0];
}
function currentPayloadV16(bytes) {
  return inspectNativeGuiPaintImagesV17(decodeNativeGuiPayloadV17(bytes)).payloadV16;
}
function currentPayloadV15(bytes) {
  return inspectNativeGuiPaintBoxesV16(currentPayloadV16(bytes)).payloadV15;
}
function currentPayloadV14(bytes) {
  return inspectNativeGuiShapesV15(currentPayloadV15(bytes)).payloadV14;
}
function currentPayloadV13(bytes) {
  return inspectNativeGuiChromeV14(currentPayloadV14(bytes)).payloadV13;
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

test('offline linker lowers current Window source to Native GUI IR 1.7 and seals payload v17', () => {
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
    assert.ok(decodeNativeGuiPayloadV17(executable.bytes).length > 0);
    assert.equal(footerVersion(executable.bytes), 17);
  }
});

test('offline Window linker preserves Table in the current payload v14 contract', () => {
  for (const [platform, runtime] of [
    ['windows', Uint8Array.from([0x4d, 0x5a, 0, 0])],
    ['linux', Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0])],
    ['macos', Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 0])]
  ]) {
    const plan = createOfflineLinkPlan(tableWindowSource, { platform, name: 'SealedTable', guiRuntime: runtime });
    const executable = executableFrom(plan, platform);
    const metadata = inspectNativeGuiSlidersV13(currentPayloadV13(executable.bytes));
    const payload = new TextDecoder().decode(metadata.payloadV12);
    assert.equal(footerVersion(executable.bytes), 17);
    assert.match(payload, /Name/);
    assert.match(payload, /Grace/);
    assert.match(payload, /Scientist/);
  }
});

test('offline Window linker preserves persistent list state and multi-select ListBox in payload v14', () => {
  for (const [platform, runtime] of [
    ['windows', Uint8Array.from([0x4d, 0x5a, 0, 0])],
    ['linux', Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0])],
    ['macos', Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 0])]
  ]) {
    const plan = createOfflineLinkPlan(listWindowSource, { platform, name: 'SealedMulti', guiRuntime: runtime });
    const executable = executableFrom(plan, platform);
    const metadata = inspectNativeGuiSlidersV13(currentPayloadV13(executable.bytes));
    const payload = new TextDecoder().decode(metadata.payloadV12);
    assert.equal(footerVersion(executable.bytes), 17);
    assert.match(payload, /fruits/);
    assert.match(payload, /Banana/);
    assert.match(payload, /Mango/);
  }
});

const menuWindowSource = `create boolean advanced = false
create boolean pinned = false
window "Menu state" as main size 620, 340:
  menu "Actions":
    item "Enable advanced" as enable_advanced
    item "Advanced action" as advanced_action enabled advanced shortcut "Primary+E"
    separator
    item "Pinned" as pin_item checked pinned shortcut "Primary+P"
when enable_advanced clicked:
  change advanced:
    set = true
when pin_item clicked:
  change pinned:
    set = true
`;

test('offline Window linker preserves decorated Menu metadata in payload v14', () => {
  for (const [platform, runtime] of [
    ['windows', Uint8Array.from([0x4d,0x5a,0,0])],
    ['linux', Uint8Array.from([0x7f,0x45,0x4c,0x46,0])],
    ['macos', Uint8Array.from([0xcf,0xfa,0xed,0xfe,0])]
  ]) {
    const plan=createOfflineLinkPlan(menuWindowSource,{platform,name:'SealedMenu',guiRuntime:runtime});
    const executable=executableFrom(plan,platform);
    const metadata=inspectNativeGuiSlidersV13(currentPayloadV13(executable.bytes));
    const payload=new TextDecoder().decode(metadata.payloadV12);
    assert.equal(footerVersion(executable.bytes),17);
    assert.match(payload,/advanced_action/);
    assert.match(payload,/Primary|advanced|pinned/);
  }
});

test('offline Window linker supports hierarchical TreeView through payload v14 on all Ready desktop hosts', () => {
  for (const [platform, runtime] of [
    ['windows', Uint8Array.from([0x4d,0x5a,0,0])],
    ['linux', Uint8Array.from([0x7f,0x45,0x4c,0x46,0])],
    ['macos', Uint8Array.from([0xcf,0xfa,0xed,0xfe,0])]
  ]) {
    const plan = createOfflineLinkPlan(treeWindowSource, { platform, name: 'TreeReady', guiRuntime: runtime });
    const executable = executableFrom(plan, platform);
    const metadata = inspectNativeGuiSlidersV13(currentPayloadV13(executable.bytes));
    const { trees } = inspectNativeGuiTreesV12(metadata.payloadV12);
    assert.equal(footerVersion(executable.bytes), 17);
    assert.equal(trees.length, 1);
    assert.equal(trees[0].id, 'files');
    assert.equal(trees[0].nodes.length, 5);
    assert.equal(trees[0].nodes.at(-1).text, 'README.md');
  }
});

test('offline Window linker supports native Slider numeric events in payload v14', () => {
  for (const [platform, runtime] of [
    ['windows', Uint8Array.from([0x4d,0x5a,0,0])],
    ['linux', Uint8Array.from([0x7f,0x45,0x4c,0x46,0])],
    ['macos', Uint8Array.from([0xcf,0xfa,0xed,0xfe,0])]
  ]) {
    const plan = createOfflineLinkPlan(sliderWindowSource, { platform, name: 'SliderReady', guiRuntime: runtime });
    const executable = executableFrom(plan, platform);
    const metadata = inspectNativeGuiSlidersV17(decodeNativeGuiPayloadV17(executable.bytes));
    assert.equal(footerVersion(executable.bytes), 17);
    assert.equal(metadata.sliders.length, 1);
    assert.equal(metadata.sliders[0].id, 'volume');
    assert.equal(metadata.sliders[0].step, 5);
    assert.equal(metadata.sliders[0].events[0].sentinels.length, 1);
  }
});

test('offline Window linker carries Panel children, Timer ticked and PictureBox clicked through payload v14', () => {
  for (const [platform, runtime] of [
    ['windows', Uint8Array.from([0x4d,0x5a,0,0])],
    ['linux', Uint8Array.from([0x7f,0x45,0x4c,0x46,0])],
    ['macos', Uint8Array.from([0xcf,0xfa,0xed,0xfe,0])]
  ]) {
    const plan = createOfflineLinkPlan(chromeWindowSource, { platform, name: 'ChromeReady', guiRuntime: runtime });
    const executable = executableFrom(plan, platform);
    const inspected = inspectNativeGuiChromeV17(decodeNativeGuiPayloadV17(executable.bytes));
    assert.equal(footerVersion(executable.bytes), 17);
    const byId = new Map(inspected.chrome.map(item => [item.id, item]));
    assert.equal(byId.get('group')?.type, 'panel');
    assert.equal(byId.get('group')?.childCount, 3);
    assert.equal(byId.get('clock')?.type, 'timer');
    assert.equal(byId.get('clock')?.interval, 1000);
    assert.equal(byId.get('clock')?.events[0]?.event, 'ticked');
    assert.equal(byId.get('poster')?.type, 'picture');
    assert.equal(byId.get('poster')?.events[0]?.event, 'clicked');
    assert.equal(byId.get('status')?.type, 'statusbar');
  }
});

test('offline linker keeps explicit payload v12 compatibility and fails closed for retired v13/v11', () => {
  const runtime = Uint8Array.from([0x4d, 0x5a, 0, 0]);
  const v12 = createOfflineLinkPlan(treeWindowSource, {
    platform: 'windows', name: 'LegacyTree12', guiRuntime: runtime, guiPayloadVersion: 12
  });
  assert.equal(footerVersion(v12.files[0].bytes), 12);
  assert.ok(decodeNativeGuiPayloadV12(v12.files[0].bytes).length > 0);
  assert.throws(() => createOfflineLinkPlan(sliderWindowSource, {
    platform: 'windows', name: 'LegacySlider12', guiRuntime: runtime, guiPayloadVersion: 12
  }), /Slider.*not enabled.*Window target/i);

  for (const version of [13, 11]) {
    assert.throws(() => createOfflineLinkPlan(listWindowSource, {
      platform: 'windows', name: `LegacyList${version}`, guiRuntime: runtime, guiPayloadVersion: version
    }), /payload v12 or v17/i);
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
