import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { listDesignerWindows, updateDesignerWindow } from '../src/designer.js';

const moduleSource = fs.readFileSync('web/form-window-resize.js', 'utf8');
const css = fs.readFileSync('web/form-window-resize.css', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');

test('form resize browser module is syntactically valid and loaded by Studio', () => {
  execFileSync(process.execPath, ['--check', 'web/form-window-resize.js'], { stdio: 'pipe' });
  assert.match(html, /src="\.\/form-window-resize\.js"/);
  assert.match(html, /href="\.\/form-window-resize\.css"/);
});

test('direct form resize supports pointer and keyboard editing with explicit minimums', () => {
  for (const marker of [
    "const MIN_FORM_WIDTH = 240",
    "const MIN_FORM_HEIGHT = 160",
    "canvas.addEventListener('pointerdown'",
    "window.addEventListener('pointermove'",
    "window.addEventListener('pointerup'",
    "window.addEventListener('pointercancel'",
    "'ArrowLeft'", "'ArrowRight'", "'ArrowUp'", "'ArrowDown'",
    'event.shiftKey ? 20 : 10',
    'patch:form-resized'
  ]) assert.ok(moduleSource.includes(marker), marker);
});

test('form resize writes width and height back into Patch source', () => {
  const source = 'window "Main" as main size 640, 420:\n  text "Hello"\n';
  const next = updateDesignerWindow(source, 0, { width: 910, height: 610 });
  const [form] = listDesignerWindows(next);
  assert.equal(form.width, 910);
  assert.equal(form.height, 610);
  assert.match(next, /window "Main" as main size 910, 610:/);
});

test('oversized forms are not clamped back to the Designer viewport', () => {
  assert.match(css, /max-width: none !important/);
  assert.match(css, /flex: 0 0 auto/);
  assert.match(css, /margin-left: 12px/);
  assert.match(moduleSource, /shell\.style\.maxWidth = 'none'/);
  assert.match(moduleSource, /handle\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/);
});

test('form resize grip remains keyboard focusable and touch friendly', () => {
  assert.match(moduleSource, /document\.createElement\('button'\)/);
  assert.match(moduleSource, /aria-label/);
  assert.match(css, /\.patch-window-resize-handle:focus-visible/);
  assert.match(css, /@media \(pointer: coarse\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
});
