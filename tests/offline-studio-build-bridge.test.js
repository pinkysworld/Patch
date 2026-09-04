import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  OFFLINE_BUILD_ARTIFACT_PREFIX,
  OFFLINE_BUILD_BRIDGE_PATH,
  OFFLINE_BUILD_BRIDGE_PROTOCOL,
  OFFLINE_WORKSPACE_SNAPSHOT_PATH,
  OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
  OfflineBuildBridgeError,
  executeOfflineBuildRequest,
  materializeOfflineWorkspaceSnapshot,
  resolveOfflineBuildWorkspace,
  startOfflineBuildBridge,
  validateOfflineBuildRequest,
  validateOfflineWorkspaceSnapshot
} from '../src/offline-studio-build-bridge.js';

const SAFE_TOKEN = '0123456789abcdef0123456789abcdef';
const STUDIO_ORIGIN = 'http://127.0.0.1:41001';

function request(overrides = {}) {
  return {
    protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
    action: 'build-native-window',
    requestId: 'build-001',
    source: 'src/app.patch',
    appName: 'PatchApp',
    ...overrides
  };
}

function snapshot(overrides = {}) {
  return {
    protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
    requestId: 'snapshot-001',
    source: 'window "App" size 320, 200:\n  text "Ready"\n',
    ...overrides
  };
}

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-build-bridge-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app.patch'), 'window "App" size 320, 200:\n  text "Ready"\n', 'utf8');
  return root;
}

test('Offline Studio Stage 2 entrypoints remain syntax-valid', () => {
  for (const file of [
    'src/offline-studio-build-bridge-core.cjs',
    'src/offline-studio-build-bridge.js',
    'scripts/offline-studio-compiler-builder.cjs',
    'scripts/offline-studio-native-build-client.js',
    'scripts/offline-studio-site-overlay.js',
    'scripts/offline-studio-local-build-assets.js',
    'scripts/offline-studio-runner.cjs',
    'scripts/offline-studio-portable-runner.cjs',
    'scripts/build-offline-studio.js',
    'scripts/build-portable-offline-studio.js',
    'scripts/build-offline-studio-runtime-kit.js'
  ]) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
});

test('build bridge 0.1 validates one narrow native Window request schema', () => {
  assert.equal(validateOfflineBuildRequest(request()).protocol, OFFLINE_BUILD_BRIDGE_PROTOCOL);
  assert.throws(() => validateOfflineBuildRequest(request({ action: 'run-shell' })), /Only 'build-native-window'/);
  assert.throws(() => validateOfflineBuildRequest(request({ source: '../outside.patch' })), /relative Patch file/i);
  assert.throws(() => validateOfflineBuildRequest(request({ source: 'C:outside.patch' })), /relative Patch file/i);
  assert.throws(() => validateOfflineBuildRequest(request({ source: 'src/app.txt' })), /\.patch file/);
  assert.throws(() => validateOfflineBuildRequest(request({ appName: '../App' })), /appName/);
  assert.throws(() => validateOfflineBuildRequest({ ...request(), command: 'rm -rf' }), /Unknown build request field/);
});

test('workspace snapshot schema accepts only source text and a safe request id', () => {
  const parsed = validateOfflineWorkspaceSnapshot(snapshot());
  assert.equal(parsed.protocol, OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL);
  assert.equal(parsed.requestId, 'snapshot-001');
  assert.throws(() => validateOfflineWorkspaceSnapshot(snapshot({ requestId: '../escape' })), /requestId/);
  assert.throws(() => validateOfflineWorkspaceSnapshot({ ...snapshot(), output: '/tmp/App' }), /Unknown workspace snapshot field/);
  assert.throws(() => validateOfflineWorkspaceSnapshot(snapshot({ source: '' })), /source snapshot is empty/i);
  assert.throws(() => validateOfflineWorkspaceSnapshot(snapshot({ source: 'x'.repeat(1024 * 1024 + 1) })), /1 MiB/);
});

