import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

test('Patch Studio stays responsive in Chrome and can run the default Window app', { timeout: 20000 }, async t => {
  const chrome = findChrome();
  if (!chrome) {
    if (process.env.CI) assert.fail('Chrome/Chromium is required for the Patch Studio browser startup gate');
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-studio-chrome-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));

  const url = `http://127.0.0.1:${address.port}/web/index.html?patch-smoke=1`;
  const result = spawnSync(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=4000',
    '--dump-dom',
    url
  ], {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 16 * 1024 * 1024
  });

  assert.equal(result.error?.code, undefined, `Chrome startup failed: ${result.error?.message ?? ''}`);
  assert.equal(result.status, 0, `Chrome exited with ${result.status}: ${result.stderr}`);
  assert.match(result.stdout, /data-patch-studio-smoke="ready"/, `Studio did not reach the responsive Run state. Chrome stderr:\n${result.stderr}`);
  assert.match(result.stdout, /class="patch-window"/, 'Run smoke test did not render the default Patch Window app');
});
