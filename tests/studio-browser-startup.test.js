import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
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

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function windowsBrowserInstallPaths() {
  const roots = uniqueStrings([
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
    process.env.ProgramW6432,
    process.env.LOCALAPPDATA,
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ]);
  const extraPaths = [];
  for (const root of roots) {
    extraPaths.push(
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  }
  return extraPaths;
}

function locateWindowsCommand(name) {
  const probe = spawnSync('where.exe', [name], { encoding: 'utf8', timeout: 3000, windowsHide: true });
  if (probe.error || probe.status !== 0) return null;
  return String(probe.stdout || '').split(/\r?\n/).map(line => line.trim()).find(line => line && fs.existsSync(line)) ?? null;
}

function findChrome() {
  const extraPaths = [];
  if (process.platform === 'darwin') {
    extraPaths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else if (process.platform === 'win32') {
    extraPaths.push(...windowsBrowserInstallPaths());
  }

  const candidates = uniqueStrings([
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    ...extraPaths,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'chrome',
    'msedge',
    'chrome.exe',
    'msedge.exe'
  ]);

  for (const executable of candidates) {
    if (path.isAbsolute(executable)) {
      // Windows chrome.exe / msedge.exe are GUI-subsystem binaries: `--version` can hang
      // until spawnSync's timeout instead of printing and exiting. Known install paths
      // are accepted by existence. The smoke launch waits on /json/version with an
      // aborted fetch, not on `--headless=new` stderr.
      if (fs.existsSync(executable)) return executable;
      continue;
    }
    if (process.platform === 'win32') {
      const located = locateWindowsCommand(executable);
      if (located) return located;
      continue;
    }
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

async function fetchJson(url, timeoutMs = 400) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function withSmokeQuery(value) {
  const url = new URL(value);
  url.searchParams.set('patch-smoke', '1');
  url.searchParams.set('smoke-run', process.env.GITHUB_SHA ?? String(Date.now()));
  return url.href;
}

function listenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      server.close(error => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function matchDevTools(text) {
  const match = String(text).match(/DevTools listening on (ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\/devtools\/browser\/[^\s]+)/);
  return match ? { browserWsUrl: match[1], port: Number(match[2]) } : null;
}

function waitForDevTools(child, stderr, port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Chrome did not expose DevTools within ${timeoutMs}ms. stderr:\n${stderr.text}`)), timeoutMs);
    const poll = async () => {
      while (!done) {
        const fromStderr = matchDevTools(stderr.text);
        if (fromStderr) return finish(null, fromStderr);
        const info = await fetchJson(`http://127.0.0.1:${port}/json/version`, 400);
        if (info?.webSocketDebuggerUrl) return finish(null, { browserWsUrl: info.webSocketDebuggerUrl, port });
        if (child.exitCode !== null || child.signalCode !== null) {
          return finish(new Error(`Chrome exited before DevTools was ready (code=${child.exitCode}, signal=${child.signalCode}). stderr:\n${stderr.text}`));
        }
        await delay(150);
      }
    };
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    poll();
  });
}

async function waitForPageTarget(port, expectedUrl, stderr, timeoutMs = 10000) {
  const expected = new URL(expectedUrl);
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no /json/list response';
  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 400);
    if (Array.isArray(targets)) {
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
      lastError = `no matching page in ${targets.length} targets`;
    }
    await delay(100);
  }
  throw new Error(`Chrome page target was not discoverable. ${lastError}\nstderr:\n${stderr.text}`);
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
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) {
    try { child.unref(); } catch { /* already closed */ }
    return;
  }
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      delay(1500)
    ]);
    try { child.unref(); } catch { /* already closed */ }
    return;
  }
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(1500)
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  try { child.unref(); } catch { /* already closed */ }
}

function chromeLaunchArgs(debugPort, profile) {
  return [
    process.platform === 'win32' ? '--headless=old' : '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-crash-reporter',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-hang-monitor',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,1200',
    `--remote-debugging-port=${debugPort}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`,
    'about:blank'
  ];
}

