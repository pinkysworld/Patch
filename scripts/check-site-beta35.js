#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const requireFile = rel => {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing beta.35 generated site file: ${rel}`);
};
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing: ${marker}`);
};

if (pkg.version !== '0.2.0-beta.35') throw new Error(`beta.35 site validator requires package 0.2.0-beta.35, got ${pkg.version}`);

for (const rel of [
  '_site/index.html',
  '_site/language.html',
  '_site/downloads.html',
  '_site/help.html',
  '_site/table-stage1.js',
  '_site/src/webapp.js',
  '_site/src/window-events.js',
  '_site/sw.js'
]) requireFile(rel);

const index = read('_site/index.html');
requireAll('beta.35 Studio page', index, [
  'data-patch-version="0.2.0-beta.35"',
  '0.2 beta.35',
  'list-backed multi-select ListBox is currently browser-only and native builds fail closed',
  './table-stage1.js?v='
]);

const studioAdapter = read('_site/table-stage1.js');
requireAll('Studio multi-select ListBox adapter', studioAdapter, [
  'appListboxSelections',
  'collectListInitials',
  'select.multiple = true',
  'aria-multiselectable',
  'select.selectedOptions',
  'patch-studio-table-changed'
]);

const webapp = read('_site/src/webapp.js');
requireAll('Standalone Web multi-select ListBox contract', webapp, [
  'addWindowListboxMultiselect',
  'hasListBackedListbox',
  'listboxSelections=new Map()',
  "el.multiple=true",
  'selectedOptions',
  "listboxMultiSelectMode: 'list-state-text-list'"
]);

const events = read('_site/src/window-events.js');
requireAll('Window event adapter v0.7', events, [
  "PATCH_WINDOW_EVENTS_VERSION = '0.7'",
  "controlType === 'listbox'",
  "stateType === 'list'",
  'text-list event-local value'
]);

const language = read('_site/language.html');
requireAll('beta.35 Language page', language, [
  'data-patch-version="0.2.0-beta.35"',
  'ListBox selection follows the state type',
  'create list fruits',
  'multi-select in Patch Studio App Preview and Standalone Window Web',
  'Native GUI IR 0.7 does not yet model persistent list state'
]);

const help = read('_site/help.html');
requireAll('beta.35 Help page', help, [
  'data-patch-version="0.2.0-beta.35"',
  'ListBox: single or multi-select',
  'Native boundary:',
  'intended beta.35 fail-closed boundary'
]);

const downloads = read('_site/downloads.html');
requireAll('beta.35 Downloads page', downloads, [
  'data-patch-version="0.2.0-beta.35"',
  'Beta.35 multi-select ListBox boundary',
  'Current native Ready/AOT/offline Window builds do not claim list-backed multi-select ListBox support.',
  'SHA256SUMS',
  'runtime-manifest.json'
]);

const sw = read('_site/sw.js');
requireAll('beta.35 Service Worker', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.35'",
  "url.pathname.includes('/runtimes/')",
  "freshFirst = event.request.mode === 'navigate' || codeAsset || runtimeAsset"
]);

console.log('ok Patch Studio beta.35 ListBox multi-select site surface');
