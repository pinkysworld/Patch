import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PATCH_OFFLINE_STUDIO_MANIFEST_FORMAT,
  PATCH_OFFLINE_STUDIO_MANIFEST_VERSION,
  buildOfflineStudioManifest,
  collectOfflineStudioFiles,
  offlineStudioAssetMap
} from '../scripts/offline-studio-assets.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-studio-test-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><script type="module" src="./playground.js"></script>');
  fs.writeFileSync(path.join(root, 'manifest.webmanifest'), '{}');
  fs.writeFileSync(path.join(root, 'sw.js'), 'self.addEventListener("fetch",()=>{});');
  fs.writeFileSync(path.join(root, 'playground.js'), 'import "./src/interpreter.js";');
  fs.writeFileSync(path.join(root, 'src', 'interpreter.js'), 'export class PatchInterpreter {}');
  return root;
}

test('Offline Studio manifest is deterministic and content addressed', () => {
  const root = fixture();
  try {
    const first = buildOfflineStudioManifest(root, { patchVersion: 'test' });
    const second = buildOfflineStudioManifest(root, { patchVersion: 'test' });
    assert.equal(first.format, PATCH_OFFLINE_STUDIO_MANIFEST_FORMAT);
    assert.equal(first.manifestVersion, PATCH_OFFLINE_STUDIO_MANIFEST_VERSION);
    assert.equal(first.patchVersion, 'test');
    assert.equal(first.fileCount, 5);
    assert.equal(first.closureSha256, second.closureSha256);
    assert.deepEqual(first.files, second.files);
    assert.match(first.closureSha256, /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Offline Studio manifest changes when an embedded file changes', () => {
  const root = fixture();
  try {
    const before = buildOfflineStudioManifest(root, { patchVersion: 'test' }).closureSha256;
    fs.appendFileSync(path.join(root, 'playground.js'), '\n// changed');
    const after = buildOfflineStudioManifest(root, { patchVersion: 'test' }).closureSha256;
    assert.notEqual(before, after);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Offline Studio manifest fails closed when critical IDE assets are missing', () => {
  const root = fixture();
  try {
    fs.unlinkSync(path.join(root, 'sw.js'));
    assert.throws(() => buildOfflineStudioManifest(root), /missing sw\.js/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Offline Studio SEA asset map namespaces every embedded site file', () => {
  const root = fixture();
  const manifestFile = path.join(root, 'offline-studio-manifest.json');
  try {
    fs.writeFileSync(manifestFile, '{}');
    const assets = offlineStudioAssetMap(root, manifestFile);
    assert.equal(assets['offline-studio-manifest.json'], manifestFile);
    assert.equal(assets['site/index.html'], path.join(root, 'index.html'));
    assert.equal(assets['site/src/interpreter.js'], path.join(root, 'src', 'interpreter.js'));
    assert.equal(collectOfflineStudioFiles(root).some(entry => entry.path === 'offline-studio-manifest.json'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
