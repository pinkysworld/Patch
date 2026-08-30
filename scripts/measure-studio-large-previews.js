import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const TABLE_ROWS = Number(process.env.PATCH_PREVIEW_TABLE_ROWS ?? 1500);
const TREE_NODES = Number(process.env.PATCH_PREVIEW_TREE_NODES ?? 1500);
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
function findChrome() {
  return [process.env.CHROME_BIN, process.env.CHROMIUM_BIN, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
    .filter(Boolean).find(candidate => fs.existsSync(candidate)) ?? null;
}
function sourceFixture() {
  const rows = Array.from({ length: TABLE_ROWS }, (_, index) => `    row "${index}", "Item ${index}", "Ready"`).join('\n');
  const nodes = Array.from({ length: TREE_NODES }, (_, index) => `    node "Node ${index}"`).join('\n');
  return `window "Large Table" as table_form size 980, 700:\n  table "ID", "Name", "State" as big_table at 20, 20 size 900, 620:\n${rows}\n\nwindow "Large Tree" as tree_form size 980, 700:\n  tree as big_tree at 20, 20 size 900, 620:\n${nodes}\n`;
}
function createServer() {
  return http.createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const relative = url.pathname === '/' ? 'web/index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const filename = path.resolve(ROOT, relative);
      if (filename !== ROOT && !filename.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end('Forbidden');
      if (!fs.statSync(filename).isFile()) throw new Error('not a file');
      response.writeHead(200, { 'content-type': MIME.get(path.extname(filename)) ?? 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(filename).pipe(response);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function fetchJson(url) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(700) });
    return response.ok ? response.json() : null;
  } catch { return null; }
}
function matchDevTools(text) {
  const match = String(text).match(/DevTools listening on (ws:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):(\d+)\/devtools\/browser\/[^\s]+)/);
  return match ? { ws: match[1], port: Number(match[2]) } : null;
}
async function waitDevTools(child, stderr, port) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const fromStderr = matchDevTools(stderr.text);
    if (fromStderr) return fromStderr;
    const info = await fetchJson(`http://127.0.0.1:${port}/json/version`);
    if (info?.webSocketDebuggerUrl) return { ws: info.webSocketDebuggerUrl, port };
    if (child.exitCode !== null) throw new Error(`Chrome exited early: ${stderr.text}`);
    await delay(120);
  }
  throw new Error(`Chrome DevTools timeout: ${stderr.text}`);
}
async function waitPage(port, expectedUrl) {
  const expected = new URL(expectedUrl);
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const target = Array.isArray(targets) ? targets.find(item => {
      if (item.type !== 'page' || !item.webSocketDebuggerUrl) return false;
      try {
        const candidate = new URL(item.url);
        return candidate.origin === expected.origin && candidate.pathname === expected.pathname && candidate.searchParams.has('preview-measure');
      } catch { return false; }
    }) : null;
    if (target) return target;
    await delay(120);
  }
  throw new Error('Chrome page target timeout');
}
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP open timeout')), 5000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP open failed')); }, { once: true });
  });
  let next = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
  });
  const command = (method, params = {}, timeoutMs = 15000) => new Promise((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method} timeout`)); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { command, close: () => socket.close() };
}
async function evaluate(cdp, expression, timeoutMs = 15000) {
  const result = await cdp.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'evaluation failed');
  return result.result?.value;
}
async function waitFor(cdp, expression, predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try { last = await evaluate(cdp, expression, 2500); if (predicate(last)) return last; } catch {}
    await delay(100);
  }
  throw new Error(`preview measurement timeout; last=${JSON.stringify(last)}`);
}
async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(1000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

const chrome = findChrome();
if (!chrome) throw new Error('Chrome/Chromium is required');
const server = createServer();
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const serverAddress = server.address();
const debugPort = await freePort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-large-preview-'));
const url = `http://127.0.0.1:${serverAddress.port}/web/index.html?preview-measure=${Date.now()}`;
const child = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-extensions', '--no-first-run',
  '--window-size=1440,1200', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
const stderr = { text: '' };
child.stderr?.on('data', chunk => { stderr.text += chunk.toString(); });

try {
  const devtools = await waitDevTools(child, stderr, debugPort);
  const existing = await fetchJson(`http://127.0.0.1:${devtools.port}/json/list`);
  const blank = Array.isArray(existing) ? existing.find(item => item.type === 'page' && item.webSocketDebuggerUrl) : null;
  if (blank) {
    const page = await connect(blank.webSocketDebuggerUrl);
    await page.command('Page.enable');
    await page.command('Page.navigate', { url });
    page.close();
  } else {
    const browser = await connect(devtools.ws);
    await browser.command('Target.createTarget', { url });
    browser.close();
  }
  const target = await waitPage(devtools.port, url);
  const cdp = await connect(target.webSocketDebuggerUrl);
  try {
    await cdp.command('Runtime.enable');
    await waitFor(cdp, `document.documentElement?.dataset?.patchStudioReady === 'true'`, value => value === true);
    const source = sourceFixture();
    const tableStarted = await evaluate(cdp, `performance.now()`);
    await evaluate(cdp, `(() => { const code = document.querySelector('#code'); code.value = ${JSON.stringify(source)}; code.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    const tableState = await waitFor(cdp, `(() => ({
      active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
      rows: document.querySelectorAll('#designerCanvas .patch-table-stage1-control tbody > tr').length,
      tableNodes: document.querySelector('#designerCanvas .patch-table-stage1-control')?.querySelectorAll('*').length ?? 0,
      totalNodes: document.querySelector('#designerCanvas')?.querySelectorAll('*').length ?? 0
    }))()`, state => state?.active === '0' && state.rows === TABLE_ROWS);
    await evaluate(cdp, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const tableEnded = await evaluate(cdp, `performance.now()`);

    const treeStarted = await evaluate(cdp, `performance.now()`);
    await evaluate(cdp, `(() => { const select = document.querySelector('#patchFormSelect'); select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    const treeState = await waitFor(cdp, `(() => ({
      active: document.querySelector('#designerCanvas')?.dataset?.patchDesignerMaterializedForm ?? '',
      treeNodes: document.querySelectorAll('#designerCanvas .patch-tree-node').length,
      treeDomNodes: document.querySelector('#designerCanvas .patch-tree')?.querySelectorAll('*').length ?? 0,
      totalNodes: document.querySelector('#designerCanvas')?.querySelectorAll('*').length ?? 0
    }))()`, state => state?.active === '1' && state.treeNodes === TREE_NODES);
    await evaluate(cdp, `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const treeEnded = await evaluate(cdp, `performance.now()`);

    console.log(JSON.stringify({
      contract: 'patch-studio-large-preview-measurement/0.1',
      fixture: { tableRows: TABLE_ROWS, treeNodes: TREE_NODES },
      metrics: {
        tableInputToStablePaintMs: tableEnded - tableStarted,
        treeSwitchToStablePaintMs: treeEnded - treeStarted,
        tableRenderedRows: tableState.rows,
        tableDescendantNodes: tableState.tableNodes,
        tableDesignerTotalNodes: tableState.totalNodes,
        treeRenderedNodes: treeState.treeNodes,
        treeDescendantNodes: treeState.treeDomNodes,
        treeDesignerTotalNodes: treeState.totalNodes
      }
    }, null, 2));
  } finally { cdp.close(); }
} finally {
  await stop(child);
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(profile, { recursive: true, force: true });
}
