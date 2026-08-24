import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');
const style = fs.readFileSync('web/style.css', 'utf8');
const refresh = fs.readFileSync('web/site-refresh.css', 'utf8');

test('Studio contracts and quick start stay collapsed until opened', () => {
  assert.match(html, /<details class="studio-launchpad"/);
  assert.doesNotMatch(html, /<details class="studio-launchpad"[^>]*\sopen/);
  assert.match(html, /Contracts and quick start/);
  assert.match(html, /class="studio-snapshot"/);
  assert.match(html, /class="studio-guide"/);
  assert.match(refresh, /\.studio-launchpad-body \{ display: none; \}/);
  assert.match(refresh, /\.studio-launchpad\[open\] \.studio-launchpad-body/);
});

test('Studio editor caret reports line and column without a second project model', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-accessibility.js'], { stdio: 'pipe' });
  assert.match(html, /id="editorCaret"[^>]*aria-live="polite"/);
  assert.match(html, /id="editorTitle"/);
  assert.match(html, /id="code"[^>]*aria-labelledby="editorTitle"/);
  assert.match(style, /\.editor-caret/);
  for (const marker of [
    'installEditorCaret()',
    'caret.textContent = `Ln ${line} · Col ${column}`',
    "window.addEventListener('patch:studio-active-file-changed', update)"
  ]) assert.ok(accessibility.includes(marker), marker);
  const caretFn = accessibility.split('function installEditorCaret()')[1]?.split('function installWorkspaceLayoutV2()')[0] ?? '';
  assert.ok(caretFn.length > 80, 'expected an isolated editor caret helper');
  assert.doesNotMatch(caretFn, /localStorage|sessionStorage|indexedDB/);
});
