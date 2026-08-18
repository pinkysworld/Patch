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
  '_site/beta35-studio.js',
  '_site/table-stage1.js',
  '_site/src/webapp.js',
  '_site/src/window-events.js',
  '_site/src/native-gui-ir-v12.js',
  '_site/src/sealed-native-gui-v12.js',
  '_site/sw.js'
]) requireFile(rel);

// beta.35 introduced the browser interaction contract. Native parity is additive
// post-beta.35 capability, so current product surfaces must preserve the semantic
// mutation boundary while advertising the newer versioned native contract.
const index = read('_site/index.html');
requireAll('beta.35+ Studio page', index, [
  'data-patch-version="0.2.0-beta.35"',
  '0.2 beta.35+',
  'list-backed multi-select ListBox and hierarchical TreeView',
  'supported native Ready/offline Windows, macOS and Linux paths',
  'explicit <b>change</b>',
  './beta35-studio.js?v=',
  './table-stage1.js?v='
]);
if (index.includes('list-backed multi-select ListBox is currently browser-only and native builds fail closed')) {
  throw new Error('beta.35 Studio page regressed to the obsolete browser-only native boundary.');
}

const beta35Studio = read('_site/beta35-studio.js');
requireAll('beta.35 Studio example module', beta35Studio, [
  "option.value = 'listboxMultiWindow'",
  "option.textContent = 'Multi-select ListBox'",
  'create list fruits = ["Banana", "Mango"]',
  "document.querySelector('#tabDesigner')?.click()"
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
requireAll('Window event adapter current contract', events, [
  "PATCH_WINDOW_EVENTS_VERSION = '0.8'",
  "controlType === 'listbox'",
  "stateType === 'list'",
  'text-list event-local value'
]);

const nativeGuiV12 = read('_site/src/native-gui-ir-v12.js');
requireAll('Native GUI IR 1.2 TreeView extension', nativeGuiV12, [
  "PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'",
  'buildNativeGuiIRV12',
  "control.type = 'tree'"
]);
const sealedV12 = read('_site/src/sealed-native-gui-v12.js');
requireAll('sealed payload v12 TreeView contract', sealedV12, [
  'PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12',
  'sealNativeGuiRuntimeV12',
  'inspectNativeGuiTreesV12'
]);

const language = read('_site/language.html');
requireAll('beta.35 Language page', language, [
  'data-patch-version="0.2.0-beta.35"',
  'ListBox selection follows the state type',
  'create list fruits',
  'multi-select in Patch Studio App Preview and Standalone Window Web'
]);

const help = read('_site/help.html');
requireAll('beta.35 Help page', help, [
  'data-patch-version="0.2.0-beta.35"',
  'ListBox: single or multi-select',
  'Ready/no-token',
  'Offline compiler'
]);

const downloads = read('_site/downloads.html');
requireAll('beta.35+ Downloads page', downloads, [
  'data-patch-version="0.2.0-beta.35"',
  'Native GUI IR <strong>1.2</strong>',
  'payload <strong>v12</strong>',
  'runtime <strong>v1.3</strong>',
  'hierarchical TreeView',
  'SHA256SUMS',
  'runtime-manifest.json'
]);
if (downloads.includes('Current native Ready/AOT/offline Window builds do not claim list-backed multi-select ListBox support.')) {
  throw new Error('Downloads page regressed to the obsolete native ListBox boundary.');
}

const sw = read('_site/sw.js');
requireAll('beta.35 Service Worker', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.35'",
  "url.pathname.includes('/runtimes/')",
  "freshFirst = event.request.mode === 'navigate' || codeAsset || runtimeAsset",
  '../src/native-gui-ir-v12.js',
  '../src/sealed-native-gui-v12.js'
]);

console.log('ok Patch Studio beta.35+ browser/native parity site surface');
