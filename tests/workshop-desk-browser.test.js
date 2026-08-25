import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

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

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function findLinuxChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) ?? null;
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
      if (!fs.statSync(filename).isFile()) throw new Error('not a file');
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

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function fetchJson(url, timeoutMs = 500) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

async function connectCdp(wsUrl) {
  assert.equal(typeof WebSocket, 'function', 'Node 24 WebSocket support is required');
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome CDP connection timed out')), 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome CDP connection failed')); }, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  const command = (method, params = {}, timeoutMs = 2500) => new Promise((resolve, reject) => {
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

async function evaluate(cdp, expression, timeoutMs = 2500) {
  const result = await cdp.command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, timeoutMs);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Chrome evaluation failed');
  return result.result?.value;
}

async function waitFor(cdp, expression, predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(cdp, expression, 1800);
      if (predicate(last)) return last;
    } catch { /* one busy paint is allowed */ }
    await delay(150);
  }
  throw new Error(`Timed out waiting for Workshop Desk state; last=${JSON.stringify(last)}`);
}

test('Workshop Desk explicit load remains responsive in real Chrome', { timeout: 40000 }, async t => {
  if (process.platform !== 'linux') return t.skip('Workshop stress smoke is Linux CI only; cross-platform startup has its own gate');
  const chrome = findLinuxChrome();
  if (!chrome) {
    if (process.env.CI) assert.fail('Chrome/Chromium is required for Workshop Desk browser stress smoke');
    return t.skip('Chrome/Chromium is not installed locally');
  }

  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const serverAddress = server.address();
  assert.ok(serverAddress && typeof serverAddress === 'object');

  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-workshop-chrome-'));
  const url = `http://127.0.0.1:${serverAddress.port}/web/index.html?workshop-smoke=${Date.now()}`;
  const child = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, url
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  });

  let target = null;
  const targetDeadline = Date.now() + 12000;
  while (Date.now() < targetDeadline && !target) {
    if (child.exitCode !== null) assert.fail(`Chrome exited early: ${stderr}`);
    const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`, 500);
    if (Array.isArray(targets)) target = targets.find(item => item.type === 'page' && item.url.startsWith(url.split('?')[0]) && item.webSocketDebuggerUrl) ?? null;
    if (!target) await delay(120);
  }
  assert.ok(target?.webSocketDebuggerUrl, `Workshop Desk Chrome target was not available: ${stderr}`);

  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  t.after(() => cdp.close());
  await cdp.command('Runtime.enable');

  await waitFor(cdp,
    `document.documentElement?.dataset?.patchStudioReady === 'true' && !!document.querySelector('#sample') && !!document.querySelector('#code')`,
    value => value === true
  );

  const loaded = await evaluate(cdp, `(() => {
    const sample = document.querySelector('#sample');
    sample.value = 'workshopDesk';
    sample.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(loaded, true);

  const designerState = await waitFor(cdp, `(() => ({
    source: document.querySelector('#code')?.value ?? '',
    forms: document.querySelectorAll('#designerCanvas .patch-window').length,
    options: document.querySelectorAll('#designerFormSelect option').length,
    startup: document.documentElement?.dataset?.patchStudioStartup ?? ''
  }))()`, state => state?.source?.includes('window "Workshop Desk" as main')
    && state.source.includes('window "Workshop settings" as settings')
    && state.source.includes('window "Job details" as details')
    && state.forms >= 3
    && state.options >= 3
  );
  assert.notEqual(designerState.startup, 'failed');

  // The reported failure appears after the initial render. Keep the real page alive
  // for several seconds, then make multiple CDP round-trips and run the application.
  await delay(4500);
  const stable = await evaluate(cdp, `(() => ({
    forms: document.querySelectorAll('#designerCanvas .patch-window').length,
    sourceLength: document.querySelector('#code')?.value?.length ?? 0,
    loadButton: document.querySelector('#loadSample')?.textContent ?? '',
    brand: document.querySelector('.brand-mark')?.dataset?.patchBrandMark ?? ''
  }))()`, 3500);
  assert.ok(stable.forms >= 3, 'Workshop Desk Designer should retain all three Forms after settling');
  assert.ok(stable.sourceLength > 3000, 'Workshop Desk should remain loaded as the large showcase source');
  assert.equal(stable.loadButton, 'Load example');
  assert.equal(stable.brand, 'classic-p');

  await evaluate(cdp, `document.querySelector('#run')?.click()`);
  const appState = await waitFor(cdp, `(() => ({
    windows: document.querySelectorAll('#app .patch-window').length,
    visible: [...document.querySelectorAll('#app .patch-window')].filter(node => !node.hidden).length,
    output: document.querySelector('#output')?.textContent ?? ''
  }))()`, state => state?.windows >= 3 && state.visible >= 1, 10000);
  assert.ok(appState.windows >= 3);
  assert.ok(appState.visible >= 1);

  await delay(1000);
  assert.equal(await evaluate(cdp, `document.querySelector('#code')?.value?.includes('window "Job details" as details') === true`, 3000), true,
    'Workshop Desk page stopped responding after Run');
});
