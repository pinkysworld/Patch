import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const TABLE_ROWS = 1000;
const TABLE_COLUMNS = 6;
const TREE_ROOTS = 100;
const TREE_CHILDREN_PER_ROOT = 19;
const TREE_NODES = TREE_ROOTS * (TREE_CHILDREN_PER_ROOT + 1);
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

function buildLargeTableSource() {
  const columns = Array.from({ length: TABLE_COLUMNS }, (_, index) => `"Column ${index + 1}"`).join(', ');
  const rows = Array.from({ length: TABLE_ROWS }, (_, row) => {
    const cells = Array.from({ length: TABLE_COLUMNS }, (_, column) => `"R${row + 1}C${column + 1}"`).join(', ');
    return `    row ${cells}`;
  }).join('\n');
  return `window "Heavy Table" as main size 1040, 760:\n  table ${columns} as heavy_table at 24, 48 size 960, 640:\n${rows}\n`;
}

function buildLargeTreeSource() {
  const nodes = [];
  for (let root = 0; root < TREE_ROOTS; root += 1) {
    nodes.push(`    node "Root ${root + 1}"`);
    for (let child = 0; child < TREE_CHILDREN_PER_ROOT; child += 1) {
      nodes.push(`      node "Child ${root + 1}.${child + 1}"`);
    }
  }
  return `window "Heavy Tree" as main size 760, 760:\n  tree as heavy_tree at 24, 48 size 680, 640:\n${nodes.join('\n')}\n`;
}

function findLinuxChrome() {
  return [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean).find(candidate => fs.existsSync(candidate)) ?? null;
}

function createStaticServer() {
  return http.createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'web/index.html';
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

async function fetchJson(url, timeoutMs = 600) {
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? response.json() : null;
  } catch { return null; }
}

async function waitForPageTarget(port, expectedUrl, timeoutMs = 15000) {
  const expected = new URL(expectedUrl);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const target = Array.isArray(targets) ? targets.find(item => {
      if (item.type !== 'page' || !item.url || !item.webSocketDebuggerUrl) return false;
      try {
        const candidate = new URL(item.url);
        return candidate.origin === expected.origin && candidate.pathname === expected.pathname && candidate.searchParams.has('heavy-control-measure');
      } catch { return false; }
    }) : null;
    if (target) return target;
    await delay(120);
  }
  throw new Error('Heavy-control Chrome page target was not discoverable');
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
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  const command = (method, params = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
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

async function evaluate(cdp, expression, timeoutMs = 25000) {
  const result = await cdp.command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, timeoutMs);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Chrome evaluation failed');
  return result.result?.value;
}

async function waitFor(cdp, expression, predicate, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(cdp, expression, 3000);
      if (predicate(last)) return last;
    } catch { /* busy browser work is part of the measurement */ }
    await delay(100);
  }
  throw new Error(`Timed out waiting for heavy-control fixture; last=${JSON.stringify(last)}`);
}

async function stopChrome(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(1200)]);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

