import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  OFFLINE_BUILD_BRIDGE_PATH,
  OFFLINE_BUILD_BRIDGE_PROTOCOL,
  OfflineBuildBridgeError,
  executeOfflineBuildRequest,
  resolveOfflineBuildWorkspace,
  startOfflineBuildBridge,
  validateOfflineBuildRequest
} from '../src/offline-studio-build-bridge.js';

const SAFE_TOKEN = '0123456789abcdef0123456789abcdef';

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

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-build-bridge-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'app.patch'), 'window "App" size 320, 200:\n  text "Ready"\n', 'utf8');
  return root;
}

test('build bridge 0.1 validates one narrow native Window request schema', () => {
  assert.equal(validateOfflineBuildRequest(request()).protocol, OFFLINE_BUILD_BRIDGE_PROTOCOL);
  assert.throws(() => validateOfflineBuildRequest(request({ action: 'run-shell' })), /Only 'build-native-window'/);
  assert.throws(() => validateOfflineBuildRequest(request({ source: '../outside.patch' })), /workspace|relative Patch file/i);
  assert.throws(() => validateOfflineBuildRequest(request({ source: 'src/app.txt' })), /\.patch file/);
  assert.throws(() => validateOfflineBuildRequest(request({ appName: '../App' })), /appName/);
  assert.throws(() => validateOfflineBuildRequest({ ...request(), command: 'rm -rf' }), /Unknown build request field/);
});

test('workspace resolution keeps source and deterministic output under the opened workspace', () => {
  const root = workspace();
  try {
    const resolved = resolveOfflineBuildWorkspace(root, validateOfflineBuildRequest(request()));
    assert.equal(resolved.sourcePath, fs.realpathSync(path.join(root, 'src', 'app.patch')));
    assert.ok(resolved.outDir.startsWith(`${fs.realpathSync(root)}${path.sep}`));
    assert.match(resolved.outDir, new RegExp(`\\.patch-build\\${path.sep}native\\${path.sep}build-001$`));
    assert.throws(
      () => resolveOfflineBuildWorkspace(root, validateOfflineBuildRequest(request({ source: '../outside.patch' }))),
      OfflineBuildBridgeError
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('workspace resolution fails closed on a symlink that escapes the opened workspace when symlinks are available', t => {
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

test('localhost bridge requires bearer auth, POST JSON and never exposes a general command endpoint', async () => {
  const root = workspace();
  let builds = 0;
  const bridge = await startOfflineBuildBridge({
    workspaceRoot: root,
    token: SAFE_TOKEN,
    platform: 'linux',
    builder() {
      builds += 1;
      return { platform: 'Linux', backend: 'gtk3', outputKind: 'Linux executable' };
    }
  });
  try {
    assert.equal(bridge.path, OFFLINE_BUILD_BRIDGE_PATH);

    const wrong = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(request())
    });
    assert.equal(wrong.status, 401);
    assert.equal(builds, 0);

    const get = await fetch(`${bridge.origin}${bridge.path}`, {
      headers: { Authorization: `Bearer ${SAFE_TOKEN}` }
    });
    assert.equal(get.status, 405);

    const command = await fetch(`${bridge.origin}/v1/command`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'anything' })
    });
    assert.equal(command.status, 404);

    const ok = await fetch(`${bridge.origin}${bridge.path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SAFE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request())
    });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.ok, true);
    assert.equal(body.outputDirectory, '.patch-build/native/build-001');
    assert.equal(builds, 1);
  } finally {
    await bridge.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('bridge implementation contains no direct child-process or shell execution surface', () => {
  const source = fs.readFileSync('src/offline-studio-build-bridge.js', 'utf8');
  assert.doesNotMatch(source, /node:child_process/);
  assert.doesNotMatch(source, /\bexec(?:File|Sync)?\s*\(/);
  assert.doesNotMatch(source, /\bspawn(?:Sync)?\s*\(/);
  assert.match(source, /buildNativeGuiForHost/);
  assert.match(source, /host !== '127\.0\.0\.1'/);
  assert.match(source, /crypto\.timingSafeEqual/);
});
