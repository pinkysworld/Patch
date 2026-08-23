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
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm']
]);

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser'
  ].filter(Boolean);
  for (const executable of candidates) {
    const probe = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 3000 });
    if (!probe.error && probe.status === 0) return executable;
  }
  return null;
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withSmokeQuery(value) {
  const url = new URL(value);
  url.searchParams.set('patch-smoke', '1');
  url.searchParams.set('smoke-run', process.env.GITHUB_SHA ?? String(Date.now()));
  return url.href;
}

function waitForDevTools(child, stderr, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Chrome did not expose DevTools within ${timeoutMs}ms. stderr:\n${stderr.text}`)), timeoutMs);
    const onData = () => {
      const match = stderr.text.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/[^\s]+)/);
      if (match) finish(null, { browserWsUrl: match[1], port: Number(match[2]) });
    };
    const onExit = (code, signal) => finish(new Error(`Chrome exited before DevTools was ready (code=${code}, signal=${signal}). stderr:\n${stderr.text}`));
    const finish = (error, value) => {
      clearTimeout(timer);
      child.stderr?.off('data', onData);
      child.off('exit', onExit);
      if (error) reject(error);
      else resolve(value);
    };
    child.stderr?.on('data', onData);
    child.once('exit', onExit);
  });
}

async function waitForPageTarget(port, expectedUrl, stderr, timeoutMs = 10000) {
  const expected = new URL(expectedUrl);
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { cache: 'no-store' });
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find(item => {
          if (item.type !== 'page' || !item.url) return false;
          try {
            const candidate = new URL(item.url);
            return candidate.origin === expected.origin
              && candidate.pathname === expected.pathname
              && candidate.searchParams.get('patch-smoke') === '1';
          } catch {
            return false;
          }
        });
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Chrome page target was not discoverable. ${lastError?.message ?? ''}\nstderr:\n${stderr.text}`);
}

async function connectCdp(webSocketDebuggerUrl) {
  assert.equal(typeof WebSocket, 'function', 'Node WebSocket support is required for the Chrome startup gate');
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting to the Chrome page target')), 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome DevTools WebSocket connection failed')); }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (!message.id || !pending.has(message.id)) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(`CDP ${entry.method} failed: ${message.error.message}`));
    else entry.resolve(message.result);
  });

  const command = (method, params = {}, timeoutMs = 2000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome page stopped responding to ${method} for ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer, method });
    socket.send(JSON.stringify({ id, method, params }));
  });

  return {
    command,
    close() {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Chrome DevTools connection closed'));
      }
      pending.clear();
      socket.close();
    }
  };
}

async function evaluate(cdp, expression, timeoutMs = 2000) {
  const result = await cdp.command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, timeoutMs);
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description
      ?? result.result?.description
      ?? result.exceptionDetails.text
      ?? 'unknown exception';
    throw new Error(`Chrome evaluation failed: ${detail}`);
  }
  return result.result?.value;
}

async function stopChrome(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(1500)
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

async function localStudioUrl(t) {
  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return withSmokeQuery(`http://127.0.0.1:${address.port}/web/index.html`);
}

test('Patch Studio stays responsive in Chrome, runs a Window app and quick-opens project symbols', { timeout: 45000 }, async t => {
  const chrome = findChrome();
  if (!chrome) {
    if (process.env.CI) assert.fail('Chrome/Chromium is required for the Patch Studio browser startup gate');
    t.skip('Chrome/Chromium is not installed locally');
    return;
  }

  const externalUrl = process.env.PATCH_STUDIO_SMOKE_URL?.trim();
  const url = externalUrl ? withSmokeQuery(externalUrl) : await localStudioUrl(t);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-studio-chrome-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));

  const stderr = { text: '' };
  const child = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    url
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr?.on('data', chunk => { stderr.text += chunk.toString(); });
  t.after(() => stopChrome(child));

  const devtools = await waitForDevTools(child, stderr);
  const target = await waitForPageTarget(devtools.port, url, stderr);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  t.after(() => cdp.close());
  await cdp.command('Runtime.enable');

  const deadline = Date.now() + 9000;
  let smokeState = null;
  while (Date.now() < deadline) {
    smokeState = await evaluate(cdp, 'document.documentElement?.dataset?.patchStudioSmoke ?? null', 1500);
    if (smokeState === 'ready' || smokeState === 'failed') break;
    await delay(150);
  }

  assert.equal(smokeState, 'ready', `Studio did not reach the responsive Run state at ${url}. stderr:\n${stderr.text}`);
  assert.equal(await evaluate(cdp, "!!document.querySelector('#app') && !document.querySelector('#app').hidden && !!document.querySelector('#app .patch-window')"), true,
    'Run smoke probe did not render the default Patch Window app');

  // Keep probing after the automatic Run action. The original production failure
  // appeared only after a few seconds when Designer MutationObservers recursively
  // reconciled their own DOM writes.
  await delay(2500);
  assert.equal(await evaluate(cdp, "document.documentElement?.dataset?.patchStudioSmoke === 'ready' && !!document.querySelector('#run')"), true,
    `Patch Studio stopped responding after its initial render at ${url}`);

  // Exercise the real keyboard-first palette against the loaded project model.
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
    return { count: items.length, text: items[0]?.textContent ?? '' };
  })()`);
  assert.equal(recoveryMatch?.count, 1, 'Command Palette filtering should narrow to the Recovery command');
  assert.match(recoveryMatch?.text ?? '', /Recovery/);

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
  assert.equal(symbolMatch?.count, 1, 'Quick-open should isolate the Counter form symbol');
  assert.match(symbolMatch?.text ?? '', /Counter/);
  assert.match(symbolMatch?.text ?? '', /main\.patch:3/);
  assert.equal(symbolMatch?.kind, 'Form');

  const quickOpenResult = await evaluate(cdp, `(async () => {
    const item = document.querySelector('#commandPaletteList .command-palette-item');
    item?.click();
    await new Promise(resolve => setTimeout(resolve, 40));
    const dialog = document.querySelector('#commandPalette');
    const editor = document.querySelector('#code');
    return {
      dialogOpen: Boolean(dialog?.open),
      editorTitle: document.querySelector('#editorTitle')?.textContent ?? '',
      selected: editor ? editor.value.slice(editor.selectionStart, editor.selectionEnd) : '',
      smoke: document.documentElement?.dataset?.patchStudioSmoke ?? ''
    };
  })()`);
  assert.equal(quickOpenResult?.dialogOpen, false, 'Selecting a quick-open result should close the palette');
  assert.equal(quickOpenResult?.editorTitle, 'main.patch');
  assert.match(quickOpenResult?.selected ?? '', /window "Counter"/);
  assert.equal(quickOpenResult?.smoke, 'ready', 'Studio should remain responsive after exact symbol navigation');
});
