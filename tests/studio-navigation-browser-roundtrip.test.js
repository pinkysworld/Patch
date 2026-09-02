import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm']
]);

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser'
  ].filter(Boolean);
  for (const executable of candidates) {
    if (path.isAbsolute(executable)) {
      if (fs.existsSync(executable)) return executable;
      continue;
    }
    const probe = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 3000 });
    if (!probe.error && probe.status === 0) return executable;
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createStaticServer() {
  return http.createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      const relative = pathname === '/' ? 'web/index.html' : pathname.replace(/^\/+/, '');
      const filename = path.resolve(ROOT, relative);
      if (filename !== ROOT && !filename.startsWith(`${ROOT}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const stat = fs.statSync(filename);
      if (!stat.isFile()) throw new Error('not a file');
      response.writeHead(200, {
        'content-type': MIME.get(path.extname(filename)) ?? 'application/octet-stream',
        'cache-control': 'no-store'
      });
      fs.createReadStream(filename).pipe(response);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}

async function fetchJson(url, timeoutMs = 500) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function waitForDevTools(child, stderr, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = async () => {
      while (Date.now() < deadline) {
        const match = stderr.text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/[^\s]+)/);
        if (match) return resolve({ browserUrl: match[1], port: Number(match[2]) });
        if (child.exitCode !== null || child.signalCode !== null) break;
        await delay(100);
      }
      reject(new Error(`Chrome did not expose DevTools. stderr:\n${stderr.text}`));
    };
    poll();
  });
}

async function waitForPage(port, expectedUrl, timeoutMs = 10000) {
  const expected = new URL(expectedUrl);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const target = Array.isArray(targets) ? targets.find(item => {
      if (item.type !== 'page' || !item.webSocketDebuggerUrl) return false;
      try {
        const candidate = new URL(item.url);
        return candidate.origin === expected.origin && candidate.pathname === expected.pathname;
      } catch {
        return false;
      }
    }) : null;
    if (target) return target;
    await delay(100);
  }
  throw new Error('Patch Studio page was not discoverable through Chrome DevTools');
}

async function connectCdp(webSocketDebuggerUrl) {
  assert.equal(typeof WebSocket, 'function', 'Node WebSocket support is required');
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools')), 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome DevTools connection failed')); }, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  const command = (method, params = {}, timeoutMs = 4000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome stopped responding to ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { command, close: () => socket.close() };
}

async function evaluate(cdp, expression) {
  const result = await cdp.command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'unknown exception';
    throw new Error(`Chrome evaluation failed: ${detail}`);
  }
  return result.result?.value;
}

async function waitForStudio(cdp, timeoutMs = 16000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await evaluate(cdp, 'document.documentElement?.dataset?.patchStudioSmoke ?? null');
    if (state === 'ready') return;
    if (state === 'failed') throw new Error('Patch Studio smoke bootstrap reported failure');
    await delay(150);
  }
  throw new Error('Patch Studio did not become ready');
}

async function stopChrome(child, profile) {
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child) await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(1200)]);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
}

test('Designer Source Event navigation round trip stays responsive in Chrome', { timeout: 40000 }, async t => {
  const chrome = findChrome();
  if (!chrome) {
    if (process.env.CI) assert.fail('Chrome/Chromium is required for the Designer navigation browser gate');
    t.skip('Chrome/Chromium is not installed locally');
    return;
  }

  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/web/index.html?patch-smoke=1&smoke-run=navigation-roundtrip`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-studio-navigation-'));
  const child = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, url
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const stderr = { text: '' };
  child.stderr?.on('data', chunk => { stderr.text += chunk.toString(); });
  t.after(() => stopChrome(child, profile));

  const devtools = await waitForDevTools(child, stderr);
  const target = await waitForPage(devtools.port, url);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  t.after(() => cdp.close());
  await cdp.command('Runtime.enable');
  await waitForStudio(cdp);

  const sourceSync = await evaluate(cdp, `(async () => {
    const code = document.querySelector('#code');
    if (!code) return null;
    const marker = 'when add_button clicked:';
    const start = code.value.indexOf(marker);
    if (start < 0) return { missing: marker };
    code.focus({ preventScroll: true });
    code.setSelectionRange(start, start + marker.length);
    code.dispatchEvent(new Event('select', { bubbles: true }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      selectedId: document.querySelector('#designerCanvas .designer-control.designer-selected')?.dataset.controlId ?? '',
      sourceFocused: document.activeElement === code,
      eventsSelected: document.querySelector('#designerEventsTab')?.getAttribute('aria-selected') ?? '',
      breadcrumb: document.querySelector('#designerNavigationBreadcrumb')?.textContent ?? ''
    };
  })()`);
  assert.ok(sourceSync && !sourceSync.missing, 'Counter event handler should exist in the default Studio source');
  assert.equal(sourceSync.selectedId, 'add_button', 'source event navigation should synchronize the canonical Designer control');
  assert.equal(sourceSync.sourceFocused, true, 'source synchronization must not steal editor focus');
  assert.equal(sourceSync.eventsSelected, 'true', 'source event navigation should expose the existing Events inspector');
  assert.match(sourceSync.breadcrumb, /add_button/);

  const designerJump = await evaluate(cdp, `(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', bubbles: true, cancelable: true }));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const active = document.activeElement;
    return {
      selectedId: document.querySelector('#designerCanvas .designer-control.designer-selected')?.dataset.controlId ?? '',
      activeId: active?.dataset?.controlId ?? '',
      designerVisible: !document.querySelector('#designer')?.hidden
    };
  })()`);
  assert.equal(designerJump?.selectedId, 'add_button');
  assert.equal(designerJump?.activeId, 'add_button', 'F12 should focus the source-synchronized Designer control');
  assert.equal(designerJump?.designerVisible, true);

  const handlerReturn = await evaluate(cdp, `(async () => {
    document.querySelector('#designerEventsTab')?.click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const action = document.querySelector('#designerEventHandlerAction');
    const before = action?.textContent?.trim() ?? '';
    action?.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const code = document.querySelector('#code');
    return {
      action: before,
      sourceFocused: document.activeElement === code,
      selected: code ? code.value.slice(code.selectionStart, code.selectionEnd) : '',
      smoke: document.documentElement?.dataset?.patchStudioSmoke ?? ''
    };
  })()`);
  assert.equal(handlerReturn?.action, 'Open handler', 'existing Counter handler should use the canonical Open handler action');
  assert.equal(handlerReturn?.sourceFocused, true, 'event navigation should return focus to source');
  assert.match(handlerReturn?.selected ?? '', /when add_button clicked:/);
  assert.equal(handlerReturn?.smoke, 'ready', 'Studio should remain responsive after the complete navigation round trip');
});
