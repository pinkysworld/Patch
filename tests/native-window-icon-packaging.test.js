import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV19 } from '../src/native-gui-ir-v19.js';
import {
  PATCH_NATIVE_WINDOW_ICON_PACKAGING_ID,
  NativeWindowIconPackagingError,
  planNativeWindowIconPackaging,
  inspectPngDimensions
} from '../src/native-window-icon-packaging.js';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';
const PNG_RESOURCE = Object.freeze({
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

function buildIr(source = SOURCE) {
  return buildNativeGuiIRV19(compile(source, { name: 'Icon Packaging', kind: 'window' }));
}

function text(bytes) {
  return new TextDecoder().decode(bytes);
}

test('native icon packaging produces deterministic ICO ICNS and Linux desktop artifacts from the application PNG', () => {
  const plan = planNativeWindowIconPackaging(buildIr(), [PNG_RESOURCE], { name: 'Icon Packaging' });
  assert.equal(plan.id, PATCH_NATIVE_WINDOW_ICON_PACKAGING_ID);
  assert.equal(plan.experimental, true);
  assert.equal(plan.currentProductPromoted, false);
  assert.equal(plan.hasApplicationIcon, true);
  assert.deepEqual(plan.applicationIcon, {
    resourceId: 'app.icon',
    formIndex: 0,
    formId: 'main',
    width: 16,
    height: 16,
    sha256: PNG_RESOURCE.sha256
  });

  assert.equal(plan.windows.filename, 'Icon_Packaging.ico');
  assert.equal(plan.windows.peEmbedded, false);
  assert.deepEqual([...plan.windows.bytes.subarray(0, 6)], [0, 0, 1, 0, 1, 0]);
  assert.equal(plan.windows.bytes[6], 16);
  assert.equal(plan.windows.bytes[7], 16);
  const icoView = new DataView(plan.windows.bytes.buffer, plan.windows.bytes.byteOffset, plan.windows.bytes.byteLength);
  assert.equal(icoView.getUint32(14, true), PNG_RESOURCE.size);
  assert.equal(icoView.getUint32(18, true), 22);
  assert.deepEqual([...plan.windows.bytes.subarray(22, 30)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.equal(plan.macos.bundlePath, 'Contents/Resources/Icon_Packaging.icns');
  assert.equal(plan.macos.plistKey, 'CFBundleIconFile');
  assert.equal(text(plan.macos.bytes.subarray(0, 4)), 'icns');
  const icnsView = new DataView(plan.macos.bytes.buffer, plan.macos.bytes.byteOffset, plan.macos.bytes.byteLength);
  assert.equal(icnsView.getUint32(4, false), plan.macos.bytes.length);
  assert.equal(text(plan.macos.bytes.subarray(8, 12)), 'icp4');
  assert.equal(icnsView.getUint32(12, false), 8 + PNG_RESOURCE.size);
  assert.deepEqual([...plan.macos.bytes.subarray(16, 24)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.equal(plan.linux.iconName, 'Icon_Packaging');
  assert.equal(plan.linux.iconPath, 'share/icons/hicolor/16x16/apps/Icon_Packaging.png');
  assert.equal(plan.linux.desktopPath, 'share/applications/Icon_Packaging.desktop');
  assert.match(plan.linux.desktopText, /^\[Desktop Entry\]/);
  assert.match(plan.linux.desktopText, /Name=Icon Packaging/);
  assert.match(plan.linux.desktopText, /Exec=Icon_Packaging/);
  assert.match(plan.linux.desktopText, /Icon=Icon_Packaging/);
  assert.deepEqual(plan.linux.iconBytes, new Uint8Array(Buffer.from(PNG_BASE64, 'base64')));
});

test('native icon packaging keeps icon-free programs as a no-op without widening the current product contract', () => {
  const source = `window "Plain" as main:\n  text "Plain"\n`;
  const plan = planNativeWindowIconPackaging(buildIr(source), [], { name: 'Plain' });
  assert.equal(plan.hasApplicationIcon, false);
  assert.equal(plan.applicationIcon, null);
  assert.equal(plan.windows, null);
  assert.equal(plan.macos, null);
  assert.equal(plan.linux, null);
  assert.equal(plan.currentProductPromoted, false);
});

test('packaging v0.1 keeps JPEG valid for runtime transport but fails closed for cross-platform application packaging', () => {
  const jpeg = {
    ...PNG_RESOURCE,
    path: 'resources/app.jpg',
    mediaType: 'image/jpeg'
  };
  assert.throws(
    () => planNativeWindowIconPackaging(buildIr(), [jpeg], { name: 'JPEG Icon' }),
    error => error instanceof NativeWindowIconPackagingError
      && error.code === 'NATIVE_WINDOW_ICON_PACKAGING_PNG_REQUIRED'
      && /JPEG remains valid for runtime-v1\.10 Form icons/.test(error.message)
  );
});

test('packaging v0.1 rejects non-standard or malformed PNG dimensions instead of inventing platform conversions', () => {
  const tiny = Object.freeze({
    id: 'app.icon',
    path: 'resources/app.png',
    mediaType: 'image/png',
    size: 70,
    sha256: 'd126901e8b7f82749aee7b7c0ec59838286c9f8d75ffc74147f34ac2b4bad460',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg=='
  });
  assert.deepEqual(inspectPngDimensions(new Uint8Array(Buffer.from(tiny.data, 'base64'))), { width: 1, height: 1 });
  assert.throws(
    () => planNativeWindowIconPackaging(buildIr(), [tiny], { name: 'Tiny' }),
    error => error instanceof NativeWindowIconPackagingError
      && error.code === 'NATIVE_WINDOW_ICON_PACKAGING_DIMENSIONS'
  );
});
