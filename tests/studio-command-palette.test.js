import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const palette = fs.readFileSync('web/studio-command-palette.js', 'utf8');
const paletteCss = fs.readFileSync('web/studio-command-palette.css', 'utf8');
const refreshCss = fs.readFileSync('web/site-refresh.css', 'utf8');
const pagesCss = fs.readFileSync('web/site-pages.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio command palette is syntax-valid, discoverable and keyboard-first', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-command-palette.js'], { stdio: 'pipe' });
  assert.match(html, /id="openCommandPalette"/);
  assert.match(html, /id="commandPalette"/);
  assert.match(html, /id="commandPaletteInput"/);
  assert.match(html, /\.\/studio-command-palette\.css/);
  assert.match(html, /\.\/studio-command-palette\.js/);
  assert.match(palette, /event\.key\.toLowerCase\(\) !== 'k'/);
  assert.match(palette, /ArrowDown/);
  assert.match(palette, /ArrowUp/);
  assert.match(palette, /event\.key === 'Enter'/);
  assert.match(palette, /event\.key === 'Escape'/);
});

test('command palette delegates to existing Studio actions without hidden persistent state', () => {
  for (const marker of [
    "'Run project'", "document.querySelector('#run')?.click()",
    "'Build selected target'", "document.querySelector('#build')?.click()",
    "'Focus source editor'", "focus('#code')",
    "'Open Designer'", "click('#tabDesigner')",
    "'Open Recovery'", "click('#recoverProject')",
    "navigate('./docs.html')", "navigate('./downloads.html')", "navigate('./help.html')"
  ]) assert.ok(palette.includes(marker), marker);
  assert.doesNotMatch(palette, /localStorage|sessionStorage|indexedDB/);
});

test('command palette is packaged for offline Studio use', () => {
  assert.match(sw, /'\.\/studio-command-palette\.css'/);
  assert.match(sw, /'\.\/studio-command-palette\.js'/);
  assert.match(paletteCss, /\.command-palette::backdrop/);
  assert.match(paletteCss, /@media \(max-width: 560px\)/);
  assert.match(paletteCss, /@media \(forced-colors: active\)/);
});

test('documentation layout uses balanced responsive grids instead of a squeezed four-plus-one contract row', () => {
  assert.match(refreshCss, /\.docs-contract-grid[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(refreshCss, /@media \(max-width: 1180px\)[\s\S]*\.docs-contract-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(refreshCss, /@media \(max-width: 620px\)[\s\S]*\.docs-contract-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(pagesCss, /grid-template-columns: minmax\(0, 1fr\) minmax\(320px, 400px\)/);
  assert.match(pagesCss, /\.doc-links[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});
