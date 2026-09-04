#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { getAsset } = require('node:sea');

const manifest = JSON.parse(getAsset('offline-studio-manifest.json', 'utf8'));
if (manifest?.format !== 'patch-offline-studio-manifest' || !Array.isArray(manifest.files)) {
  throw new Error('Patch Offline Studio embedded manifest is invalid.');
}

const { createOfflineStudioBuildBridge } = loadEmbeddedBridge();
const embeddedCompiler = readOptionalAsset(manifest.localBuild?.compilerAsset);
const bridge = createOfflineStudioBuildBridge({
  platform: manifest.localBuild?.platform ?? process.platform,
  arch: manifest.localBuild?.arch ?? process.arch,
  compilerBytes: embeddedCompiler,
  compilerSha256: manifest.localBuild?.compilerSha256 ?? ''
});

const files = new Map(manifest.files.map(entry => [entry.path, entry]));
const session = crypto.randomBytes(18).toString('hex');
const prefix = `/${session}/`;
const smokeMode = process.env.PATCH_OFFLINE_STUDIO_SMOKE === '1';
const noOpen = smokeMode || process.env.PATCH_OFFLINE_STUDIO_NO_OPEN === '1';
let localOrigin = null;

const server = http.createServer((request, response) => {
  if (bridge.route(request, response, { prefix, securityHeaders, origin: localOrigin })) return;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { ...securityHeaders(), Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const rawPath = String(request.url ?? '/').split('?', 1)[0];
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
  if (relative.includes('..') || relative.includes('\\') || relative.startsWith('/')) {
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

  const body = Buffer.from(getAsset(`site/${relative}`));
  response.writeHead(200, headers);
  if (request.method === 'HEAD') response.end();
  else response.end(body);
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(0, '127.0.0.1', async () => {
  const address = server.address();
  localOrigin = `http://127.0.0.1:${address.port}`;
  const url = `${localOrigin}${prefix}`;
  const capability = bridge.capability();
  console.log(`Patch Offline Studio ${manifest.patchVersion ?? ''}`.trim());
  console.log(`Local IDE: ${url}`);
  console.log('Network access is not required; the IDE is served only on this machine.');
  console.log(capability.supported
    ? `Local native build: ${capability.platform}/${capability.arch} via bundled offline compiler (${capability.compilerSha256?.slice(0, 12) ?? 'unhashed'}…).`
    : `Local native build: unavailable in this package (${capability.reason}).`);

  if (smokeMode) {
    try {
      await runSelfSmoke(url);
      console.log('Offline Studio executable smoke: OK');
      bridge.dispose();
      server.close(() => process.exit(0));
    } catch (error) {
      console.error(`Offline Studio executable smoke failed: ${error?.message ?? error}`);
      bridge.dispose();
      server.close(() => process.exit(2));
    }
    return;
  }

  if (!noOpen && !openBrowser(url)) console.log('Open the Local IDE URL above in a browser.');
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  bridge.dispose();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

async function runSelfSmoke(url) {
  const index = await getLocal(url);
  if (index.statusCode !== 200) throw new Error(`expected HTTP 200, received ${index.statusCode}`);
  if (!/Patch Studio/i.test(index.body)) throw new Error('embedded index.html did not contain the Patch Studio marker');
  if (!String(index.headers['content-security-policy'] ?? '').includes("connect-src 'self'")) {
    throw new Error('offline CSP did not retain the local-only connect-src policy');
  }
  const sessionResponse = await getLocal(new URL('__patch/session', url).toString());
  if (sessionResponse.statusCode !== 200) throw new Error(`local bridge session endpoint returned ${sessionResponse.statusCode}`);
  const sessionPayload = JSON.parse(sessionResponse.body);
  if (sessionPayload?.nativeBuild?.contract !== 'patch-offline-studio-build-bridge/0.1' || !sessionPayload?.token) {
    throw new Error('local bridge session contract is missing');
  }
}

function getLocal(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 5000 }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    request.on('timeout', () => request.destroy(new Error('self-smoke timed out')));
    request.on('error', reject);
  });
}

function loadEmbeddedBridge() {
  const source = getAsset('offline-studio-build-bridge.cjs', 'utf8');
  const module = { exports: {} };
  const factory = new Function('require', 'module', 'exports', `'use strict';\n${source}\n//# sourceURL=offline-studio-build-bridge.cjs`);
  factory(require, module, module.exports);
  return module.exports;
}

function readOptionalAsset(key) {
  if (!key) return null;
  try { return Buffer.from(getAsset(String(key))); }
  catch { return null; }
}

function openBrowser(url) {
  try {
    let child;
    if (process.platform === 'win32') {
      child = spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
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
