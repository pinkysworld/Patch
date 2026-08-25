import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CI_WORKFLOW = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function findChrome() {
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium']
    : process.platform === 'win32'
      ? [
          path.join(process.env['PROGRAMFILES'] ?? 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe')
        ]
      : ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
  return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
}

async function listenPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function launchChrome(chrome, debugPort, profile) {
  const stderr = { text: '' };
  const args = [
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'
  ];
  const child = spawn(chrome, args, { stdio: ['ignore','ignore','pipe'] });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr.text += chunk; });
  return { child, stderr };
}

function stopChrome(child) {
  if (!child || child.killed) return;
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
}

function stopChromeAndCleanup(child, profile) {
  stopChrome(child);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
}

async function fetchJson(url, timeout = 800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

async function waitForDevTools(child, stderr, debugPort) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Chrome exited before DevTools became ready (${child.exitCode}). ${stderr.text}`);
    try {
      const version = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`, 250);
      if (version.webSocketDebuggerUrl) return { port: debugPort, browserWsUrl: version.webSocketDebuggerUrl };
    } catch { /* retry */ }
    await delay(100);
  }
  throw new Error(`Chrome DevTools did not become ready. ${stderr.text}`);
}

async function waitForPageTarget(port, expectedUrl, stderr) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetchJson(`http://127.0.0.1:${port}/json/list`, 250);
      const target = pages.find(item => item.type === 'page' && item.webSocketDebuggerUrl && item.url.startsWith(expectedUrl.split('?')[0]));
      if (target) return target;
    } catch { /* retry */ }
    await delay(100);
  }
  throw new Error(`Patch Studio page target did not appear. ${stderr.text}`);
}

function connectCdp(url) {
  const WebSocket = globalThis.WebSocket ?? require('ws');
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({ command, close: () => socket.close() }), { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
}

async function evaluate(cdp, expression) {
  const response = await cdp.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || 'Chrome evaluation failed');
  return response.result?.value;
}

async function waitForSmokeReady(cdp) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await evaluate(cdp, `(() => {
      const run = document.querySelector('#run');
      const code = document.querySelector('#code');
      if (!run || !code) return 'loading';
      if (document.documentElement?.dataset?.patchStudioStartup === 'failed') return 'failed';
      run.click();
      const app = document.querySelector('#app');
      if (app && !app.hidden && app.querySelector('.patch-window')) return 'ready';
      return 'waiting';
    })()`);
    if (state === 'ready' || state === 'failed') return state;
    await delay(120);
  }
  return 'timeout';
}

function withSmokeQuery(url) {
  const target = new URL(url);
  target.searchParams.set('patch-smoke', String(Date.now()));
  return target.toString();
}

async function localStudioUrl(t) {
  const root = process.cwd();
  const server = http.createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/' || pathname.endsWith('/Patch/')) pathname += 'index.html';
      if (pathname.startsWith('/Patch/')) pathname = pathname.slice('/Patch/'.length);
      else pathname = pathname.replace(/^\//, '');
      const file = path.resolve(root, 'web', pathname);
      const webRoot = path.resolve(root, 'web') + path.sep;
      const srcRoot = path.resolve(root, 'src') + path.sep;
      let actual = file;
      if (pathname.startsWith('src/')) actual = path.resolve(root, pathname);
      if (!actual.startsWith(webRoot) && !actual.startsWith(srcRoot)) throw new Error('outside web root');
      const content = fs.readFileSync(actual);
      const ext = path.extname(actual);
      const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(content);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => server.close());
  const address = server.address();
  return `http://127.0.0.1:${address.port}/index.html?patch-smoke=${Date.now()}`;
}

test('Studio browser startup gate probes macOS and Windows Chrome locations', () => {
  const source = fs.readFileSync(new URL(import.meta.url), 'utf8');
  assert.match(source, /Google Chrome\.app/);
  assert.match(source, /PROGRAMFILES/);
  assert.match(source, /google-chrome/);
});

test('full CI suite isolates Chrome smoke so a hung browser cannot pin the 12-minute job', () => {
  const runner = fs.readFileSync('scripts/run-tests-ci.js', 'utf8');
  const ci = CI_WORKFLOW;
  assert.doesNotMatch(runner, /studio-browser-startup\.test\.js/);
  assert.match(runner, /stays responsive in Chrome/);
  assert.match(ci, /Studio Chrome startup smoke/);
  assert.match(ci, /timeout-minutes: 2/);
  assert.match(ci, /tests\/studio-browser-startup\.test\.js/);
});

