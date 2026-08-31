import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV19 } from '../src/native-gui-ir-v19.js';
import { decodeNativeGuiPayloadV19, inspectNativeGuiWindowIconsV19 } from '../src/sealed-native-gui-v19.js';
import {
  PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_ID,
  createNativeWindowIconPackagePlanV110
} from '../src/native-window-icon-package-v110.js';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';
const APP_ICON = Object.freeze({
  id: 'app.icon',
  path: 'resources/app.png',
  mediaType: 'image/png',
  size: 86,
  sha256: '789cc3d7c8416b40a4f20155ece071c362f85d610e71b32b328bfc12b4cf2ead',
  data: PNG_BASE64
});

const SOURCE = `window "Main" as main size 520, 320 icon "patch-resource:app.icon":
  text "Main"

window "Settings" as settings size 420, 260:
  text "Settings"
`;

const ir = buildNativeGuiIRV19(compile(SOURCE, { name: 'Icon App', kind: 'window' }));
const runtimes = Object.freeze({
  windows: new Uint8Array([0x4d, 0x5a, 0x00, 0x00]),
  macos: new Uint8Array([0xcf, 0xfa, 0xed, 0xfe]),
  linux: new Uint8Array([0x7f, 0x45, 0x4c, 0x46])
});

function findFile(plan, suffix) {
  const file = plan.files.find(item => item.path.endsWith(suffix));
  assert.ok(file, `expected package file ending with ${suffix}`);
  return file;
}

function utf8(bytes) {
  return new TextDecoder().decode(bytes);
}

test('Windows experimental package plan seals payload v19 and carries an explicit ICO sidecar without claiming PE embedding', () => {
  const plan = createNativeWindowIconPackagePlanV110(runtimes.windows, ir, {
    platform: 'windows',
    name: 'Icon App',
    resources: [APP_ICON]
  });
  assert.equal(plan.id, PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_ID);
  assert.equal(plan.nativeGuiIr, '1.9');
  assert.equal(plan.payload, 19);
  assert.equal(plan.runtime, '1.10');
  assert.equal(plan.currentProductPromoted, false);
  assert.equal(plan.peIconEmbedded, false);
  assert.equal(plan.executable, 'Icon_App.exe');
  assert.deepEqual(plan.files.map(file => file.path), ['Icon_App.exe', 'Icon_App.ico']);
  assert.equal(findFile(plan, '.ico').bytes[2], 1);

  const payload = decodeNativeGuiPayloadV19(plan.sealedBytes);
  const icons = inspectNativeGuiWindowIconsV19(payload);
  assert.equal(icons.assets.length, 1);
  assert.equal(icons.consumers.length, 1);
  assert.equal(icons.consumers[0].application, true);
});

test('macOS experimental package plan installs ICNS into the app bundle and names it in Info.plist', () => {
  const plan = createNativeWindowIconPackagePlanV110(runtimes.macos, ir, {
    platform: 'macos',
    name: 'Icon App',
    resources: [APP_ICON]
  });
  assert.equal(plan.bundle, 'Icon_App.app');
  assert.equal(plan.executable, 'Icon_App.app/Contents/MacOS/Icon_App');
  const icon = findFile(plan, '/Contents/Resources/Icon_App.icns');
  assert.equal(utf8(icon.bytes.subarray(0, 4)), 'icns');
  const plist = utf8(findFile(plan, '/Contents/Info.plist').bytes);
  assert.match(plist, /<key>CFBundleIconFile<\/key><string>Icon_App\.icns<\/string>/);
  assert.match(plist, /<key>CFBundleExecutable<\/key><string>Icon_App<\/string>/);
  assert.equal(decodeNativeGuiPayloadV19(plan.sealedBytes).length > 0, true);
});

test('Linux experimental package plan carries hicolor PNG and desktop metadata next to the sealed runtime', () => {
  const plan = createNativeWindowIconPackagePlanV110(runtimes.linux, ir, {
    platform: 'linux',
    name: 'Icon App',
    resources: [APP_ICON]
  });
  assert.equal(plan.executable, 'Icon_App');
  assert.deepEqual(plan.files.map(file => file.path), [
    'Icon_App',
    'share/icons/hicolor/16x16/apps/Icon_App.png',
    'share/applications/Icon_App.desktop'
  ]);
  const desktop = utf8(findFile(plan, '.desktop').bytes);
  assert.match(desktop, /Exec=Icon_App/);
  assert.match(desktop, /Icon=Icon_App/);
  assert.equal(decodeNativeGuiPayloadV19(plan.sealedBytes).length > 0, true);
});

test('icon-free v1.10 package plans remain valid and omit all packaging metadata', () => {
  const plainIr = buildNativeGuiIRV19(compile(`window "Plain" as main:\n  text "Plain"\n`, { name: 'Plain', kind: 'window' }));
  for (const platform of ['windows', 'macos', 'linux']) {
    const plan = createNativeWindowIconPackagePlanV110(runtimes[platform], plainIr, {
      platform,
      name: 'Plain',
      resources: []
    });
    assert.equal(plan.iconPackaging.hasApplicationIcon, false);
    assert.equal(plan.currentProductPromoted, false);
    assert.ok(plan.files.every(file => !/\.(ico|icns|desktop|png)$/.test(file.path)));
  }
});