test('measurement only: large Table and TreeView browser materialization', { timeout: 90000 }, async t => {
  if (process.platform !== 'linux') return t.skip('Heavy-control browser measurement is Linux CI only');
  const chrome = findLinuxChrome();
  if (!chrome) {
    if (process.env.CI) assert.fail('Chrome/Chromium is required for heavy-control measurement');
    return t.skip('Chrome/Chromium is not installed locally');
  }

  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const debugPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-studio-heavy-control-'));
  const url = `http://127.0.0.1:${address.port}/web/index.html?heavy-control-measure=${Date.now()}`;
  const child = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-crash-reporter', '--disable-default-apps',
    '--disable-extensions', '--disable-hang-monitor', '--no-first-run', '--no-default-browser-check',
    '--window-size=1440,1200', `--remote-debugging-port=${debugPort}`,
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, url
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  t.after(async () => {
    await stopChrome(child);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
  });

  const target = await waitForPageTarget(debugPort, url);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  t.after(() => cdp.close());
  await cdp.command('Runtime.enable');
  await waitFor(cdp,
    `document.documentElement?.dataset?.patchStudioReady === 'true' && !!document.querySelector('#code') && !!document.querySelector('#run')`,
    value => value === true
  );

  await evaluate(cdp, `(() => {
    window.__patchHeavyMeasureUntilPaint = async (action, predicate, timeoutMs = 30000) => {
      const started = performance.now();
      action();
      const deadline = started + timeoutMs;
      while (performance.now() < deadline) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!predicate()) continue;
        await new Promise(resolve => requestAnimationFrame(resolve));
        return performance.now() - started;
      }
      throw new Error('heavy-control performance measurement timed out');
    };
    return true;
  })()`);

  const tableSource = buildLargeTableSource();
  const tableDesignerPaint = await evaluate(cdp, `(async () => {
    document.querySelector('.tab[data-tab="designer"]')?.click();
    return window.__patchHeavyMeasureUntilPaint(
      () => {
        const code = document.querySelector('#code');
        code.value = ${JSON.stringify(tableSource)};
        code.dispatchEvent(new Event('input', { bubbles: true }));
      },
      () => document.querySelectorAll('#designerCanvas .patch-table-stage1-control tbody tr').length === ${TABLE_ROWS}
        && document.querySelectorAll('#designerCanvas .patch-table-stage1-control tbody td').length === ${TABLE_ROWS * TABLE_COLUMNS}
    );
  })()`);
  const tableDesignerDom = await evaluate(cdp, `(() => ({
    rows: document.querySelectorAll('#designerCanvas .patch-table-stage1-control tbody tr').length,
    cells: document.querySelectorAll('#designerCanvas .patch-table-stage1-control tbody td').length,
    nodes: document.querySelector('#designerCanvas .patch-table-stage1-control')?.getElementsByTagName('*').length ?? 0
  }))()`);
  const tableRunPaint = await evaluate(cdp, `(async () => window.__patchHeavyMeasureUntilPaint(
    () => document.querySelector('#run').click(),
    () => document.querySelectorAll('#app .patch-table-wrap tbody tr').length === ${TABLE_ROWS}
      && document.querySelectorAll('#app .patch-table-wrap tbody td').length === ${TABLE_ROWS * TABLE_COLUMNS}
  ))()`);
  const tableRuntimeDom = await evaluate(cdp, `(() => ({
    rows: document.querySelectorAll('#app .patch-table-wrap tbody tr').length,
    cells: document.querySelectorAll('#app .patch-table-wrap tbody td').length,
    nodes: document.querySelector('#app .patch-table-wrap')?.getElementsByTagName('*').length ?? 0
  }))()`);

  const treeSource = buildLargeTreeSource();
  const treeDesignerPaint = await evaluate(cdp, `(async () => {
    document.querySelector('.tab[data-tab="designer"]')?.click();
    return window.__patchHeavyMeasureUntilPaint(
      () => {
        const code = document.querySelector('#code');
        code.value = ${JSON.stringify(treeSource)};
        code.dispatchEvent(new Event('input', { bubbles: true }));
      },
      () => document.querySelectorAll('#designerCanvas .patch-tree-node').length === ${TREE_NODES}
    );
  })()`);
  const treeDesignerDom = await evaluate(cdp, `(() => ({
    treeNodes: document.querySelectorAll('#designerCanvas .patch-tree-node').length,
    nodes: document.querySelector('#designerCanvas .patch-tree')?.getElementsByTagName('*').length ?? 0
  }))()`);
  const treeRunPaint = await evaluate(cdp, `(async () => window.__patchHeavyMeasureUntilPaint(
    () => document.querySelector('#run').click(),
    () => document.querySelectorAll('#app .patch-tree-node').length === ${TREE_NODES}
  ))()`);
  const treeRuntimeDom = await evaluate(cdp, `(() => ({
    treeNodes: document.querySelectorAll('#app .patch-tree-node').length,
    nodes: document.querySelector('#app .patch-tree')?.getElementsByTagName('*').length ?? 0
  }))()`);

  assert.deepEqual(tableDesignerDom.rows, TABLE_ROWS);
  assert.deepEqual(tableDesignerDom.cells, TABLE_ROWS * TABLE_COLUMNS);
  assert.deepEqual(tableRuntimeDom.rows, TABLE_ROWS);
  assert.deepEqual(tableRuntimeDom.cells, TABLE_ROWS * TABLE_COLUMNS);
  assert.deepEqual(treeDesignerDom.treeNodes, TREE_NODES);
  assert.deepEqual(treeRuntimeDom.treeNodes, TREE_NODES);

  console.log(`PATCH_STUDIO_HEAVY_CONTROL_MEASUREMENT=${JSON.stringify({
    contract: 'patch-studio-heavy-control-measurement/0.1',
    table: {
      rows: TABLE_ROWS,
      columns: TABLE_COLUMNS,
      sourceBytes: Buffer.byteLength(tableSource),
      designerPaintMs: tableDesignerPaint,
      runPaintMs: tableRunPaint,
      designerDom: tableDesignerDom,
      runtimeDom: tableRuntimeDom
    },
    tree: {
      roots: TREE_ROOTS,
      childrenPerRoot: TREE_CHILDREN_PER_ROOT,
      nodes: TREE_NODES,
      sourceBytes: Buffer.byteLength(treeSource),
      designerPaintMs: treeDesignerPaint,
      runPaintMs: treeRunPaint,
      designerDom: treeDesignerDom,
      runtimeDom: treeRuntimeDom
    }
  })}`);
});
