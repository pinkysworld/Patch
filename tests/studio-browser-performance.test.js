import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { buildStudioLargeProjectFixture } from '../scripts/benchmark-studio-large-project.js';
import {
  PATCH_STUDIO_BROWSER_PERFORMANCE_CONTRACT,
  validateStudioBrowserPerformance
} from '../scripts/studio-browser-performance-contract.js';

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

function matchDevTools(text) {
  const match = String(text).match(/DevTools listening on (ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\/devtools\/browser\/[^\s]+)/);
  return match ? { browserWsUrl: match[1], port: Number(match[2]) } : null;
}

function waitForDevTools(child, stderr, port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error(`Performance Chrome did not expose DevTools within ${timeoutMs}ms. stderr:\n${stderr.text}`)), timeoutMs);
    const poll = async () => {
      while (!done) {
        const fromStderr = matchDevTools(stderr.text);
        if (fromStderr) return finish(null, fromStderr);
        const info = await fetchJson(`http://127.0.0.1:${port}/json/version`, 500);
        if (info?.webSocketDebuggerUrl) return finish(null, { browserWsUrl: info.webSocketDebuggerUrl, port });
        if (child.exitCode !== null || child.signalCode !== null) return finish(new Error(`Performance Chrome exited early. stderr:\n${stderr.text}`));
        await delay(150);
      }
    };
    poll();
  });
}

async function waitForPageTarget(port, expectedUrl, timeoutMs = 12000) {
  const expected = new URL(expectedUrl);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 500);
    const target = Array.isArray(targets) ? targets.find(item => {
      if (item.type !== 'page' || !item.url || !item.webSocketDebuggerUrl) return false;
      try {
        const candidate = new URL(item.url);
        return candidate.origin === expected.origin && candidate.pathname === expected.pathname && candidate.searchParams.has('perf-smoke');
      } catch { return false; }
    }) : null;
    if (target) return target;
    await delay(120);
  }
  throw new Error('Performance Chrome page target was not discoverable');
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

async function evaluate(cdp, expression, timeoutMs = 12000) {
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
      last = await evaluate(cdp, expression, 2000);
      if (predicate(last)) return last;
    } catch { /* a busy paint is allowed */ }
    await delay(100);
  }
  throw new Error(`Timed out waiting for performance fixture; last=${JSON.stringify(last)}`);
}

async function stopChrome(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(1200)]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

