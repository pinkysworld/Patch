#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const out = path.resolve(args.out ?? 'dist-offline-ide/patch-studio-offline');
const site = path.join(out, 'site');
const runtimeSource = args.runtimeDir ? path.resolve(args.runtimeDir) : null;

if (!args.skipSiteBuild) run(process.execPath, ['scripts/build-site.js']);
const builtSite = path.resolve(args.siteDir ?? '_site');
if (!fs.existsSync(path.join(builtSite, 'index.html'))) {
  throw new Error(`Patch Studio site was not found at ${builtSite}. Run npm run build:site first or omit --skip-site-build.`);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(builtSite, site, { recursive: true });

if (runtimeSource && fs.existsSync(runtimeSource)) {
  fs.mkdirSync(path.join(site, 'runtimes'), { recursive: true });
  fs.cpSync(runtimeSource, path.join(site, 'runtimes'), { recursive: true });
}

fs.writeFileSync(path.join(out, 'serve-offline.cjs'), serverSource(), 'utf8');
fs.writeFileSync(path.join(out, 'Patch Studio.cmd'), windowsLauncher(), 'utf8');
fs.writeFileSync(path.join(out, 'patch-studio'), unixLauncher(), 'utf8');
fs.chmodSync(path.join(out, 'patch-studio'), 0o755);
fs.writeFileSync(path.join(out, 'README.txt'), readme(Boolean(runtimeSource)), 'utf8');

validateBundle(out);
console.log(`Patch Studio offline IDE ready: ${path.relative(root, out) || out}`);

function parseArgs(values) {
  const result = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === '--out') result.out = requireValue(values, ++i, value);
    else if (value === '--site-dir') result.siteDir = requireValue(values, ++i, value);
    else if (value === '--runtime-dir') result.runtimeDir = requireValue(values, ++i, value);
    else if (value === '--skip-site-build') result.skipSiteBuild = true;
    else throw new Error(`Unknown offline IDE option '${value}'.`);
  }
  return result;
}

function requireValue(values, index, option) {
  if (!values[index]) throw new Error(`${option} requires a value.`);
  return values[index];
}

function run(command, values) {
  const result = spawnSync(command, values, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${values.join(' ')} failed with exit code ${result.status}.`);
}

function serverSource() {
  return String.raw`'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, 'site');
const host = '127.0.0.1';
const requestedPort = Number(process.env.PATCH_STUDIO_PORT || 0);
const mime = new Map([
  ['.html','text/html; charset=utf-8'], ['.js','text/javascript; charset=utf-8'],
  ['.css','text/css; charset=utf-8'], ['.json','application/json; charset=utf-8'],
  ['.webmanifest','application/manifest+json; charset=utf-8'], ['.svg','image/svg+xml'],
  ['.png','image/png'], ['.jpg','image/jpeg'], ['.jpeg','image/jpeg'], ['.wasm','application/wasm'],
  ['.zip','application/zip'], ['.bin','application/octet-stream'], ['.exe','application/vnd.microsoft.portable-executable']
]);

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) return send(res, 403, 'Forbidden');
    let file = target;
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');
    res.statusCode = 200;
    res.setHeader('Content-Type', mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    send(res, 500, error && error.message ? error.message : String(error));
  }
});

server.listen({ host, port: requestedPort }, () => {
  const address = server.address();
  const url = 'http://' + host + ':' + address.port + '/';
  console.log('Patch Studio offline IDE: ' + url);
  console.log('Press Ctrl+C to stop the local IDE server.');
  if (process.env.PATCH_STUDIO_NO_OPEN === '1') return;
  const platform = process.platform;
  const command = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
  } catch {}
});

function send(res, status, text) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}
`;
}

function windowsLauncher() {
  return String.raw`@echo off
setlocal
set "ROOT=%~dp0"
if exist "%ROOT%runtime\node.exe" (
  "%ROOT%runtime\node.exe" "%ROOT%serve-offline.cjs"
) else (
  node "%ROOT%serve-offline.cjs"
)
if errorlevel 1 (
  echo.
  echo Patch Studio needs Node.js 22+ when a bundled runtime is not present.
  pause
)
`;
}

function unixLauncher() {
  return String.raw`#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -x "$ROOT/runtime/node" ]; then
  exec "$ROOT/runtime/node" "$ROOT/serve-offline.cjs"
fi
exec node "$ROOT/serve-offline.cjs"
`;
}

function readme(hasRuntimeDir) {
  return `Patch Studio Offline IDE\n\nThis bundle runs Patch Studio from localhost and does not need the public website after download.\nProjects, recovery data and diagnostics remain local to the browser profile unless you explicitly export or build.\n\nStart:\n  Windows: double-click Patch Studio.cmd\n  macOS/Linux: run ./patch-studio\n\nThe launcher prefers runtime/node(.exe) when a platform package includes it, otherwise Node.js 22+ must be installed.\n${hasRuntimeDir ? 'Native runtime templates were included in site/runtimes for token-free desktop builds.\n' : 'This developer bundle does not contain downloaded native runtime templates unless --runtime-dir was supplied.\n'}\nNo Electron or bundled Chromium is required. The IDE uses your installed browser through a local loopback server so ES modules, the service worker and browser security rules behave the same as the hosted Studio.\n`;
}

function validateBundle(directory) {
  for (const relative of ['site/index.html', 'site/native-build.js', 'site/sw.js', 'serve-offline.cjs', 'Patch Studio.cmd', 'patch-studio']) {
    const file = path.join(directory, relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Offline IDE bundle is missing ${relative}.`);
  }
  const html = fs.readFileSync(path.join(directory, 'site/index.html'), 'utf8');
  if (!html.includes('Patch Studio')) throw new Error('Offline IDE did not include the Patch Studio shell.');
}
