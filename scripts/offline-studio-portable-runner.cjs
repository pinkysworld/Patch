#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const bridgeCore = require('./offline-studio-build-bridge-core.cjs');
const { createOfflineStudioCompilerBuilder } = require('./offline-studio-compiler-builder.cjs');

const root = __dirname;
const siteRoot = path.join(root, 'site');
const manifestPath = path.join(root, 'offline-studio-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest?.format !== 'patch-offline-studio-manifest' || !Array.isArray(manifest.files)) {
  throw new Error('Patch Offline Studio portable manifest is invalid.');
}

const files = new Map(manifest.files.map(entry => [entry.path, entry]));
const verified = new Map();
const args = process.argv.slice(2);
const workspaceArg = option(args, '--workspace');
const session = crypto.randomBytes(18).toString('hex');
const prefix = `/${session}/`;
const smokeMode = process.env.PATCH_OFFLINE_STUDIO_SMOKE === '1';
const noOpen = smokeMode || process.env.PATCH_OFFLINE_STUDIO_NO_OPEN === '1';
let localOrigin = null;
let localBuildBridge = null;
let localBuildSession = Object.freeze({
  available: false,
  reason: workspaceArg
    ? 'This Offline Studio package does not contain a matching host-native Patch offline compiler.'
    : 'Start Patch Studio with --workspace <directory> to authorize installed host-native builds.'
});

const server = http.createServer((request, response) => {
  const rawPath = String(request.url ?? '/').split('?', 1)[0];

  if (rawPath === `${prefix}__patch/session`) {
    if (request.method !== 'GET') {
      response.writeHead(405, { ...securityHeaders(), Allow: 'GET' });
      response.end();
      return;
    }
    const body = Buffer.from(`${JSON.stringify({
      format: 'patch-offline-studio-session',
      version: 1,
      localBuild: localBuildSession
    })}\n`, 'utf8');
    response.writeHead(200, {
      ...securityHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(body.length),
      'Cache-Control': 'no-store'
    });
    response.end(body);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { ...securityHeaders(), Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  if (rawPath === `/${session}`) {
    response.writeHead(302, { ...securityHeaders(), Location: prefix });
    response.end();
    return;
  }
  if (!rawPath.startsWith(prefix)) {
    response.writeHead(404, securityHeaders());
    response.end('Not found');
    return;
  }

  let relative;
  try {
    relative = decodeURIComponent(rawPath.slice(prefix.length));
  } catch {
    response.writeHead(400, securityHeaders());
    response.end('Bad request');
    return;
  }
  if (!relative) relative = manifest.entrypoint ?? 'index.html';
  if (!isSafeRelativePath(relative)) {
    response.writeHead(400, securityHeaders());
    response.end('Bad request');
    return;
  }

  const entry = files.get(relative);
  if (!entry) {
    response.writeHead(404, securityHeaders());
    response.end('Not found');
    return;
  }

  let body;
  try {
    body = verifiedAsset(relative, entry);
  } catch (error) {
    console.error(`Offline Studio asset verification failed for ${relative}: ${error?.message ?? error}`);
    response.writeHead(500, securityHeaders());
    response.end('Local IDE asset verification failed');
    return;
  }

  const headers = {
    ...securityHeaders(),
    'Content-Type': mimeType(relative),
    'Content-Length': String(entry.size),
    'Cache-Control': relative === 'sw.js' ? 'no-cache' : 'private, max-age=31536000, immutable',
    ETag: `"${entry.sha256}"`
  };
  if (request.headers['if-none-match'] === headers.ETag) {
    response.writeHead(304, headers);
    response.end();
    return;
  }

  response.writeHead(200, headers);
  if (request.method === 'HEAD') response.end();
  else response.end(body);
});

server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));

