#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = __dirname;
const siteRoot = path.join(root, 'site');
const manifestPath = path.join(root, 'offline-studio-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest?.format !== 'patch-offline-studio-manifest' || !Array.isArray(manifest.files)) {
  throw new Error('Patch Offline Studio portable manifest is invalid.');
}

const files = new Map(manifest.files.map(entry => [entry.path, entry]));
const verified = new Map();
const session = crypto.randomBytes(18).toString('hex');
const prefix = `/${session}/`;
const smokeMode = process.env.PATCH_OFFLINE_STUDIO_SMOKE === '1';
const noOpen = smokeMode || process.env.PATCH_OFFLINE_STUDIO_NO_OPEN === '1';

const server = http.createServer((request, response) => {
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
  const url = `http://127.0.0.1:${address.port}${prefix}`;
  console.log(`Patch Offline Studio Portable ${manifest.patchVersion ?? ''}`.trim());
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Local IDE: ${url}`);
  console.log('Network access is not required; the IDE is served only on this machine.');

  if (smokeMode) {
    try {
      await runSelfSmoke(url);
      console.log('Offline Studio portable smoke: OK');
      server.close(() => process.exit(0));
    } catch (error) {
      console.error(`Offline Studio portable smoke failed: ${error?.message ?? error}`);
      server.close(() => process.exit(2));
    }
    return;
  }

  if (!noOpen && !openBrowser(url)) {
    console.log('No supported desktop opener was found. Open the Local IDE URL above in a browser.');
  }
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
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

function runSelfSmoke(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 5000 }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode !== 200) return reject(new Error(`expected HTTP 200, received ${response.statusCode}`));
        if (!/Patch Studio/i.test(body)) return reject(new Error('portable index.html did not contain the Patch Studio marker'));
        if (!String(response.headers['content-security-policy'] ?? '').includes("connect-src 'self'")) {
          return reject(new Error('portable CSP did not retain the local-only connect-src policy'));
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
    for (const [command, args] of candidates) {
      if (!findExecutable(command)) continue;
      if (launch(command, args)) return true;
    }
  } catch {}
  return false;
}

function launch(command, args, extra = {}) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', ...extra });
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
