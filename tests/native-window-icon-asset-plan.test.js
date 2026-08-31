import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import {
  PATCH_NATIVE_WINDOW_ICON_ASSET_PLAN_ID,
  NativeWindowIconAssetPlanError,
  planNativeWindowIconAssets
} from '../src/native-window-icon-asset-plan.js';

const SOURCE = `window "Main" as main size 520, 320 icon "patch-resource:app.icon":
  text "Main"

window "Settings" as settings size 420, 260 icon "patch-resource:app.icon":
  text "Settings"

window "About" as about size 360, 220 icon "patch-resource:about.icon":
  text "About"
`;

const APP_ICON = Object.freeze({
  id: 'app.icon',
  path: 'resources/app.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

const ABOUT_ICON = Object.freeze({
  id: 'about.icon',
  path: 'resources/about.jpg',
  mediaType: 'image/jpeg',
  size: 1,
  sha256: '1'.repeat(64),
  data: 'AA=='
});

test('native window icon pretransport plan selects the first icon-bearing Form as application icon and deduplicates resources', () => {
  const plan = planNativeWindowIconAssets(parse(SOURCE), [APP_ICON, ABOUT_ICON]);
  assert.equal(plan.id, PATCH_NATIVE_WINDOW_ICON_ASSET_PLAN_ID);
  assert.equal(plan.status, 'pretransport');
  assert.equal(plan.nativeGuiReady, false);
  assert.equal(plan.consumerCount, 3);
  assert.equal(plan.payloads.length, 2);
  assert.deepEqual(plan.applicationIcon, {
    windowIndex: 0,
    windowId: 'main',
    line: 1,
    resourceId: 'app.icon'
  });
  assert.deepEqual(plan.consumers.map(item => ({
    windowIndex: item.windowIndex,
    windowId: item.windowId,
    resourceId: item.resourceId
  })), [
    { windowIndex: 0, windowId: 'main', resourceId: 'app.icon' },
    { windowIndex: 1, windowId: 'settings', resourceId: 'app.icon' },
    { windowIndex: 2, windowId: 'about', resourceId: 'about.icon' }
  ]);
  assert.deepEqual(plan.payloads.map(item => item.resourceId), ['app.icon', 'about.icon']);
  assert.equal(plan.payloads[0].dataUri, 'data:image/png;base64,AA==');
});

test('native window icon pretransport plan permits programs without icons without widening current native support', () => {
  const plan = planNativeWindowIconAssets(parse(`window "Plain" as main:\n  text "Plain"\n`), []);
  assert.equal(plan.applicationIcon, null);
  assert.equal(plan.consumerCount, 0);
  assert.deepEqual(plan.consumers, []);
  assert.deepEqual(plan.payloads, []);
  assert.equal(plan.nativeGuiReady, false);
});

test('native window icon pretransport plan fails closed on missing project resources', () => {
  assert.throws(
    () => planNativeWindowIconAssets(parse(SOURCE), [ABOUT_ICON]),
    error => error instanceof NativeWindowIconAssetPlanError && error.code === 'NATIVE_WINDOW_ICON_RESOURCE_MISSING'
  );
});

test('native window icon pretransport plan rejects non-project icon locators for deterministic offline builds', () => {
  const external = parse(`window "External" as main icon "https://example.test/icon.png":\n  text "External"\n`);
  assert.throws(
    () => planNativeWindowIconAssets(external, []),
    error => error instanceof NativeWindowIconAssetPlanError && error.code === 'NATIVE_WINDOW_ICON_PROJECT_RESOURCE_REQUIRED'
  );
});

test('native window icon pretransport plan reuses the current PNG/JPEG native picture policy', () => {
  const svg = {
    ...APP_ICON,
    path: 'resources/app.svg',
    mediaType: 'image/svg+xml'
  };
  assert.throws(
    () => planNativeWindowIconAssets(parse(SOURCE), [svg, ABOUT_ICON]),
    error => error instanceof NativeWindowIconAssetPlanError && /PNG|JPEG|native-picture-formats/.test(error.message)
  );
});
