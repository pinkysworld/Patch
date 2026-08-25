import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const style = fs.readFileSync('web/style.css', 'utf8');
const refresh = fs.readFileSync('web/site-refresh.css', 'utf8');

test('Studio keeps the beta.35 feature boundary inside the collapsed contracts disclosure', () => {
  const launchpad = html.indexOf('class="studio-launchpad"');
  const strip = html.indexOf('class="beta35-strip"');
  const workspace = html.indexOf('class="workspace"');
  assert.ok(launchpad > 0 && strip > launchpad && strip < workspace);
  assert.match(html, /Current Studio:[^<]*multi-file project bundle v3/);
  assert.match(refresh, /\.studio-launchpad \.beta35-strip/);
});

test('Studio empty panes use titled cards with keyboard hints', () => {
  assert.match(html, /<div class="empty-preview"><strong>Designer<\/strong>/);
  assert.match(html, /Window projects appear here while you edit\./);
  assert.match(html, /<div class="empty-preview"><strong>App preview<\/strong>/);
  assert.match(html, /Run a window project to preview it here\./);
  assert.match(html, /class="empty-preview-hint"/);
  assert.match(style, /\.empty-preview-hint/);
  assert.match(style, /border: 1px dashed var\(--border-strong\)/);
});

test('Studio brand mark is a square geometric P with no rotation', () => {
  assert.match(html, /class="brand-mark"[^>]*>\s*<svg /);
  assert.doesNotMatch(html, /class="brand-mark"[^>]*>P</);
  assert.doesNotMatch(style, /rotate\(/);
  assert.doesNotMatch(refresh, /rotate\(/);
  assert.match(style, /\.brand-mark[\s\S]*?transform:\s*none/);
  assert.match(refresh, /\.brand-mark[\s\S]*?transform:\s*none/);
  assert.match(style, /\.brand-mark svg/);
});

test('Studio status bar stays visible and carries save state plus the Ready chip', () => {
  assert.match(html, /id="saveState"/);
  assert.match(html, /class="status-chip"[^>]*>IR 1\.3 \/ v1\.4/);
  assert.match(html, /<strong>Semantic changes<\/strong>/);
  assert.match(style, /\.status-chip/);
  assert.match(style, /\.statusbar\s*\{[^}]*display:\s*flex/s);
  assert.doesNotMatch(style, /\.statusbar\s*\{[^}]*display:\s*none/s);
  assert.equal((html.match(/id="saveState"/g) || []).length, 1);
});
