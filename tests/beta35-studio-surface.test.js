import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const index = fs.readFileSync('web/index.html', 'utf8');
const moduleSource = fs.readFileSync('web/beta35-studio.js', 'utf8');
const css = fs.readFileSync('web/beta35-studio.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');

test('beta35 multi-select workflow remains visible after current native v1.5 parity lands', () => {
  assert.match(index, /value="sliderWindow">Slider app<\/option>/i);
  for (const marker of ['Current Studio:', 'multi-file project bundle v4', 'source-backed Designer', 'multi-select ListBox', 'Table', 'TreeView', 'Tabs']) {
    assert.ok(index.includes(marker), marker);
  }
  assert.match(index, /Native GUI IR 1\.8 \/ payload v18 \/ runtime v1\.9/i);
  assert.match(index, /Older versioned contracts remain compatibility lines/i);
  assert.match(index, /Persistent application state still changes only through explicit <b>change<\/b>/i);
  assert.match(index, /href="#designer"[^>]*>Designer ↓<\/a>/);
  assert.ok(index.includes('./beta35-studio.css'));
  assert.ok(index.includes('./beta35-studio.js'));
});

test('beta35 sample uses the canonical Studio DOM synchronization path', () => {
  execFileSync(process.execPath, ['--check', 'web/beta35-studio.js']);
  for (const marker of [
    "option.value = 'listboxMultiWindow'",
    "option.textContent = 'Multi-select ListBox'",
    'create list fruits = ["Banana", "Mango"]',
    "projectKind.value = 'window'",
    "new Event('input', { bubbles: true })",
    "new Event('change', { bubbles: true })",
    'stopImmediatePropagation()',
    "document.querySelector('#tabDesigner')?.click()"
  ]) assert.ok(moduleSource.includes(marker), marker);
});

test('selected examples can be explicitly reloaded and fresh Studio opens Workshop Desk', () => {
  for (const marker of [
    "loadButton.id = 'loadSample'",
    "loadButton.textContent = 'Load example'",
    "sample.dispatchEvent(new Event('change', { bubbles: true }))",
    "localStorage.getItem('patchStudio.project')",
    "sample.value === 'workshopDesk'",
    'queueMicrotask(loadSelectedSample)'
  ]) assert.ok(moduleSource.includes(marker), marker);
});

test('beta35 Studio polish remains keyboard responsive and ships offline', () => {
  for (const marker of [
    '.studio-jump:focus-visible',
    '#designer { scroll-margin-top: 12px; }',
    '@media (max-width: 920px)'
  ]) assert.ok(css.includes(marker), marker);

  for (const asset of ['./beta35-studio.css', './beta35-studio.js']) assert.ok(sw.includes(asset), asset);
  for (const asset of ['beta35-studio.css', 'beta35-studio.js']) assert.ok(buildSite.includes(asset), asset);
});