test('Patch Studio stays responsive in Chrome, runs a Window app and exercises current IDE navigation/layout', { timeout: 45000 }, async t => {
  const chrome = findChrome();
  if (!chrome) {
    if (process.env.CI) assert.fail('Chrome/Chromium is required for the Patch Studio browser startup gate');
    t.skip('Chrome/Chromium is not installed locally');
    return;
  }

  const externalUrl = process.env.PATCH_STUDIO_SMOKE_URL?.trim();
  const url = externalUrl ? withSmokeQuery(externalUrl) : await localStudioUrl(t);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-studio-chrome-'));
  const debugPort = await listenPort();
  const { child, stderr } = launchChrome(chrome, debugPort, profile);
  t.after(() => stopChromeAndCleanup(child, profile));
  const watchdog = setTimeout(() => { stopChrome(child); }, 35000);
  t.after(() => clearTimeout(watchdog));

  let devtools;
  try {
    devtools = await waitForDevTools(child, stderr, debugPort);
  } catch (error) {
    await stopChrome(child);
    throw error;
  }

  const existing = await fetchJson(`http://127.0.0.1:${devtools.port}/json/list`, 400);
  const blankPage = Array.isArray(existing)
    ? existing.find(item => item.type === 'page' && item.webSocketDebuggerUrl)
    : null;
  if (blankPage) {
    const pageCdp = await connectCdp(blankPage.webSocketDebuggerUrl);
    t.after(() => pageCdp.close());
    await pageCdp.command('Page.enable');
    await pageCdp.command('Page.navigate', { url });
  } else {
    const browserCdp = await connectCdp(devtools.browserWsUrl);
    t.after(() => browserCdp.close());
    await browserCdp.command('Target.createTarget', { url });
  }

  const target = await waitForPageTarget(devtools.port, url, stderr);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  t.after(() => cdp.close());
  await cdp.command('Runtime.enable');

  const smokeState = await waitForSmokeReady(cdp);
  assert.equal(smokeState, 'ready', `Studio did not reach the responsive Run state at ${url}. stderr:\n${stderr.text}`);
  assert.equal(await evaluate(cdp, "!!document.querySelector('#app') && !document.querySelector('#app').hidden && !!document.querySelector('#app .patch-window')"), true,
    'Run smoke probe did not render the default Patch Window app');

  await delay(2500);
  assert.equal(await evaluate(cdp, "document.documentElement?.dataset?.patchStudioSmoke === 'ready' && !!document.querySelector('#run')"), true,
    `Patch Studio stopped responding after its initial render at ${url}`);

  assert.equal(await evaluate(cdp, `(() => {
    const trigger = document.querySelector('#openCommandPalette');
    trigger?.click();
    return Boolean(document.querySelector('#commandPalette')?.open);
  })()`), true, 'Command Palette did not open in Chrome');

  const recoveryMatch = await evaluate(cdp, `(() => {
    const input = document.querySelector('#commandPaletteInput');
    if (!input) return null;
    input.value = 'recovery';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const items = [...document.querySelectorAll('#commandPaletteList .command-palette-item')];
    return {
      count: items.length,
      entries: items.map(item => ({
        text: item.textContent ?? '',
        label: item.querySelector('strong')?.textContent ?? '',
        kind: item.querySelector('.command-palette-kind')?.textContent ?? ''
      }))
    };
  })()`);
  assert.ok((recoveryMatch?.count ?? 0) >= 1, 'Command Palette filtering should expose a Recovery command');
  assert.ok(recoveryMatch?.entries?.some(entry => entry.label === 'Open Recovery' && entry.kind === 'Command'),
    `Command Palette should include the canonical Open Recovery command; got ${JSON.stringify(recoveryMatch?.entries ?? [])}`);

  const fileMatch = await evaluate(cdp, `(() => {
    const input = document.querySelector('#commandPaletteInput');
    if (!input) return null;
    input.value = 'file main.patch';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const items = [...document.querySelectorAll('#commandPaletteList .command-palette-item')];
    return { count: items.length, text: items[0]?.textContent ?? '', kind: items[0]?.querySelector('.command-palette-kind')?.textContent ?? '' };
  })()`);
  assert.equal(fileMatch?.count, 1, 'Quick-open should isolate the canonical main.patch file result');
  assert.match(fileMatch?.text ?? '', /main\.patch/);
  assert.equal(fileMatch?.kind, 'File');

  const symbolMatch = await evaluate(cdp, `(() => {
    const input = document.querySelector('#commandPaletteInput');
    if (!input) return null;
    input.value = 'counter form';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const items = [...document.querySelectorAll('#commandPaletteList .command-palette-item')];
    return { count: items.length, text: items[0]?.textContent ?? '', kind: items[0]?.querySelector('.command-palette-kind')?.textContent ?? '' };
  })()`);
  assert.equal(symbolMatch?.count, 1, 'Quick-open should isolate the Counter Form result');
  assert.match(symbolMatch?.text ?? '', /Counter/);
  assert.equal(symbolMatch?.kind, 'Form');

  const layout = await evaluate(cdp, `(() => {
    const source = document.querySelector('.source-workspace');
    const result = document.querySelector('.result-pane');
    const workspace = document.querySelector('.workspace');
    const splitter = document.querySelector('#workspaceSplitHandle');
    const sourceRect = source?.getBoundingClientRect();
    const resultRect = result?.getBoundingClientRect();
    const workspaceRect = workspace?.getBoundingClientRect();
    return {
      sourceWidth: sourceRect?.width ?? 0,
      resultWidth: resultRect?.width ?? 0,
      workspaceWidth: workspaceRect?.width ?? 0,
      resultTop: resultRect?.top ?? 0,
      sourceBottom: sourceRect?.bottom ?? 0,
      splitter: Boolean(splitter)
    };
  })()`);
  assert.ok(layout.sourceWidth > 0 && layout.resultWidth > 0, 'Studio source and result workspaces should both be visible');
  assert.ok(Math.abs(layout.sourceWidth - layout.workspaceWidth) < 4, 'source workspace should span the full Studio width');
  assert.ok(Math.abs(layout.resultWidth - layout.workspaceWidth) < 4, 'result workspace should span the full Studio width');
  assert.ok(layout.resultTop >= layout.sourceBottom - 2, 'result workspace should be below the editor workspace');
  assert.equal(layout.splitter, false, 'legacy side-by-side workspace splitter should not be present');
});