function launchChrome(chrome, debugPort, profile) {
  const child = spawn(chrome, chromeLaunchArgs(debugPort, profile), {
    stdio: process.platform === 'win32' ? 'ignore' : ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
    detached: process.platform === 'win32'
  });
  const stderr = { text: '' };
  child.stderr?.on('data', chunk => { stderr.text += chunk.toString(); });
  return { child, stderr };
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

test('Studio browser startup gate probes macOS and Windows Chrome locations', () => {
  const source = fs.readFileSync(new URL(import.meta.url), 'utf8');
  assert.match(source, /Google Chrome\.app\/Contents\/MacOS\/Google Chrome/);
  assert.match(source, /Google', 'Chrome', 'Application', 'chrome\.exe/);
  assert.match(source, /CHROMIUM_BIN/);
  assert.match(source, /ProgramW6432/);
  assert.match(source, /where\.exe/);
  assert.match(source, /windowsHide: true/);
  assert.match(source, /fs\.existsSync\(executable\)/);
  assert.match(source, /GUI-subsystem binaries/);
  assert.match(source, /taskkill/);
  assert.match(source, /json\/version/);
  assert.match(source, /AbortSignal\.timeout/);
  assert.match(source, /headless=old/);
  assert.match(source, /remote-debugging-address=127\.0\.0\.1/);
  assert.match(source, /about:blank/);
});

test('full CI suite isolates Chrome smoke so a hung browser cannot pin the 12-minute job', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const runner = fs.readFileSync(path.join(ROOT, 'scripts/run-tests-ci.js'), 'utf8');
  assert.match(runner, /--test-skip-pattern/);
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
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));

  const debugPort = await listenPort();
  const { child, stderr } = launchChrome(chrome, debugPort, profile);
  t.after(() => stopChrome(child));
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

  const workspaceLayout = await evaluate(cdp, `(async () => {
    const workspace = document.querySelector('.workspace');
    const handle = document.querySelector('#workspaceSplitHandle');
    const reset = document.querySelector('#resetWorkspaceLayout');
    if (!workspace || !handle || !reset) return null;
    localStorage.removeItem('patchStudio.workspaceSplit.v2');
    const before = Number(handle.getAttribute('aria-valuenow'));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 30));
    const after = Number(handle.getAttribute('aria-valuenow'));
    const stored = localStorage.getItem('patchStudio.workspaceSplit.v2');
    const sourceHeight = workspace.style.getPropertyValue('--workspace-source-height');
    const resultHeight = workspace.style.getPropertyValue('--workspace-result-height');
    reset.click();
    await new Promise(resolve => setTimeout(resolve, 20));
    return {
      before,
      after,
      stored,
      sourceHeight,
      resultHeight,
      resetStored: localStorage.getItem('patchStudio.workspaceSplit.v2'),
      resetValue: Number(handle.getAttribute('aria-valuenow')),
      sized: workspace.dataset.workspaceSized ?? '',
      smoke: document.documentElement?.dataset?.patchStudioSmoke ?? ''
    };
  })()`);
  assert.ok(workspaceLayout, 'Workspace Layout v2 controls should exist in Chrome');
  assert.ok(workspaceLayout.after > workspaceLayout.before, 'Arrow Down should allocate more height to the source workspace');
  assert.match(workspaceLayout.stored ?? '', /^0\.\d{4}$/);
  assert.match(workspaceLayout.sourceHeight ?? '', /^\d+px$/);
  assert.match(workspaceLayout.resultHeight ?? '', /^\d+px$/);
  assert.equal(workspaceLayout.resetStored, null, 'Reset split should remove the local IDE preference');
  assert.equal(workspaceLayout.resetValue, 40, 'Reset split should restore the default 40 percent source allocation');
  assert.equal(workspaceLayout.sized, 'true');
  assert.equal(workspaceLayout.smoke, 'ready', 'Studio should remain responsive after workspace resizing');
});
