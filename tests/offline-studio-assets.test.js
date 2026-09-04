import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
import { installOfflineStudioSiteOverlay } from '../scripts/offline-studio-site-overlay.js';
import {
  OFFLINE_BUILD_BRIDGE_PROTOCOL,
  OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
  materializeOfflineWorkspaceSnapshot,
  validateOfflineBuildRequest,
  validateOfflineWorkspaceSnapshot
} from '../src/offline-studio-build-bridge.js';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';
const PNG_SHA256 = '789cc3d7c8416b40a4f20155ece071c362f85d610e71b32b328bfc12b4cf2ead';

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

function resourceProject() {
  const resource = (id, file) => ({
    id,
    path: `resources/${file}`,
    mediaType: 'image/png',
    size: 86,
    sha256: PNG_SHA256,
    data: PNG_BASE64
  });
  return {
    format: 'patch-studio-project',
    version: 4,
    project: {
      name: 'ResourceSmoke',
      kind: 'window',
      entry: 'main.patch',
      build: { target: 'native-linux', nativeMode: 'local' }
    },
    files: [{
      path: 'main.patch',
      content: 'window "Resource Smoke" as main size 420, 220 icon "patch-resource:app.icon":\n  imagelist as images size 16, 16:\n    image open from "patch-resource:icons.open"\n  button "Open" as open_button image images.open at 24, 32 size 140, 40\n'
    }],
    resources: [resource('app.icon', 'app.png'), resource('icons.open', 'open.png')]
  };
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

test('Offline Studio host-build overlay injects before a revisioned native-build module exactly once', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-studio-overlay-'));
  const index = path.join(root, 'index.html');
  try {
    fs.writeFileSync(index, '<!doctype html>\n<script type="module" src="./native-build.js?v=85646bc906602f27"></script>\n', 'utf8');
    installOfflineStudioSiteOverlay(root);
    installOfflineStudioSiteOverlay(root);
    const html = fs.readFileSync(index, 'utf8');
    const clientTag = '<script type="module" src="./offline-studio-native-build.js"></script>';
    const nativeTag = '<script type="module" src="./native-build.js?v=85646bc906602f27"></script>';
    assert.equal(html.split(clientTag).length - 1, 1);
    assert.ok(html.indexOf(clientTag) < html.indexOf(nativeTag));
    assert.ok(fs.existsSync(path.join(root, 'offline-studio-native-build.js')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Offline Studio project-v4 snapshots materialize one bounded canonical project file with resource evidence', () => {
  assert.equal(OFFLINE_BUILD_BRIDGE_PROTOCOL, 'patch-offline-build-bridge/0.2');
  assert.equal(OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL, 'patch-offline-workspace-snapshot/0.2');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-project-snapshot-'));
  try {
    const request = {
      protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
      requestId: 'resource-001',
      project: resourceProject()
    };
    const validated = validateOfflineWorkspaceSnapshot(request);
    assert.equal(validated.kind, 'project');
    assert.equal(validated.sourceFileCount, 1);
    assert.equal(validated.resourceCount, 2);
    const snapshot = materializeOfflineWorkspaceSnapshot(root, request);
    assert.equal(snapshot.kind, 'project');
    assert.equal(snapshot.source, '.patch-studio/snapshots/resource-001/project.patchproject');
    assert.equal(snapshot.sourceFileCount, 1);
    assert.equal(snapshot.resourceCount, 2);
    assert.match(snapshot.sha256, /^[0-9a-f]{64}$/);
    const bytes = fs.readFileSync(path.join(root, ...snapshot.source.split('/')));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), snapshot.sha256);
    const stored = JSON.parse(bytes.toString('utf8'));
    assert.equal(stored.resources[0].sha256, PNG_SHA256);
    assert.equal(stored.resources[1].id, 'icons.open');
    assert.equal(validateOfflineBuildRequest({
      protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
      action: 'build-native-window',
      requestId: 'resource-001',
      source: snapshot.source,
      appName: 'ResourceSmoke'
    }).source, snapshot.source);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Offline Studio project-v4 snapshot rejects tampered resource data and path escape attempts', () => {
  const wrongHash = resourceProject();
  wrongHash.resources[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateOfflineWorkspaceSnapshot({
    protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
    requestId: 'bad-hash',
    project: wrongHash
  }), /failed SHA-256 verification/);

  const escape = resourceProject();
  escape.resources[0].path = '../outside.png';
  assert.throws(() => validateOfflineWorkspaceSnapshot({
    protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
    requestId: 'bad-path',
    project: escape
  }), /stay inside the project|project-relative path/);
});

test('Offline Studio installed-build browser client sends project-v4 snapshots and no longer rejects resources', () => {
  const client = fs.readFileSync('scripts/offline-studio-native-build-client.js', 'utf8');
  assert.match(client, /patch-offline-build-bridge\/0\.2/);
  assert.match(client, /patch-offline-workspace-snapshot\/0\.2/);
  assert.match(client, /project\s*\n\s*\}\);/);
  assert.match(client, /resourceCount/);
  assert.doesNotMatch(client, /resources are not yet transported|does not materialize project-v4 binary resources/);
  const checker = fs.readFileSync('scripts/check-offline-studio-executable.js', 'utf8');
  assert.match(checker, /check-offline-studio-resource-build\.js/);
});
