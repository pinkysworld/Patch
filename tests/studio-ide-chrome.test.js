import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('web/index.html', 'utf8');
const style = fs.readFileSync('web/style.css', 'utf8');
const refresh = fs.readFileSync('web/site-refresh.css', 'utf8');
const beta35 = fs.readFileSync('web/beta35-studio.css', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');

test('Studio keeps the beta.36 feature boundary inside the collapsed contracts disclosure', () => {
  const launchpad = html.indexOf('class="studio-launchpad"');
  const strip = html.indexOf('class="beta35-strip"');
  const workspace = html.indexOf('class="workspace"');
  assert.ok(launchpad > 0 && strip > launchpad && strip < workspace);
  assert.match(html, /Current Studio:[^<]*multi-file project bundle v4/);
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

test('Studio brand renders a genuinely rounded P instead of the legacy angular SVG', () => {
  const mark = html.match(/class="brand-mark"[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(mark, /<svg viewBox="0 0 32 32"/);
  assert.match(mark, /M8 6H22V18H13V26H8ZM13 10H18V14H13Z/);
  assert.match(beta35, /\.brand-mark svg \{[\s\S]*?display: none;/);
  assert.match(beta35, /\.brand-mark::before,[\s\S]*\.brand-mark::after/);
  assert.match(beta35, /border-radius: 999px/);
  assert.match(beta35, /border-radius: 0 999px 999px 0/);
  assert.match(beta35, /border-radius: 50%/);
  assert.match(buildSite, /<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">/);
  assert.doesNotMatch(style, /rotate\(/);
  assert.doesNotMatch(refresh, /rotate\(/);
  assert.doesNotMatch(beta35, /rotate\(/);
});

test('Studio status bar stays visible and carries save state plus the Ready chip', () => {
  assert.match(html, /id="saveState"/);
  assert.match(html, /class="status-chip"[^>]*>IR 1\.7 \/ v1\.8/);
  assert.match(html, /<strong>Semantic changes<\/strong>/);
  assert.match(style, /\.status-chip/);
  assert.match(style, /\.statusbar\s*\{[^}]*display:\s*flex/s);
  assert.doesNotMatch(style, /\.statusbar\s*\{[^}]*display:\s*none/s);
  assert.equal((html.match(/id="saveState"/g) || []).length, 1);
});