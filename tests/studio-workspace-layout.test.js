import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../web/workspace-layout.css', import.meta.url), 'utf8');
const buildSite = fs.readFileSync(new URL('../scripts/build-site.js', import.meta.url), 'utf8');
const serviceWorker = fs.readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8');
const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('Patch Studio puts the result and Designer workspace below the editor at full width', () => {
  assert.ok(html.indexOf('class="pane editor-pane"') < html.indexOf('class="pane result-pane"'));
  assert.match(html, /href="\.\/workspace-layout\.css"/);
  assert.match(layout, /\.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(layout, /\.result-pane\s*\{[^}]*min-height:\s*660px/s);
  assert.match(layout, /\.result-pane \.designer-surface[^}]*min-height:\s*575px/s);
  assert.match(layout, /\.result-pane \.patch-window[^}]*920px/s);
});

test('generated Studio and offline shell include the workspace layout', () => {
  assert.match(buildSite, /'workspace-layout\.css'/);
  assert.match(serviceWorker, /'\.\/workspace-layout\.css'/);
});

test('draft PRs stay quiet and ready PRs use one canonical Patch CI matrix job', () => {
  assert.match(ci, /github\.event\.pull_request\.draft == false/);
  assert.match(ci, /github\.event_name == 'pull_request'.*\[\\"ubuntu-latest\\"\]/);
  assert.match(ci, /github\.event_name == 'pull_request'.*\[\\"24\\"\]/);
  assert.match(ci, /\[\\"ubuntu-latest\\",\\"windows-latest\\",\\"macos-latest\\"\]/);
  assert.match(ci, /\[\\"22\\",\\"24\\"\]/);
});
