import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOfflineLinkPlan } from '../src/offline-linker.js';
import { readOfflineLinkInput } from '../src/offline-link-input.js';
import { buildStudioProjectBundle, serializeStudioProjectBundle } from '../src/studio-project.js';
import { decodeNativeGuiPayloadV17 } from '../src/sealed-native-gui-v17.js';
import {
  decodeNativeGuiPayloadV19,
  inspectNativeGuiButtonImagesV19,
  inspectNativeGuiWindowIconsV19
} from '../src/sealed-native-gui-v19.js';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';
const PNG_SHA256 = '789cc3d7c8416b40a4f20155ece071c362f85d610e71b32b328bfc12b4cf2ead';
const SOURCE = `window "Files" as main size 460, 240 icon "patch-resource:app.icon":
  imagelist as app_images size 20, 20:
    image open from "patch-resource:icons.open"
  button "Open" as open_button image app_images.open at 24, 24 size 120, 36

window "About" as about size 360, 200 icon "patch-resource:about.icon":
  text "About"
`;

const RESOURCES = Object.freeze([
  resource('app.icon', 'resources/app.png'),
  resource('about.icon', 'resources/about.png'),
  resource('icons.open', 'resources/open.png')
]);

function resource(id, file) {
  return Object.freeze({ id, path: file, mediaType: 'image/png', size: 86, sha256: PNG_SHA256, data: PNG_BASE64 });
}

function runtime(platform) {
  if (platform === 'windows') return Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]);
  if (platform === 'linux') return Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0x00]);
  return Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe, 0x00]);
}

function executable(plan, platform) {
  return platform === 'macos'
    ? plan.files.find(file => file.path.startsWith('Contents/MacOS/'))
    : plan.files[0];
}

function footerVersion(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 12, 4).getUint32(0, true);
}

test('offline linker defaults to Current Ready payload v19 and retains explicit payload v17 compatibility', () => {
  const plain = 'window "Main" as main size 320, 180:\n  text "Ready" at 20, 20 size 120, 30\n';
  const current = createOfflineLinkPlan(plain, {
    platform: 'windows', name: 'CurrentReady', guiRuntime: runtime('windows')
  });
  assert.equal(footerVersion(current.files[0].bytes), 19);
  assert.ok(decodeNativeGuiPayloadV19(current.files[0].bytes).length > 0);
  assert.equal(current.nativePackageId, 'native-window-icon-package-v110/0.2');
  assert.equal(current.guiRuntimeVersion, '1.10');

  const legacy = createOfflineLinkPlan(plain, {
    platform: 'windows', name: 'LegacyReady', guiRuntime: runtime('windows'), guiPayloadVersion: 17
  });
  assert.equal(footerVersion(legacy.files[0].bytes), 17);
  assert.ok(decodeNativeGuiPayloadV17(legacy.files[0].bytes).length > 0);
});

test('offline payload v19 reuses application-icon packaging on macOS and Linux', () => {
  for (const platform of ['linux', 'macos']) {
    const plan = createOfflineLinkPlan(SOURCE, {
      platform,
      name: 'OfflineIcons',
      guiRuntime: runtime(platform),
      guiPayloadVersion: 19,
      resources: RESOURCES
    });
    const binary = executable(plan, platform).bytes;
    assert.equal(footerVersion(binary), 19);
    const payload = decodeNativeGuiPayloadV19(binary);
    const icons = inspectNativeGuiWindowIconsV19(payload);
    const buttons = inspectNativeGuiButtonImagesV19(payload);
    assert.equal(icons.assets.length, 2);
    assert.equal(icons.consumers.length, 2);
    assert.equal(icons.applicationIcon.formId, 'main');
    assert.equal(icons.applicationIcon.resourceId, 'app.icon');
    assert.equal(buttons.assets.length, 1);
    assert.equal(buttons.consumers[0].controlId, 'open_button');
    assert.equal(buttons.assets[0].resourceId, 'icons.open');
    assert.equal(plan.iconPackaging.hasApplicationIcon, true);
    if (platform === 'macos') {
      assert.ok(plan.files.some(file => file.path === 'Contents/Resources/OfflineIcons.icns'));
      const plist = new TextDecoder().decode(plan.files.find(file => file.path === 'Contents/Info.plist').bytes);
      assert.match(plist, /CFBundleIconFile/);
    } else {
      assert.ok(plan.files.some(file => file.path === 'share/icons/hicolor/16x16/apps/OfflineIcons.png'));
      assert.ok(plan.files.some(file => file.path === 'share/applications/OfflineIcons.desktop'));
    }
  }
});

test('Windows payload v19 application-icon packaging fails closed without the reserved v1.10 PE slot', () => {
  assert.throws(
    () => createOfflineLinkPlan(SOURCE, {
      platform: 'windows', name: 'OfflineIcons', guiRuntime: runtime('windows'),
      guiPayloadVersion: 19, resources: RESOURCES
    }),
    /Windows PE|DOS header|reserved runtime-v1\.10 application icon slot/
  );
});

test('offline payload v19 fails closed when project resources are absent', () => {
  assert.throws(
    () => createOfflineLinkPlan(SOURCE, {
      platform: 'linux', name: 'MissingIcons', guiRuntime: runtime('linux'), guiPayloadVersion: 19
    }),
    /missing project resource 'icons\.open'|missing project resource 'app\.icon'/i
  );
});

test('offline link input reuses the canonical project-v4 resource store', () => {
  const bundle = buildStudioProjectBundle({
    name: 'ProjectIcons',
    kind: 'window',
    entry: 'main.patch',
    files: [{ path: 'main.patch', content: SOURCE }],
    resources: RESOURCES,
    buildTarget: 'native-linux',
    nativeBuildMode: 'prebuilt'
  });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-v19-'));
  const file = path.join(temp, 'ProjectIcons.patchproject');
  try {
    fs.writeFileSync(file, serializeStudioProjectBundle(bundle), 'utf8');
    const input = readOfflineLinkInput(file);
    assert.equal(input.format, 'patch-studio-project');
    assert.equal(input.name, 'ProjectIcons');
    assert.equal(input.entry, 'main.patch');
    assert.equal(input.resources.length, 3);
    assert.match(input.source, /window "Files"/);

    const plan = createOfflineLinkPlan(input.source, {
      platform: 'linux', name: input.name, entry: input.entry,
      guiRuntime: runtime('linux'), resources: input.resources
    });
    assert.equal(footerVersion(plan.files[0].bytes), 19);
    assert.equal(inspectNativeGuiWindowIconsV19(decodeNativeGuiPayloadV19(plan.files[0].bytes)).applicationIcon.resourceId, 'app.icon');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('ordinary .patch inputs remain resource-free and unchanged', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-source-'));
  const file = path.join(temp, 'plain.patch');
  try {
    fs.writeFileSync(file, 'window "Main" as main size 320, 180:\n  text "Plain"\n', 'utf8');
    const input = readOfflineLinkInput(file);
    assert.equal(input.format, 'patch-source');
    assert.equal(input.name, null);
    assert.deepEqual(input.resources, []);
    assert.equal(input.entry, 'plain.patch');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