test('Studio browser performance stays inside generous R0 hard limits', { timeout: 50000 }, async t => {
  if (process.platform !== 'linux') return t.skip('Studio browser performance gate is Linux CI only');
  const chrome = findLinuxChrome();
  if (!chrome) {
    if (process.env.CI) assert.fail('Chrome/Chromium is required for Studio browser performance gate');
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-studio-perf-chrome-'));
  const url = `http://127.0.0.1:${serverAddress.port}/web/index.html?perf-smoke=${Date.now()}`;
  const child = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-crash-reporter', '--disable-default-apps',
    '--disable-extensions', '--disable-hang-monitor', '--no-first-run', '--no-default-browser-check',
    '--window-size=1440,1200', `--remote-debugging-port=${debugPort}`,
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const stderr = { text: '' };
  child.stderr?.on('data', chunk => { stderr.text += chunk.toString(); });
  t.after(async () => {
    await stopChrome(child);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
  });

  const devtools = await waitForDevTools(child, stderr, debugPort);
  const existing = await fetchJson(`http://127.0.0.1:${devtools.port}/json/list`, 500);
  const blankPage = Array.isArray(existing) ? existing.find(item => item.type === 'page' && item.webSocketDebuggerUrl) : null;
  if (blankPage) {
    const pageCdp = await connectCdp(blankPage.webSocketDebuggerUrl);
    await pageCdp.command('Page.enable');
    await pageCdp.command('Page.navigate', { url });
    pageCdp.close();
  } else {
    const browserCdp = await connectCdp(devtools.browserWsUrl);
    await browserCdp.command('Target.createTarget', { url });
    browserCdp.close();
  }

  const target = await waitForPageTarget(devtools.port, url);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  t.after(() => cdp.close());
  await cdp.command('Runtime.enable');
  await waitFor(cdp,
    `document.documentElement?.dataset?.patchStudioReady === 'true' && !!document.querySelector('#sample') && !!document.querySelector('#run')`,
    value => value === true
  );

  await evaluate(cdp, `(() => {
    window.__patchMeasureUntilPaint = async (action, predicate, timeoutMs = 10000) => {
      const started = performance.now();
      action();
      const deadline = started + timeoutMs;
      while (performance.now() < deadline) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!predicate()) continue;
        await new Promise(resolve => requestAnimationFrame(resolve));
        return performance.now() - started;
      }
      throw new Error('performance measurement timed out');
    };
    return true;
  })()`);

  await evaluate(cdp, `(() => {
    const sample = document.querySelector('#sample');
    sample.value = 'workshopDesk';
    sample.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await waitFor(cdp, `(() => ({
    forms: document.querySelectorAll('#designerCanvas .patch-window').length,
    source: document.querySelector('#code')?.value ?? ''
  }))()`, state => state?.forms >= 6 && state.source.includes('window "Workshop Desk" as main'));

  const workshopRunFirstPaint = await evaluate(cdp, `(async () => window.__patchMeasureUntilPaint(
    () => document.querySelector('#run').click(),
    () => document.querySelectorAll('#app .patch-window').length >= 6 && [...document.querySelectorAll('#app .patch-window')].some(node => !node.hidden)
  ))()`);

  const workshopEventToPaint = await evaluate(cdp, `(async () => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    if (!input) throw new Error('Workshop item input not found');
    return window.__patchMeasureUntilPaint(
      () => {
        input.value = 'Keyboard Perf';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      () => {
        const nextMain = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
        const nextInput = [...(nextMain?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
        return nextInput?.value === 'Keyboard Perf' && document.querySelector('#app')?.dataset?.patchRuntimeReconcile === 'keyed-control-v2';
      }
    );
  })()`);

  const largeSource = buildStudioLargeProjectFixture();
  await evaluate(cdp, `(() => {
    const code = document.querySelector('#code');
    code.value = ${JSON.stringify(largeSource)};
    code.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await waitFor(cdp, `(() => ({
    forms: document.querySelectorAll('#designerCanvas .patch-window').length,
    options: document.querySelectorAll('#patchFormSelect option').length,
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? ''
  }))()`, state => state?.forms === 10 && state.options === 10 && state.active === '0');

  const largeProjectDesignerSwitch = await evaluate(cdp, `(async () => {
    const select = document.querySelector('#patchFormSelect');
    return window.__patchMeasureUntilPaint(
      () => {
        select.value = '9';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      },
      () => {
        const forms = [...document.querySelectorAll('#designerCanvas .patch-window')];
        return document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm === '9'
          && (forms[9]?.querySelectorAll('.designer-control').length ?? 0) > 0
          && forms.every((form, index) => index === 9 || form.querySelectorAll('.designer-control').length === 0);
      }
    );
  })()`);

  const largeProjectRunFirstPaint = await evaluate(cdp, `(async () => window.__patchMeasureUntilPaint(
    () => document.querySelector('#run').click(),
    () => document.querySelectorAll('#app .patch-window').length === 10 && [...document.querySelectorAll('#app .patch-window')].some(node => !node.hidden)
  ))()`);

  const metrics = {
    workshopRunFirstPaint,
    workshopEventToPaint,
    largeProjectRunFirstPaint,
    largeProjectDesignerSwitch
  };
  const result = validateStudioBrowserPerformance(metrics);
  console.log(JSON.stringify({ contract: PATCH_STUDIO_BROWSER_PERFORMANCE_CONTRACT, ...result }, null, 2));
  assert.equal(result.passed, true, result.failures.join('; '));
});
