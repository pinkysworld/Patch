import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_IMAGE_MEDIA_TYPES,
  PATCH_STUDIO_MAX_RESOURCE_BYTES,
  StudioResourceError,
  base64ToBytes,
  buildStudioImageResource,
  bytesToBase64,
  normalizeStudioResourceId,
  normalizeStudioResourcePath,
  resourceById,
  resourceBytes,
  studioResourceLocator,
  studioResourceSourceExpression,
  validateStudioResource,
  validateStudioResources,
  verifyStudioResource
} from '../src/studio-resources.js';

const encoder = new TextEncoder();

async function svgResource(id = 'app.logo') {
  return buildStudioImageResource({
    id,
    path: 'resources/logo.svg',
    mediaType: 'image/svg+xml',
    bytes: encoder.encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>')
  });
}

test('Studio image resource builder produces deterministic canonical metadata and SHA-256', async () => {
  const first = await svgResource();
  const second = await svgResource();
  assert.deepEqual(first, second);
  assert.equal(first.id, 'app.logo');
  assert.equal(first.path, 'resources/logo.svg');
  assert.equal(first.mediaType, 'image/svg+xml');
  assert.match(first.sha256, /^[0-9a-f]{64}$/);
  assert.equal(first.size, resourceBytes(first).length);
  assert.deepEqual(await verifyStudioResource(first), { ...first });
});

test('Studio resource ids paths and source locators stay project-relative and language-neutral', () => {
  assert.equal(normalizeStudioResourceId('app.logo-dark'), 'app.logo-dark');
  assert.equal(normalizeStudioResourcePath('images\\brand\\logo.png'), 'images/brand/logo.png');
  assert.equal(studioResourceLocator('app.logo'), 'patch-resource:app.logo');
  assert.equal(studioResourceSourceExpression('app.logo'), '"patch-resource:app.logo"');
  assert.throws(() => normalizeStudioResourceId('../logo'), error => error.code === 'STUDIO_RESOURCE_ID');
  assert.throws(() => normalizeStudioResourcePath('../logo.png'), error => error.code === 'STUDIO_RESOURCE_PATH');
});

test('Studio resources round-trip browser-safe base64 without Node-only Buffer APIs', () => {
  const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
  const encoded = bytesToBase64(bytes);
  assert.deepEqual([...base64ToBytes(encoded)], [...bytes]);
});

test('Studio resource collection rejects duplicate ids duplicate paths and unsupported media types', async () => {
  const first = await svgResource('app.logo');
  const duplicateId = { ...first, path: 'resources/other.svg' };
  const duplicatePath = { ...first, id: 'app.other' };
  assert.throws(() => validateStudioResources([first, duplicateId]), error => error.code === 'STUDIO_RESOURCE_DUPLICATE_ID');
  assert.throws(() => validateStudioResources([first, duplicatePath]), error => error.code === 'STUDIO_RESOURCE_DUPLICATE_PATH');
  assert.throws(
    () => validateStudioResource({ ...first, mediaType: 'image/gif' }),
    error => error.code === 'STUDIO_RESOURCE_MEDIA_TYPE'
  );
  assert.deepEqual(PATCH_STUDIO_IMAGE_MEDIA_TYPES, ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
});

test('Studio resource validation fails closed on size metadata base64 and SHA-256 mismatch', async () => {
  const resource = await svgResource();
  assert.throws(() => validateStudioResource({ ...resource, size: resource.size + 1 }), error => error.code === 'STUDIO_RESOURCE_SIZE');
  assert.throws(() => validateStudioResource({ ...resource, data: 'not-base64' }), error => error.code === 'STUDIO_RESOURCE_DATA');
  await assert.rejects(
    () => verifyStudioResource({ ...resource, sha256: '0'.repeat(64) }),
    error => error.code === 'STUDIO_RESOURCE_HASH_MISMATCH'
  );
});

test('Studio resource builder enforces the per-resource size ceiling before persistence', async () => {
  const bytes = new Uint8Array(PATCH_STUDIO_MAX_RESOURCE_BYTES + 1);
  await assert.rejects(
    () => buildStudioImageResource({ id: 'too.large', mediaType: 'image/png', bytes }),
    error => error instanceof StudioResourceError && error.code === 'STUDIO_RESOURCE_TOO_LARGE'
  );
});

test('resource lookup validates collection integrity before returning a logical id', async () => {
  const logo = await svgResource('app.logo');
  const icon = await buildStudioImageResource({
    id: 'app.icon',
    path: 'resources/icon.png',
    mediaType: 'image/png',
    bytes: new Uint8Array([137, 80, 78, 71])
  });
  assert.equal(resourceById([logo, icon], 'app.icon')?.path, 'resources/icon.png');
  assert.equal(resourceById([logo, icon], 'missing'), null);
});
