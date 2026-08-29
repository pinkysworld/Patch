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

const files = new Map(manifest.files.map(entry => [entry.path, entry]));
const session = crypto.randomBytes(18).toString('hex');
const prefix = `/${session}/`;
const smokeMode = process.env.PATCH_OFFLINE_STUDIO_SMOKE === '1';
const noOpen = smokeMode || process.env.PATCH_OFFLINE_STUDIO_NO_OPEN === '1';

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const rawPath = String(request.url ?? '/').split('?', 1)[0];
  if (rawPath === `/${session}`) {
    response.writeHead(302, { Location: prefix });
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
  const url = `http://127.0.0.1:${address.port}${prefix}`;
  console.log(`Patch Offline Studio ${manifest.patchVersion ?? ''}`.trim());
  console.log(`Local IDE: ${url}`);
  console.log('Network access is not required; the IDE is served only on this machine.');

  if (smokeMode) {
    try {
      await runSelfSmoke(url);
      console.log('Offline Studio executable smoke: OK');
      server.close(() => process.exit(0));
    } catch (error) {
      console.error(`Offline Studio executable smoke failed: ${error?.message ?? error}`);
      server.close(() => process.exit(2));
    }
    return;
  }

  if (!noOpen && !openBrowser(url)) console.log('Open the Local IDE URL above in a browser.');
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

function runSelfSmoke(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 5000 }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode !== 200) {
          reject(new Error(`expected HTTP 200, received ${response.statusCode}`));
          return;
        }
        if (!/Patch Studio/i.test(body)) {
          reject(new Error('embedded index.html did not contain the Patch Studio marker'));
          return;
        }
        if (!String(response.headers['content-security-policy'] ?? '').includes("connect-src 'self'")) {
          reject(new Error('offline CSP did not retain the local-only connect-src policy'));
          return;
        }
        resolve();
      });
    });
    request.on('timeout', () => request.destroy(new Error('self-smoke timed out')));
    request.on('error', reject);
  });
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
