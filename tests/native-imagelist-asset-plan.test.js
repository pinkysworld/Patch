import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import {
  PATCH_NATIVE_IMAGELIST_ASSET_PLAN_ID,
  NativeImageListAssetPlanError,
  planNativeImageListAssets
} from '../src/native-imagelist-asset-plan.js';

const SOURCE = `window "Files" as main size 420, 220:
  imagelist as app_images size 20, 20:
    image open from "patch-resource:icons.open"
    image save from "patch-resource:icons.save"
  button "Open" as open_button image app_images.open at 24, 24 size 120, 36
  button "Open again" as open_again image app_images.open at 24, 72 size 140, 36
`;

const OPEN = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

const SAVE = Object.freeze({
  id: 'icons.save',
  path: 'resources/save.jpg',
  mediaType: 'image/jpeg',
  size: 1,
  sha256: '1'.repeat(64),
  data: 'AA=='
});

test('native ImageList pretransport plan resolves used Button assets and deduplicates payloads', () => {
  const plan = planNativeImageListAssets(parse(SOURCE)[0], [OPEN, SAVE]);
  assert.equal(plan.id, PATCH_NATIVE_IMAGELIST_ASSET_PLAN_ID);
  assert.equal(plan.status, 'pretransport');
  assert.equal(plan.nativeGuiReady, false);
  assert.equal(plan.imageListCount, 1);
  assert.equal(plan.consumerCount, 2);
  assert.equal(plan.payloads.length, 1);
  assert.equal(plan.payloads[0].resourceId, 'icons.open');
  assert.equal(plan.payloads[0].dataUri, 'data:image/png;base64,AA==');
  assert.deepEqual(plan.consumers.map(item => ({
    controlId: item.controlId,
    resourceId: item.resourceId,
    width: item.logicalWidth,
    height: item.logicalHeight
  })), [
    { controlId: 'open_button', resourceId: 'icons.open', width: 20, height: 20 },
    { controlId: 'open_again', resourceId: 'icons.open', width: 20, height: 20 }
  ]);
});

test('native ImageList pretransport plan fails closed on missing project resources', () => {
  assert.throws(
    () => planNativeImageListAssets(parse(SOURCE)[0], []),
    error => error instanceof NativeImageListAssetPlanError && error.code === 'NATIVE_IMAGELIST_RESOURCE_MISSING'
  );
});

test('native ImageList pretransport plan keeps PNG/JPEG native picture policy', () => {
  const svg = {
    ...OPEN,
    mediaType: 'image/svg+xml',
    path: 'resources/open.svg'
  };
  assert.throws(
    () => planNativeImageListAssets(parse(SOURCE)[0], [svg, SAVE]),
    error => error instanceof NativeImageListAssetPlanError && /PNG|JPEG|native-picture-formats/.test(error.message)
  );
});

test('native ImageList pretransport plan validates missing lists/items through the shared binding contract', () => {
  const missing = parse(`window "Files":
  button "Open" as open_button image missing.open
`)[0];
  assert.throws(
    () => planNativeImageListAssets(missing, [OPEN]),
    /ImageList 'missing' that is not defined on this Form/
  );
});
