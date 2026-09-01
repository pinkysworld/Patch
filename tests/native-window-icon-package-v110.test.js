import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV19 } from '../src/native-gui-ir-v19.js';
import { decodeNativeGuiPayloadV19 } from '../src/sealed-native-gui-v19.js';
import {
  PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_ID,
  PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_VERSION,
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

test('Windows icon-bearing Current Ready package plan fails closed when runtime v1.10 lacks the reserved PE icon slot', () => {
  assert.equal(PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_VERSION, '0.2');
  assert.equal(PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_ID, 'native-window-icon-package-v110/0.2');
  assert.throws(
    () => createNativeWindowIconPackagePlanV110(runtimes.windows, ir, {
      platform: 'windows',
      name: 'Icon App',
      resources: [APP_ICON]
    }),
    /Windows PE|DOS header|reserved runtime-v1\.10 application icon slot/
  );
});

test('macOS Current Ready package plan installs ICNS into the app bundle and names it in Info.plist', () => {
  const plan = createNativeWindowIconPackagePlanV110(runtimes.macos, ir, {
    platform: 'macos',
    name: 'Icon App',
    resources: [APP_ICON]
  });
  assert.equal(plan.id, PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_ID);
  assert.equal(plan.currentProductPromoted, true);
  assert.equal(plan.bundle, 'Icon_App.app');
  assert.equal(plan.executable, 'Icon_App.app/Contents/MacOS/Icon_App');
  const icon = findFile(plan, '/Contents/Resources/Icon_App.icns');
  assert.equal(utf8(icon.bytes.subarray(0, 4)), 'icns');
  const plist = utf8(findFile(plan, '/Contents/Info.plist').bytes);
  assert.match(plist, /<key>CFBundleIconFile<\/key><string>Icon_App\.icns<\/string>/);
  assert.match(plist, /<key>CFBundleExecutable<\/key><string>Icon_App<\/string>/);
  assert.equal(decodeNativeGuiPayloadV19(plan.sealedBytes).length > 0, true);
});

test('Linux Current Ready package plan carries hicolor PNG and desktop metadata next to the sealed runtime', () => {
  const plan = createNativeWindowIconPackagePlanV110(runtimes.linux, ir, {
    platform: 'linux',
    name: 'Icon App',
    resources: [APP_ICON]
  });
  assert.equal(plan.currentProductPromoted, true);
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

test('icon-free Current Ready v1.10 package plans remain valid and omit all icon packaging metadata', () => {
  const plainIr = buildNativeGuiIRV19(compile(`window "Plain" as main:\n  text "Plain"\n`, { name: 'Plain', kind: 'window' }));
  for (const platform of ['windows', 'macos', 'linux']) {
    const plan = createNativeWindowIconPackagePlanV110(runtimes[platform], plainIr, {
      platform,
      name: 'Plain',
      resources: []
    });
    assert.equal(plan.iconPackaging.hasApplicationIcon, false);
    assert.equal(plan.currentProductPromoted, true);
    assert.equal(plan.peIconEmbedded, platform === 'windows' ? false : null);
    assert.ok(plan.files.every(file => !/\.(ico|icns|desktop|png)$/.test(file.path)));
  }
});
