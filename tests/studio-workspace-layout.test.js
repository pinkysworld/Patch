import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');
const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('Patch Studio puts the result and Designer workspace below the editor at full width', () => {
  assert.ok(html.indexOf('class="pane editor-pane"') < html.indexOf('class="pane result-pane"'));
  assert.match(style, /\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(style, /\.result-pane\s*\{[^}]*min-height:\s*660px/s);
  assert.match(style, /\.result-pane \.designer-surface[\s\S]*?min-height:\s*575px/);
  assert.match(style, /\.result-pane \.patch-window\s*\{[^}]*920px/s);
  assert.match(style, /\.editor-pane textarea\s*\{[^}]*42vh/s);
});

test('draft PRs stay quiet and ready PRs use one canonical Patch CI matrix job', () => {
  assert.ok(ci.includes("github.event.pull_request.draft == false"));
  assert.ok(ci.includes("fromJSON('[\"ubuntu-latest\"]')"));
  assert.ok(ci.includes("fromJSON('[\"24\"]')"));
  assert.ok(ci.includes("fromJSON('[\"ubuntu-latest\",\"windows-latest\",\"macos-latest\"]')"));
  assert.ok(ci.includes("fromJSON('[\"22\",\"24\"]')"));
});
