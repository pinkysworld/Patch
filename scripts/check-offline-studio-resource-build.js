#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import compilerBuilderModule from './offline-studio-compiler-builder.cjs';
import {
  OFFLINE_BUILD_BRIDGE_PROTOCOL,
  OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
  startOfflineBuildBridge
} from '../src/offline-studio-build-bridge.js';

const compiler = process.env.PATCH_OFFLINE_STUDIO_COMPILER
  ? path.resolve(process.env.PATCH_OFFLINE_STUDIO_COMPILER)
  : null;
if (!compiler) {
  console.log('Offline Studio resource smoke: compiler not packaged for this host; skipped.');
  process.exit(0);
}
if (!fs.existsSync(compiler) || !fs.statSync(compiler).isFile()) fail(`compiler is missing: ${compiler}`);

const { createOfflineStudioCompilerBuilder } = compilerBuilderModule;
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-studio-resource-smoke-'));
const token = 'resource-smoke-token-0123456789abcdef';
const origin = 'http://127.0.0.1:41091';
const compilerSha256 = sha256(fs.readFileSync(compiler));
const builder = createOfflineStudioCompilerBuilder({
  platform: process.platform,
  arch: process.arch,
  compilerPath: compiler,
  compilerSha256
});

let bridge;
try {
  bridge = await startOfflineBuildBridge({
    workspaceRoot: workspace,
    token,
    allowedOrigin: origin,
    builder,
    platform: process.platform
  });
  await smokeResourceProject();
  console.log('Offline Studio resource-backed installed build smoke: OK');
} finally {
  if (bridge) await bridge.close();
  fs.rmSync(workspace, { recursive: true, force: true });
}

async function smokeResourceProject() {
  const requestId = `resource-${Date.now().toString(36)}`;
  const project = resourceProject();
  const snapshotResponse = await fetch(`${bridge.origin}${bridge.snapshotPath}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      protocol: OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
      requestId,
      project
    })
  });
  const snapshot = await json(snapshotResponse, 'project snapshot');
  if (!snapshot.ok || snapshot.kind !== 'project') fail('project snapshot did not use project-v4 mode');
  if (!snapshot.source?.endsWith('/project.patchproject')) fail(`unexpected project snapshot path: ${snapshot.source}`);
  if (snapshot.sourceFileCount !== 1 || snapshot.resourceCount !== 2) {
    fail(`unexpected project snapshot counts: ${snapshot.sourceFileCount} files, ${snapshot.resourceCount} resources`);
  }
  if (!/^[0-9a-f]{64}$/.test(snapshot.sha256)) fail('project snapshot SHA-256 is missing');

  const buildResponse = await fetch(`${bridge.origin}${bridge.path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      protocol: OFFLINE_BUILD_BRIDGE_PROTOCOL,
      action: 'build-native-window',
      requestId,
      source: snapshot.source,
      appName: 'ResourceSmoke'
    })
  });
  const built = await json(buildResponse, 'native resource build');
  if (!built.ok || !built.artifact?.downloadPath || !/^[0-9a-f]{64}$/.test(built.artifact.sha256)) {
    fail('resource-backed native build did not return a verified artifact');
  }

  const artifactResponse = await fetch(`${bridge.origin}${built.artifact.downloadPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin
    }
  });
  if (!artifactResponse.ok) fail(`resource-backed artifact download returned HTTP ${artifactResponse.status}`);
  const bytes = Buffer.from(await artifactResponse.arrayBuffer());
  if (!bytes.length) fail('resource-backed artifact is empty');
  if (sha256(bytes) !== built.artifact.sha256) fail('resource-backed artifact SHA-256 does not match bridge metadata');
}

function resourceProject() {
  const buttonPng = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';
  const appIconPng = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAG40lEQVR4Ae3WQQ0AIBAEsROBbCTiBYKO6QMD7GXSWftczx+4geYNjOGbw9vd7v8GBICACDB8AwIQHp8CKEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACOABYkQlNm0HpoMAAAAASUVORK5CYII=';
  const resource = (id, file, data) => {
    const bytes = Buffer.from(data, 'base64');
    return {
      id,
      path: `resources/${file}`,
      mediaType: 'image/png',
      size: bytes.length,
      sha256: sha256(bytes),
      data
    };
  };
  const target = process.platform === 'win32' ? 'native-windows'
    : process.platform === 'darwin' ? 'native-macos'
      : 'native-linux';
  return {
    format: 'patch-studio-project',
    version: 4,
    project: {
      name: 'ResourceSmoke',
      kind: 'window',
      entry: 'main.patch',
      build: { target, nativeMode: 'local' }
    },
    files: [{
      path: 'main.patch',
      content: `window "Resource Smoke" as main size 420, 220 icon "patch-resource:app.icon":\n  imagelist as images size 16, 16:\n    image open from "patch-resource:icons.open"\n  button "Open" as open_button image images.open at 24, 32 size 140, 40\n`
    }],
    resources: [
      resource('app.icon', 'app.png', appIconPng),
      resource('icons.open', 'open.png', buttonPng)
    ]
  };
}

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Origin: origin
  };
}

async function json(response, label) {
  let value;
  try { value = await response.json(); }
  catch { fail(`${label} returned non-JSON HTTP ${response.status}`); }
  if (!response.ok) fail(`${label} failed with HTTP ${response.status}: ${value?.message || value?.error || 'unknown error'}`);
  return value;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function fail(message) {
  console.error(`Offline Studio resource smoke: ${message}`);
  process.exit(2);
}