server.listen(0, '127.0.0.1', async () => {
  const address = server.address();
  localOrigin = `http://127.0.0.1:${address.port}`;
  const url = `${localOrigin}${prefix}`;

  try {
    await startLocalBuildBridge();
  } catch (error) {
    console.error(`Offline Studio installed host build disabled: ${error?.message ?? error}`);
    localBuildSession = Object.freeze({ available: false, reason: error?.message ?? String(error) });
  }

  console.log(`Patch Offline Studio Portable ${manifest.patchVersion ?? ''}`.trim());
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Local IDE: ${url}`);
  console.log('Network access is not required; the IDE is served only on this machine.');
  console.log(localBuildSession.available
    ? `Installed host build: ${localBuildSession.platform}/${localBuildSession.arch} workspace '${localBuildSession.workspaceName}'.`
    : `Installed host build: unavailable (${localBuildSession.reason}).`);

  if (smokeMode) {
    try {
      await runSelfSmoke(url);
      console.log('Offline Studio portable smoke: OK');
      await shutdownBridge();
      server.close(() => process.exit(0));
    } catch (error) {
      console.error(`Offline Studio portable smoke failed: ${error?.message ?? error}`);
      await shutdownBridge();
      server.close(() => process.exit(2));
    }
    return;
  }

  if (!noOpen && !openBrowser(url)) {
    console.log('No supported desktop opener was found. Open the Local IDE URL above in a browser.');
  }
});

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

async function startLocalBuildBridge() {
  if (!workspaceArg || !manifest.localBuild) return;
  const hostPlatform = normalizePlatform(process.platform);
  if (manifest.localBuild.platform !== hostPlatform || manifest.localBuild.arch !== process.arch) {
    throw new Error(`Packaged compiler targets ${manifest.localBuild.platform}/${manifest.localBuild.arch}, not this ${hostPlatform}/${process.arch} host.`);
  }
  const workspaceRoot = bridgeCore.resolveOpenedWorkspace(workspaceArg);
  const compilerPath = path.resolve(root, ...String(manifest.localBuild.compilerFile).split('/'));
  const builder = createOfflineStudioCompilerBuilder({
    platform: process.platform,
    arch: process.arch,
    compilerPath,
    compilerSha256: manifest.localBuild.compilerSha256
  });
  const token = crypto.randomBytes(32).toString('hex');
  localBuildBridge = await bridgeCore.startOfflineBuildBridge({
    workspaceRoot,
    token,
    allowedOrigin: localOrigin,
    builder,
    platform: process.platform
  });
  localBuildSession = Object.freeze({
    available: true,
    origin: localBuildBridge.origin,
    token,
    buildPath: bridgeCore.OFFLINE_BUILD_BRIDGE_PATH,
    snapshotPath: bridgeCore.OFFLINE_WORKSPACE_SNAPSHOT_PATH,
    bridgeProtocol: bridgeCore.OFFLINE_BUILD_BRIDGE_PROTOCOL,
    snapshotProtocol: bridgeCore.OFFLINE_WORKSPACE_SNAPSHOT_PROTOCOL,
    platform: hostPlatform,
    arch: process.arch,
    workspaceName: path.basename(workspaceRoot),
    compilerSha256: manifest.localBuild.compilerSha256
  });
}

function verifiedAsset(relative, entry) {
  if (verified.has(relative)) return verified.get(relative);
  const absolute = path.resolve(siteRoot, ...relative.split('/'));
  const rootPrefix = `${path.resolve(siteRoot)}${path.sep}`;
  if (absolute !== path.resolve(siteRoot) && !absolute.startsWith(rootPrefix)) throw new Error('asset escaped site root');
  const body = fs.readFileSync(absolute);
  if (body.length !== entry.size) throw new Error(`size mismatch: expected ${entry.size}, received ${body.length}`);
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  if (sha256 !== entry.sha256) throw new Error(`sha256 mismatch: expected ${entry.sha256}, received ${sha256}`);
  verified.set(relative, body);
  return body;
}

function isSafeRelativePath(relative) {
  if (!relative || relative.startsWith('/') || relative.includes('\\')) return false;
  const segments = relative.split('/');
  return segments.every(segment => segment && segment !== '.' && segment !== '..');
}

async function runSelfSmoke(url) {
  const index = await requestLocal(url);
  if (index.statusCode !== 200) throw new Error(`expected HTTP 200, received ${index.statusCode}`);
  if (!/Patch Studio/i.test(index.body)) throw new Error('portable index.html did not contain the Patch Studio marker');
  if (!String(index.headers['content-security-policy'] ?? '').includes("connect-src 'self'")) {
    throw new Error('portable CSP did not retain the local-only connect-src policy');
  }
  const sessionResponse = await requestLocal(new URL('__patch/session', url).toString());
  if (sessionResponse.statusCode !== 200) throw new Error(`session endpoint returned ${sessionResponse.statusCode}`);
  const sessionPayload = JSON.parse(sessionResponse.body);
  if (sessionPayload?.format !== 'patch-offline-studio-session') throw new Error('portable session endpoint contract is invalid');
  if (process.env.PATCH_OFFLINE_STUDIO_EXPECT_LOCAL_BUILD === '1') {
    if (!sessionPayload?.localBuild?.available) throw new Error(`expected installed host build capability: ${sessionPayload?.localBuild?.reason ?? 'missing'}`);
    await runLocalBuildSelfSmoke(sessionPayload.localBuild);
  }
}

async function runLocalBuildSelfSmoke(capability) {
  const requestId = `smoke-${Date.now().toString(36)}`;
  const source = 'window "Offline Smoke" size 320, 200:\n  text "Ready"\n';
  const snapshot = await bridgeJson(capability, capability.snapshotPath, {
    protocol: capability.snapshotProtocol,
    requestId,
    source
  });
  if (!snapshot.ok || !snapshot.source || !/^[a-f0-9]{64}$/.test(snapshot.sha256)) throw new Error('portable workspace snapshot smoke failed');
  const built = await bridgeJson(capability, capability.buildPath, {
    protocol: capability.bridgeProtocol,
    action: 'build-native-window',
    requestId,
    source: snapshot.source,
    appName: 'OfflineSmoke'
  });
  if (!built.ok || !built.artifact?.downloadPath || !/^[a-f0-9]{64}$/.test(built.artifact.sha256)) {
    throw new Error('portable installed native build smoke did not return a verified artifact');
  }
  const artifact = await requestLocal(new URL(built.artifact.downloadPath, capability.origin).toString(), {
    headers: { Authorization: `Bearer ${capability.token}`, Origin: localOrigin }
  });
  if (artifact.statusCode !== 200 || !artifact.buffer.length) throw new Error('portable installed native artifact download smoke failed');
  const actual = crypto.createHash('sha256').update(artifact.buffer).digest('hex');
  if (actual !== built.artifact.sha256) throw new Error('portable downloaded artifact SHA-256 did not match bridge metadata');
}

async function bridgeJson(capability, endpoint, payload) {
  const response = await requestLocal(new URL(endpoint, capability.origin).toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${capability.token}`,
      'Content-Type': 'application/json',
      Origin: localOrigin
    },
    body: Buffer.from(JSON.stringify(payload), 'utf8')
  });
  const value = JSON.parse(response.body || '{}');
  if (response.statusCode !== 200) throw new Error(value.message || value.error || `bridge HTTP ${response.statusCode}`);
  return value;
}

