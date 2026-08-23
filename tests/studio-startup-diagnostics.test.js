import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const bootstrap = fs.readFileSync('web/studio-bootstrap.js', 'utf8');
const diagnostics = fs.readFileSync('web/studio-diagnostics.js', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');

test('startup diagnostics are installed before the Studio module graph', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-bootstrap.js'], { stdio: 'pipe' });
  assert.ok(bootstrap.indexOf('installStartupDiagnostics();') < bootstrap.indexOf('installDesignerMutationGuard();'));
  assert.ok(html.indexOf('./studio-bootstrap.js') < html.indexOf('type="module" src="./runtime-integrity.js"'));
  assert.match(bootstrap, /window\.__patchStudioStartupDiagnostics/);
});

test('bootstrap catches early failures and fails closed when initialization never completes', () => {
  for (const marker of [
    "window.addEventListener('error'",
    "window.addEventListener('unhandledrejection'",
    "window.addEventListener('patch:studio-ready'",
    "record('module-load'",
    "record('startup-timeout'",
    'startupDeadlineMs = 10_000',
    "root.dataset.patchStudioStartup = 'booting'",
    "root.dataset.patchStudioStartup = ready ? 'degraded' : 'failed'"
  ]) assert.ok(bootstrap.includes(marker), marker);
});

test('startup failure surface is visible, non-blocking, copyable and privacy-redacted', () => {
  for (const marker of [
    "surface.id = 'startupDiagnostics'",
    "surface.setAttribute('role', 'status')",
    "surface.setAttribute('aria-live', 'polite')",
    "copyButton.id = 'copyStartupDiagnostics'",
    "dismiss.id = 'dismissStartupDiagnostics'",
    'Patch source omitted',
    '[redacted-token]',
    '[redacted-email]',
    '[redacted-user]',
    'sanitizeAsset(asset)',
    "raw.split(/[?#]/, 1)[0]"
  ]) assert.ok(bootstrap.includes(marker), marker);
  assert.doesNotMatch(bootstrap, /\bfetch\s*\(/);
  assert.doesNotMatch(bootstrap, /XMLHttpRequest/);
  assert.doesNotMatch(bootstrap, /\balert\s*\(/);
});

test('last Studio module emits the canonical ready handshake', () => {
  assert.match(accessibility, /announceStudioReady\(\)/);
  assert.match(accessibility, /new CustomEvent\('patch:studio-ready'/);
  assert.match(accessibility, /module: 'studio-accessibility'/);
});

test('normal diagnostic reports adopt already-captured bootstrap failures', () => {
  for (const marker of [
    'adoptStartupDiagnostics()',
    'window.__patchStudioStartupDiagnostics',
    'startup.snapshot()',
    "window.addEventListener('patch:studio-startup-diagnostic'",
    'rememberStartupEntry(event.detail)',
    '`startup-${String(entry.type'
  ]) assert.ok(diagnostics.includes(marker), marker);
});

test('production Chrome gate exercises the synthetic early-diagnostic path', () => {
  assert.match(bootstrap, /startup-diagnostic-smoke/);
  assert.match(bootstrap, /patch-startup-smoke-secret/);
  assert.match(pages, /PATCH_STUDIO_SMOKE_URL: https:\/\/minh\.systems\/Patch\/\?startup-diagnostic-smoke=1/);
});
