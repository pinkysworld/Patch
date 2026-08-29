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
    const timer = setTimeout(() => {
      finish(new Error(`Workshop Chrome did not expose DevTools within ${timeoutMs}ms. stderr:\n${stderr.text}`));
    }, timeoutMs);
    const poll = async () => {
      while (!done) {
        const fromStderr = matchDevTools(stderr.text);
        if (fromStderr) return finish(null, fromStderr);
        const info = await fetchJson(`http://127.0.0.1:${port}/json/version`, 500);
        if (info?.webSocketDebuggerUrl) return finish(null, { browserWsUrl: info.webSocketDebuggerUrl, port });
        if (child.exitCode !== null || child.signalCode !== null) {
          return finish(new Error(`Workshop Chrome exited before DevTools was ready (code=${child.exitCode}, signal=${child.signalCode}). stderr:\n${stderr.text}`));
        }
        await delay(150);
      }
    };
    poll();
  });
}

async function waitForPageTarget(port, expectedUrl, stderr, timeoutMs = 12000) {
  const expected = new URL(expectedUrl);
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no /json/list response';
  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 500);
    if (Array.isArray(targets)) {
      const target = targets.find(item => {
        if (item.type !== 'page' || !item.url || !item.webSocketDebuggerUrl) return false;
        try {
          const candidate = new URL(item.url);
          return candidate.origin === expected.origin
            && candidate.pathname === expected.pathname
            && candidate.searchParams.has('workshop-smoke');
        } catch { return false; }
      });
      if (target) return target;
      lastError = `no matching page in ${targets.length} targets`;
    }
    await delay(120);
  }
  throw new Error(`Workshop Chrome page target was not discoverable. ${lastError}\nstderr:\n${stderr.text}`);
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