function requestLocal(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = http.request(target, {
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
      timeout: 15000
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ statusCode: response.statusCode, headers: response.headers, buffer, body: buffer.toString('utf8') });
      });
    });
    request.on('timeout', () => request.destroy(new Error('self-smoke timed out')));
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') return launch('cmd.exe', ['/d', '/s', '/c', 'start', '', url], { windowsHide: true });
    if (process.platform === 'darwin') return launch('open', [url]);

    const candidates = [
      ['xdg-open', [url]],
      ['gio', ['open', url]],
      ['sensible-browser', [url]],
      ['firefox', [url]],
      ['chromium', [url]],
      ['chromium-browser', [url]],
      ['google-chrome', [url]]
    ];
    for (const [command, commandArgs] of candidates) {
      if (!findExecutable(command)) continue;
      if (launch(command, commandArgs)) return true;
    }
  } catch {}
  return false;
}

function launch(command, commandArgs, extra = {}) {
  const child = spawn(command, commandArgs, { detached: true, stdio: 'ignore', ...extra });
  child.on('error', () => {});
  child.unref();
  return true;
}

function findExecutable(command) {
  const pathValue = process.env.PATH ?? '';
  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

async function shutdown() {
  await shutdownBridge();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

async function shutdownBridge() {
  if (!localBuildBridge) return;
  const bridge = localBuildBridge;
  localBuildBridge = null;
  await bridge.close();
}

function option(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a directory path.`);
  return value;
}

function securityHeaders() {
  const bridgeConnect = localBuildSession.available ? ` ${localBuildSession.origin}` : '';
  return {
    'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'${bridgeConnect}; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
}

function normalizePlatform(value) {
  if (value === 'win32') return 'windows';
  if (value === 'darwin') return 'macos';
  return String(value);
}

function mimeType(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.json') || lower.endsWith('.webmanifest')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.wasm')) return 'application/wasm';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}
