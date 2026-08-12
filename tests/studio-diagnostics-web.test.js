import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const browser = fs.readFileSync('web/studio-diagnostics.js', 'utf8');
const css = fs.readFileSync('web/studio-diagnostics.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio diagnostics modules are valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', 'src/studio-diagnostics.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/studio-diagnostics.js'], { stdio: 'pipe' });
});

test('Studio exposes local copy and report controls with live status', () => {
  for (const id of ['copyDiagnostics','downloadDiagnostics','diagnosticsState']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /class="support-actions"/);
  assert.match(html, /data-patch-version="0\.2\.0-beta\.32"/);
  assert.match(html, /Diagnostics stay local\./);
  assert.ok(html.indexOf('./studio-diagnostics.js') > html.indexOf('./playground.js'));
});

test('browser diagnostics report compiler and PWA state without an upload path', () => {
  for (const marker of [
    "from '../src/compiler.js'",
    "from '../src/studio-project.js'",
    "from '../src/studio-diagnostics.js'",
    'navigator.userAgent','navigator.language','navigator.onLine','serviceWorkerControlled',
    "window.addEventListener('error'", "window.addEventListener('unhandledrejection'", 'MutationObserver',
    'navigator.clipboard','document.execCommand', '.patchreport', 'Nothing uploaded'
  ]) assert.ok(browser.includes(marker), marker);
  assert.doesNotMatch(browser, /\bfetch\s*\(/);
  assert.doesNotMatch(browser, /XMLHttpRequest/);
});

test('diagnostics controls stay compact and responsive', () => {
  assert.match(css, /\.support-actions/);
  assert.match(css, /#diagnosticsState/);
  assert.match(css, /\.diagnostics-copy-fallback/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

test('PWA cache includes all diagnostics assets in the content-addressed cache', () => {
  assert.match(sw, /const REVISION = '__PATCH_SITE_REV__'/);
  assert.match(sw, /const CACHE = `patch-studio-\$\{REVISION\}`/);
  assert.match(sw, /\.map\(versioned\)/);
  for (const marker of ['./studio-diagnostics.js','./studio-diagnostics.css','../src/studio-diagnostics.js']) {
    assert.ok(sw.includes(`'${marker}'`), marker);
  }
});
