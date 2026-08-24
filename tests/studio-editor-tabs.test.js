import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const tree = fs.readFileSync('web/studio-outline.js', 'utf8');
const css = fs.readFileSync('web/studio-outline.css', 'utf8');
const help = fs.readFileSync('web/help.html', 'utf8');

test('Studio editor tabs switch project files without a second document model', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-outline.js'], { stdio: 'pipe' });
  assert.match(html, /id="editorTabs"[^>]*role="tablist"/);
  assert.match(html, /id="editorParseStatus"/);
  assert.match(html, /id="editorTitle"/);
  assert.match(tree, /function installEditorTabs\(\)/);
  assert.match(tree, /function renderEditorTabs\(/);
  assert.match(tree, /activateStudioProjectFile/);
  assert.match(tree, /PageDown/);
  assert.doesNotMatch(tree.split('function installEditorTabs()')[1]?.split('function hasOpenDialog()')[0] ?? '', /localStorage|sessionStorage|indexedDB/);
});

test('Studio parse status uses the live editor source and stays transient', () => {
  assert.match(tree, /function renderParseStatus\(\)/);
  assert.match(tree, /el\.textContent = 'Parsed'/);
  assert.match(tree, /el\.dataset\.state = 'invalid'/);
  const helper = tree.split('function renderParseStatus()')[1]?.split('function renderFile(')[0] ?? '';
  assert.ok(helper.length > 80, 'expected an isolated parse-status helper');
  assert.doesNotMatch(helper, /localStorage|sessionStorage|indexedDB/);
  assert.match(help, /editor tabs/);
  assert.match(help, /Parsed/);
});

test('editor tab chrome is keyboard visible and marks the entry file in text', () => {
  assert.match(css, /\.editor-tabs/);
  assert.match(css, /\.editor-tab\[aria-selected="true"\]/);
  assert.match(css, /\.editor-tab:focus-visible/);
  assert.match(css, /\.editor-tab-entry/);
  assert.match(tree, /mark\.textContent = 'entry'/);
});
