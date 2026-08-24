import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const accessibility = fs.readFileSync('web/studio-accessibility.js', 'utf8');
const css = fs.readFileSync('web/studio-accessibility.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio accessibility module is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-accessibility.js'], { stdio: 'pipe' });
});

test('Studio has a keyboard-visible skip link and labelled editor', () => {
  assert.match(html, /id="skipToEditor"[^>]*href="#code"/);
  assert.match(html, /id="editorTitle"/);
  assert.match(html, /id="code"[^>]*aria-labelledby="editorTitle"/);
  assert.match(html, /id="editorCaret"/);
  assert.match(css, /\.skip-link/);
  assert.match(css, /\.skip-link:focus-visible/);
});

test('main result views expose a complete ARIA tab contract', () => {
  assert.match(html, /id="resultTabs"[^>]*role="tablist"[^>]*aria-label="Result views"/);
  const tabs = [
    ['tabDesigner', 'designer'],
    ['tabApp', 'app'],
    ['tabOutput', 'output'],
    ['tabChanges', 'changes'],
    ['tabIr', 'ir']
  ];
  for (const [tabId, panelId] of tabs) {
    assert.match(html, new RegExp(`id="${tabId}"[^>]*role="tab"[^>]*aria-controls="${panelId}"`));
    assert.match(html, new RegExp(`id="${panelId}"[^>]*role="tabpanel"[^>]*aria-labelledby="${tabId}"`));
    assert.match(html, new RegExp(`id="${panelId}"[^>]*tabindex="0"`));
  }
  assert.match(html, /id="tabDesigner"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(html, /id="tabApp"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
});

test('result tabs support standard horizontal keyboard navigation', () => {
  for (const marker of ["event.key === 'ArrowRight'", "event.key === 'ArrowLeft'", "event.key === 'Home'", "event.key === 'End'", 'next.focus()', 'next.click()', 'syncResultTabs()']) assert.ok(accessibility.includes(marker), marker);
  assert.match(accessibility, /attributeFilter: \['class'\]/);
});

test('Studio keyboard shortcuts use Enter without browser bookmark conflicts', () => {
  assert.match(html, /id="run"[^>]*aria-keyshortcuts="Control\+Enter Meta\+Enter"/);
  assert.match(html, /id="build"[^>]*aria-keyshortcuts="Control\+Shift\+Enter Meta\+Shift\+Enter"/);
  assert.match(accessibility, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(accessibility, /event\.key !== 'Enter'/);
  assert.match(accessibility, /if \(event\.shiftKey\) buildButton\?\.click\(\)/);
  assert.match(accessibility, /else runButton\?\.click\(\)/);
  assert.match(accessibility, /hasOpenDialog\(\)/);
  assert.ok(!html.includes('Control+Shift+B'));
});

test('Workspace Layout v2 is keyboard and pointer resizable with one local IDE-only preference', () => {
  for (const marker of [
    'installWorkspaceLayoutV2()',
    "storageKey = 'patchStudio.workspaceSplit.v2'",
    "handle.setAttribute('role', 'separator')",
    "handle.setAttribute('aria-orientation', 'horizontal')",
    "handle.setAttribute('aria-valuemin', String(minPercent))",
    "handle.setAttribute('aria-valuemax', String(Math.max(minPercent, maxPercent)))",
    "event.key === 'ArrowUp'",
    "event.key === 'ArrowDown'",
    "event.key === 'Home'",
    "handle.addEventListener('pointerdown'",
    "handle.addEventListener('pointermove'",
    "resetWorkspaceLayout",
    "localStorage.removeItem(storageKey)"
  ]) assert.ok(accessibility.includes(marker), marker);
  assert.doesNotMatch(accessibility, /patchStudio\.project\.v3|patchStudio\.recovery\.v1/);
});

test('Workspace Layout v2 preserves editor and Designer minimums and falls back on narrow screens', () => {
  for (const marker of [
    'minSource = 320',
    'minResult = 480',
    "window.matchMedia('(max-width: 760px)')",
    "--workspace-source-height",
    "--workspace-result-height",
    'min-height: 320px',
    'min-height: 480px',
    '@media (max-width: 760px)',
    '.workspace-layout-bar { display: none; }'
  ]) assert.ok(accessibility.includes(marker), marker);
  assert.match(accessibility, /\.editor-pane textarea \{ height: calc\(100% - 42px\); min-height: 0; resize: none; \}/);
  assert.match(accessibility, /\.designer-surface[\s\S]*min-height: 0/);
});

test('save diagnostics and native build states are announced without making output noisy', () => {
  assert.match(html, /id="saveState"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /id="diagnosticsState"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /id="nativeBuildStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.ok(!/id="output"[^>]*aria-live=/.test(html));
});

test('accessibility stylesheet covers focus touch reduced motion forced colors and narrow layouts', () => {
  for (const marker of [':focus-visible','@media (pointer: coarse)','min-height: 40px !important','@media (pointer: coarse) and (max-width: 760px)','@media (prefers-reduced-motion: reduce)','@media (forced-colors: active)','@media (max-width: 820px)','@media (max-width: 560px)','overscroll-behavior-inline: contain']) assert.ok(css.includes(marker), marker);
});

test('PWA cache includes accessibility JS and CSS in the content-addressed cache', () => {
  assert.match(sw, /const REVISION = '__PATCH_SITE_REV__'/);
  assert.match(sw, /const CACHE_PREFIX = 'patch-studio-'/);
  assert.match(sw, /const CACHE = `\$\{CACHE_PREFIX\}\$\{REVISION\}`/);
  assert.match(sw, /\.map\(versioned\)/);
  for (const marker of ['./studio-accessibility.js','./studio-accessibility.css']) assert.ok(sw.includes(`'${marker}'`), marker);
});