test('workspace snapshot materializes to the fixed internal source path with SHA-256 evidence', () => {
  const root = workspace();
  try {
    const result = materializeOfflineWorkspaceSnapshot(root, snapshot());
    const expected = path.join(root, '.patch-studio', 'snapshots', 'snapshot-001', 'main.patch');
    assert.equal(result.source, '.patch-studio/snapshots/snapshot-001/main.patch');
    assert.equal(fs.readFileSync(expected, 'utf8'), snapshot().source);
    assert.equal(result.bytes, Buffer.byteLength(snapshot().source, 'utf8'));
    assert.equal(result.sha256, crypto.createHash('sha256').update(snapshot().source).digest('hex'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace snapshot rejects a symlinked internal directory when symlinks are available', t => {
  const root = workspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-snapshot-outside-'));
  try {
    try {
      fs.symlinkSync(outside, path.join(root, '.patch-studio'), 'dir');
    } catch {
      t.skip('Host does not permit creating the snapshot symlink.');
      return;
    }
    assert.throws(() => materializeOfflineWorkspaceSnapshot(root, snapshot()), /may not contain symbolic links/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('workspace resolution keeps source and deterministic output under the opened workspace', () => {
  const root = workspace();
  try {
    const resolved = resolveOfflineBuildWorkspace(root, validateOfflineBuildRequest(request()));
    assert.equal(resolved.sourcePath, fs.realpathSync(path.join(root, 'src', 'app.patch')));
    assert.ok(resolved.outDir.startsWith(`${fs.realpathSync(root)}${path.sep}`));
    assert.ok(resolved.outDir.endsWith(path.join('.patch-build', 'native', 'build-001')));
    assert.throws(() => validateOfflineBuildRequest(request({ source: '../outside.patch' })), OfflineBuildBridgeError);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace resolution fails closed on a source symlink that escapes the workspace when symlinks are available', t => {
  const root = workspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-build-bridge-outside-'));
  try {
    fs.writeFileSync(path.join(outside, 'outside.patch'), 'show "outside"\n', 'utf8');
    try {
      fs.symlinkSync(path.join(outside, 'outside.patch'), path.join(root, 'src', 'escape.patch'));
    } catch {
      t.skip('Host does not permit creating the test symlink.');
      return;
    }
    assert.throws(
      () => resolveOfflineBuildWorkspace(root, validateOfflineBuildRequest(request({ source: 'src/escape.patch' }))),
      /escapes the opened workspace/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('native output path rejects a symlinked .patch-build escape before invoking the builder', t => {
  const root = workspace();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-build-output-outside-'));
  try {
    try {
      fs.symlinkSync(outside, path.join(root, '.patch-build'), 'dir');
    } catch {
      t.skip('Host does not permit creating the output symlink.');
      return;
    }
    let called = false;
    assert.throws(
      () => executeOfflineBuildRequest(root, request(), {
        builder() {
          called = true;
          return { platform: 'Linux', backend: 'gtk3', outputKind: 'Linux executable' };
        }
      }),
      /may not contain symbolic links/
    );
    assert.equal(called, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('bridge executes the existing host-native builder directly with canonical bounded paths', () => {
  const root = workspace();
  const calls = [];
  try {
    const result = executeOfflineBuildRequest(root, request(), {
      platform: 'linux',
      builder(sourcePath, options) {
        calls.push({ sourcePath, options });
        return { platform: 'Linux', backend: 'gtk3', outputKind: 'Linux executable' };
      }
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sourcePath, fs.realpathSync(path.join(root, 'src', 'app.patch')));
    assert.equal(calls[0].options.name, 'PatchApp');
    assert.equal(calls[0].options.capture, true);
    assert.ok(calls[0].options.outDir.startsWith(`${fs.realpathSync(root)}${path.sep}`));
    assert.deepEqual(result, {
      protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
      requestId: 'build-001',
      action: 'build-native-window',
      ok: true,
      platform: 'Linux',
      backend: 'gtk3',
      outputKind: 'Linux executable',
      outputDirectory: '.patch-build/native/build-001'
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('localhost bridge authenticates snapshot, build and digest-addressed artifact download', async () => {
  const root = workspace();
  let builds = 0;
  const bridge = await startOfflineBuildBridge({
    workspaceRoot: root,
    token: SAFE_TOKEN,
    allowedOrigin: STUDIO_ORIGIN,
    platform: 'linux',
    builder(sourcePath, options) {
      builds += 1;
      assert.ok(sourcePath.endsWith(path.join('.patch-studio', 'snapshots', 'http-001', 'main.patch')));
      const artifactPath = path.join(options.outDir, 'PatchApp');
      fs.writeFileSync(artifactPath, Buffer.from('native artifact bytes'));
      return {
        platform: 'Linux',
        backend: 'offline-compiler/gtk3',
        outputKind: 'Linux executable',
        stdout: 'Linked PatchApp',
        artifactPath,
        artifactType: 'application/octet-stream'
      };
    }
  });
  try {
    assert.equal(bridge.path, OFFLINE_BUILD_BRIDGE_PATH);
    assert.equal(bridge.snapshotPath, OFFLINE_WORKSPACE_SNAPSHOT_PATH);

    const snapshotResponse = await fetch(`${bridge.origin}${bridge.snapshotPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SAFE_TOKEN}`,
        'Content-Type': 'application/json',
        Origin: STUDIO_ORIGIN
      },
      body: JSON.stringify(snapshot({ requestId: 'http-001' }))
    });
    assert.equal(snapshotResponse.status, 200);
    assert.equal(snapshotResponse.headers.get('access-control-allow-origin'), STUDIO_ORIGIN);
    const snapshotBody = await snapshotResponse.json();
    assert.equal(snapshotBody.source, '.patch-studio/snapshots/http-001/main.patch');
    assert.match(snapshotBody.sha256, /^[a-f0-9]{64}$/);

    const buildResponse = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SAFE_TOKEN}`,
        'Content-Type': 'application/json',
        Origin: STUDIO_ORIGIN
      },
      body: JSON.stringify(request({ requestId: 'http-001', source: snapshotBody.source }))
    });
    assert.equal(buildResponse.status, 200);
    const buildBody = await buildResponse.json();
    assert.equal(buildBody.ok, true);
    assert.equal(buildBody.outputDirectory, '.patch-build/native/http-001');
    assert.equal(buildBody.diagnostics, 'Linked PatchApp');
    assert.match(buildBody.artifact.downloadPath, new RegExp(`^${OFFLINE_BUILD_ARTIFACT_PREFIX}[a-f0-9]{32}$`));
    assert.equal(buildBody.artifact.sha256, crypto.createHash('sha256').update('native artifact bytes').digest('hex'));
    assert.equal(builds, 1);

    const artifactResponse = await fetch(`${bridge.origin}${buildBody.artifact.downloadPath}`, {
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, Origin: STUDIO_ORIGIN }
    });
    assert.equal(artifactResponse.status, 200);
    assert.equal(artifactResponse.headers.get('x-patch-artifact-sha256'), buildBody.artifact.sha256);
    assert.equal(Buffer.from(await artifactResponse.arrayBuffer()).toString('utf8'), 'native artifact bytes');
  } finally {
    await bridge.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('localhost bridge rejects wrong token, origin, method, content type and generic command paths', async () => {
  const root = workspace();
  let builds = 0;
  const bridge = await startOfflineBuildBridge({
    workspaceRoot: root,
    token: SAFE_TOKEN,
    allowedOrigin: STUDIO_ORIGIN,
    platform: 'linux',
    builder() {
      builds += 1;
      return { platform: 'Linux', backend: 'gtk3', outputKind: 'Linux executable' };
    }
  });
  try {
    const wrongToken = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-token', 'Content-Type': 'application/json', Origin: STUDIO_ORIGIN },
      body: JSON.stringify(request())
    });
    assert.equal(wrongToken.status, 401);

    const wrongOrigin = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, 'Content-Type': 'application/json', Origin: 'https://example.test' },
      body: JSON.stringify(request())
    });
    assert.equal(wrongOrigin.status, 403);

    const get = await fetch(`${bridge.origin}${bridge.path}`, {
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, Origin: STUDIO_ORIGIN }
    });
    assert.equal(get.status, 405);

    const wrongType = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, 'Content-Type': 'text/plain', Origin: STUDIO_ORIGIN },
      body: JSON.stringify(request())
    });
    assert.equal(wrongType.status, 415);

    const command = await fetch(`${bridge.origin}/v1/command`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, 'Content-Type': 'application/json', Origin: STUDIO_ORIGIN },
      body: JSON.stringify({ command: 'anything' })
    });
    assert.equal(command.status, 404);
    assert.equal(builds, 0);
  } finally {
    await bridge.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bridge returns 413 for a bounded request without exposing a shell surface', async () => {
  const root = workspace();
  const bridge = await startOfflineBuildBridge({
    workspaceRoot: root,
    token: SAFE_TOKEN,
    allowedOrigin: STUDIO_ORIGIN,
    maxBodyBytes: 128,
    builder() {
      throw new Error('must not build');
    }
  });
  try {
    const response = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, 'Content-Type': 'application/json', Origin: STUDIO_ORIGIN },
      body: JSON.stringify(request({ padding: 'x'.repeat(512) }))
    });
    assert.equal(response.status, 413);
  } finally {
    await bridge.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bridge security core contains no child-process or generic shell execution surface', () => {
  const core = fs.readFileSync('src/offline-studio-build-bridge-core.cjs', 'utf8');
  const wrapper = fs.readFileSync('src/offline-studio-build-bridge.js', 'utf8');
  const compilerAdapter = fs.readFileSync('scripts/offline-studio-compiler-builder.cjs', 'utf8');

  assert.doesNotMatch(core, /node:child_process/);
  assert.doesNotMatch(core, /\bexec(?:File|Sync)?\s*\(/);
  assert.doesNotMatch(core, /\bspawn(?:Sync)?\s*\(/);
  assert.match(core, /host !== '127\.0\.0\.1'/);
  assert.match(core, /crypto\.timingSafeEqual/);
  assert.match(core, /prepareSafeDirectory/);
  assert.match(core, /OFFLINE_WORKSPACE_SNAPSHOT_PATH/);

  assert.match(wrapper, /buildNativeGuiForHost/);
  assert.match(wrapper, /offline-studio-build-bridge-core\.cjs/);

  assert.match(compilerAdapter, /spawnSync\(compiler, \[/);
  assert.match(compilerAdapter, /'link', path\.resolve\(sourcePath\)/);
  assert.match(compilerAdapter, /'--name', name/);
  assert.match(compilerAdapter, /'--out', outputBase/);
  assert.doesNotMatch(compilerAdapter, /shell:\s*true/);
  assert.doesNotMatch(compilerAdapter, /\bexec(?:File|Sync)?\s*\(/);
});