async function stopChrome(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(1200)
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

test('Workshop Desk explicit load remains responsive in real Chrome', { timeout: 50000 }, async t => {
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
  const blankPage = Array.isArray(existing)
    ? existing.find(item => item.type === 'page' && item.webSocketDebuggerUrl)
    : null;
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

  const target = await waitForPageTarget(devtools.port, url, stderr);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  t.after(() => cdp.close());
  await cdp.command('Runtime.enable');

  await waitFor(cdp,
    `document.documentElement?.dataset?.patchStudioReady === 'true' && !!document.querySelector('#sample') && !!document.querySelector('#code')`,
    value => value === true
  );

  // Trigger the heavyweight sample reconciliation on the next browser task so
  // this CDP command measures command responsiveness, not the full Designer load.
  // The bounded wait below remains the authoritative load/readiness gate.
  const loaded = await evaluate(cdp, `(() => {
    const sample = document.querySelector('#sample');
    sample.value = 'workshopDesk';
    setTimeout(() => sample.dispatchEvent(new Event('change', { bubbles: true })), 0);
    return true;
  })()`);
  assert.equal(loaded, true);

  const designerState = await waitFor(cdp, `(() => ({
    source: document.querySelector('#code')?.value ?? '',
    forms: document.querySelectorAll('#designerCanvas .patch-window').length,
    options: document.querySelectorAll('#patchFormSelect option').length,
    materialized: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controlsByForm: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length),
    startup: document.documentElement?.dataset?.patchStudioStartup ?? ''
  }))()`, state => state?.source?.includes('window "Workshop Desk" as main')
    && state.source.includes('window "Workshop settings" as settings')
    && state.source.includes('window "Job details" as details')
    && state.forms >= 6
    && state.options >= 6
  );
  assert.notEqual(designerState.startup, 'failed');
  assert.equal(designerState.materialized, '0');
  assert.ok(designerState.controlsByForm[0] > 0, 'active Workshop Form should materialize its control DOM');
  assert.ok(designerState.controlsByForm.slice(1).every(count => count === 0), 'inactive Workshop Forms should remain lightweight shells');

  const switchedDesignerForm = await evaluate(cdp, `(() => {
    const select = document.querySelector('#patchFormSelect');
    if (!select) return false;
    select.value = '1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(switchedDesignerForm, true);
  const materializedSettings = await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length),
    leaks: [...document.querySelectorAll('#designerCanvas .patch-window')].map((form, index) => index === 1 ? [] : [...form.querySelectorAll('.designer-control')].map(control => ({ className: control.className?.baseVal ?? control.className ?? '', tag: control.tagName, id: control.id ?? '', type: control.dataset?.componentType ?? control.dataset?.patchControlType ?? '' })))
  }))()`, state => state?.active === '1' && state.controls?.[1] > 0 && state.controls.every((count, index) => index === 1 ? count > 0 : count === 0));
  assert.equal(materializedSettings.controls[0], 0, JSON.stringify(materializedSettings.leaks));
  assert.ok(materializedSettings.controls[1] > 0);
  assert.ok(materializedSettings.controls.slice(2).every(count => count === 0), JSON.stringify(materializedSettings.leaks));

  await evaluate(cdp, `(() => {
    const select = document.querySelector('#patchFormSelect');
    select.value = '0';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await waitFor(cdp, `(() => ({
    active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
    controls: [...document.querySelectorAll('#designerCanvas .patch-window')].map(form => form.querySelectorAll('.designer-control').length)
  }))()`, state => state?.active === '0' && state.controls?.[0] > 0 && state.controls.slice(1).every(count => count === 0));

  // The reported failure appears after the initial render. Keep the real page alive
  // for several seconds, then make multiple CDP round-trips and run the application.
  await delay(4500);
  const stable = await evaluate(cdp, `(() => ({
    forms: document.querySelectorAll('#designerCanvas .patch-window').length,
    sourceLength: document.querySelector('#code')?.value?.length ?? 0,
    loadButton: document.querySelector('#loadSample')?.textContent ?? '',
    brand: document.querySelector('.brand-mark')?.dataset?.patchBrandMark ?? ''
  }))()`, 3500);
  assert.ok(stable.forms >= 6, 'Workshop Desk Designer should retain all six Forms after settling');
  assert.ok(stable.sourceLength > 9000, 'Workshop Desk should remain loaded as the expanded six-Form showcase source');
  assert.equal(stable.loadButton, 'Load example');
  assert.equal(stable.brand, 'compiler-p-v1');

  await evaluate(cdp, `document.querySelector('#run')?.click()`);
  const appState = await waitFor(cdp, `(() => ({
    windows: document.querySelectorAll('#app .patch-window').length,
    visible: [...document.querySelectorAll('#app .patch-window')].filter(node => !node.hidden).length,
    deferred: [...document.querySelectorAll('#app .patch-window')].filter(node => node.dataset.patchRenderDetail === 'deferred').length,
    mainDetail: document.querySelector('#app .patch-window[data-patch-window-id="main"]')?.dataset.patchRenderDetail ?? '',
    settingsChildren: document.querySelector('#app .patch-window[data-patch-window-id="settings"] .patch-window-body')?.childElementCount ?? -1,
    hiddenChildren: [...document.querySelectorAll('#app .patch-window')].filter(node => node.hidden).map(node => node.querySelector('.patch-window-body')?.childElementCount ?? -1),
    output: document.querySelector('#output')?.textContent ?? ''
  }))()`, state => state?.windows >= 6 && state.visible >= 1, 10000);
  assert.ok(appState.windows >= 6);
  assert.ok(appState.visible >= 1);
  assert.ok(appState.deferred >= 2, 'hidden Workshop Forms should defer their control DOM until opened');
  assert.equal(appState.mainDetail, 'full');
  assert.equal(appState.settingsChildren, 0);
  assert.ok(appState.hiddenChildren.every(count => count === 0), `deferred Form bodies must stay empty: ${JSON.stringify(appState.hiddenChildren)}`);

  const keyedInputStarted = await evaluate(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    if (!main || !settings || !input) return false;
    window.__patchMainBeforeItemEvent = main;
    window.__patchSettingsBeforeItemEvent = settings;
    input.focus();
    input.value = 'Keyboard Pro';
    input.setSelectionRange(5, 5);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(keyedInputStarted, true);
  const keyedInputState = await waitFor(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const input = [...(main?.querySelectorAll('input.patch-input') ?? [])].find(node => node.placeholder === 'item');
    return input ? {
      value: input.value,
      active: document.activeElement === input,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
      mainReplaced: window.__patchMainBeforeItemEvent !== main,
      settingsStable: window.__patchSettingsBeforeItemEvent === settings,
      reconcile: document.querySelector('#app')?.dataset?.patchRuntimeReconcile ?? '',
      reusedForms: Number(document.querySelector('#app')?.dataset?.patchRuntimeReusedForms ?? 0),
      replacedForms: Number(document.querySelector('#app')?.dataset?.patchRuntimeReplacedForms ?? 0),
      key: input.dataset.patchControlKey ?? ''
    } : null;
  })()`, state => state?.value === 'Keyboard Pro' && state.active === true && state.reconcile === 'keyed-window-v1');
  assert.equal(keyedInputState.mainReplaced, true, 'changed main Form should be replaced at the Stage 1 Form boundary');
  assert.equal(keyedInputState.settingsStable, true, 'unchanged hidden Form DOM should retain identity across an event');
  assert.ok(keyedInputState.reusedForms >= 1, `expected keyed Form reuse, got ${JSON.stringify(keyedInputState)}`);
  assert.ok(keyedInputState.replacedForms >= 1, `expected a changed Form replacement, got ${JSON.stringify(keyedInputState)}`);
  assert.equal(keyedInputState.selectionStart, 5);
  assert.equal(keyedInputState.selectionEnd, 5);
  assert.match(keyedInputState.key, /^id:item$/);

  const multiBefore = await evaluate(cdp, `(() => {
    const list = [...document.querySelectorAll('#app select.patch-listbox')].find(node => node.multiple);
    return list ? { multiple: list.multiple, selected: [...list.selectedOptions].map(item => item.value) } : null;
  })()`);
  assert.equal(multiBefore?.multiple, true, 'list-backed Workshop ListBox should be multi-select in Studio Run');
  assert.deepEqual(multiBefore?.selected, ['Diagnostics']);

  const multiChanged = await evaluate(cdp, `(() => {
    const list = [...document.querySelectorAll('#app select.patch-listbox')].find(node => node.multiple);
    if (!list) return false;
    for (const item of list.options) item.selected = item.value === 'Diagnostics' || item.value === 'Pickup';
    list.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(multiChanged, true);
  const multiAfter = await waitFor(cdp, `(() => {
    const list = [...document.querySelectorAll('#app select.patch-listbox')].find(node => node.multiple);
    return list ? [...list.selectedOptions].map(item => item.value) : [];
  })()`, values => Array.isArray(values) && values.includes('Diagnostics') && values.includes('Pickup'));
  assert.deepEqual(multiAfter, ['Diagnostics', 'Pickup']);

  const openedSettings = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('#app button.patch-button')].find(node => node.textContent.trim() === 'Settings');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(openedSettings, true);
  const settingsState = await waitFor(cdp, `(() => {
    const form = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    return form ? {
      hidden: form.hidden,
      detail: form.dataset.patchRenderDetail ?? '',
      children: form.querySelector('.patch-window-body')?.childElementCount ?? 0
    } : null;
  })()`, state => state && state.hidden === false && state.detail === 'full' && state.children > 0);
  assert.equal(settingsState.hidden, false);
  assert.equal(settingsState.detail, 'full');
  assert.ok(settingsState.children > 0);

  const tabsSwitched = await evaluate(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const tabs = settings?.querySelector('.patch-tabs[data-tabs-id="prefs"]');
    const buttons = tabs ? [...tabs.querySelectorAll('.patch-tab-button')] : [];
    if (!main || !settings || buttons.length < 2) return false;
    window.__patchMainBeforeTabSwitch = main;
    window.__patchSettingsBeforeTabSwitch = settings;
    buttons[1].click();
    return true;
  })()`);
  assert.equal(tabsSwitched, true);
  const tabState = await waitFor(cdp, `(() => {
    const main = document.querySelector('#app .patch-window[data-patch-window-id="main"]');
    const settings = document.querySelector('#app .patch-window[data-patch-window-id="settings"]');
    const tabs = settings?.querySelector('.patch-tabs[data-tabs-id="prefs"]');
    const buttons = tabs ? [...tabs.querySelectorAll('.patch-tab-button')] : [];
    return tabs ? {
      mainStable: window.__patchMainBeforeTabSwitch === main,
      settingsStable: window.__patchSettingsBeforeTabSwitch === settings,
      selected: buttons.map(button => button.getAttribute('aria-selected')),
      panel: tabs.querySelector('.patch-tab-panel')?.textContent ?? ''
    } : null;
  })()`, state => state?.selected?.[1] === 'true' && state.panel.includes('Labor approval limit'));
  assert.equal(tabState.mainStable, true, 'Tabs switch must not rebuild unrelated Forms');
  assert.equal(tabState.settingsStable, true, 'Tabs switch must keep its parent Form DOM identity');
  assert.equal(tabState.selected[0], 'false');
  assert.equal(tabState.selected[1], 'true');

  await delay(1000);
  assert.equal(await evaluate(cdp, `document.querySelector('#code')?.value?.includes('window "Job details" as details') === true`, 3000), true,
    'Workshop Desk page stopped responding after Run and Form materialization');
});