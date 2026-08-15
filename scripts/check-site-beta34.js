#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const requireFile = rel => {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing beta.34 generated site file: ${rel}`);
};
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing: ${marker}`);
};

if (pkg.version !== '0.2.0-beta.34') throw new Error(`beta.34 site validator requires package 0.2.0-beta.34, got ${pkg.version}`);

for (const rel of [
  '_site/runtime-integrity.js',
  '_site/studio-dom-sync.js',
  '_site/downloads.html',
  '_site/src/native-gui-ir-v08.js'
]) requireFile(rel);

const index = read('_site/index.html');
requireAll('beta.34 Studio page', index, [
  'data-patch-version="0.2.0-beta.34"',
  '0.2 beta.34',
  './runtime-integrity.js?v=',
  './native-build.js?v=',
  './studio-dom-sync.js?v='
]);
if (index.indexOf('./runtime-integrity.js?v=') > index.indexOf('./native-build.js?v=')) {
  throw new Error('Runtime integrity must load before native-build.js.');
}
if (index.indexOf('./studio-dom-sync.js?v=') < index.indexOf('./table-stage1.js?v=')) {
  throw new Error('Studio DOM synchronization must load after source-mutating Designer modules.');
}

const integrity = read('_site/runtime-integrity.js');
requireAll('runtime integrity module', integrity, [
  './runtimes/runtime-manifest.json',
  'patch-windows-native-gui-runtime.exe',
  'patch-linux-native-gui-runtime.bin',
  'patch-macos-native-gui-runtime.bin',
  'patch-windows-console-runtime.bin',
  'patch-macos-console-runtime.bin',
  'patch-linux-console-runtime.bin',
  'patch-windows-window-runtime.zip',
  'patch-macos-window-runtime.zip',
  'patch-linux-window-runtime.zip',
  "crypto.subtle.digest('SHA-256'",
  'failed SHA-256 verification'
]);

const sync = read('_site/studio-dom-sync.js');
requireAll('Studio DOM synchronization module', sync, [
  "document.querySelector('#code')",
  "document.querySelector('#projectKind')",
  'queueMicrotask',
  "new Event('input'",
  "new Event('change'"
]);

const sw = read('_site/sw.js');
requireAll('beta.34 service worker', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.34'",
  "'./runtime-integrity.js'",
  "'./studio-dom-sync.js'",
  "url.pathname.includes('/runtimes/')",
  "freshFirst = event.request.mode === 'navigate' || codeAsset || runtimeAsset"
]);

const downloads = read('_site/downloads.html');
requireAll('beta.34 Downloads page', downloads, [
  'data-patch-version="0.2.0-beta.34"',
  'SHA256SUMS',
  'Get-FileHash',
  'runtime-manifest.json',
  'native-win32-runtime-v1.0',
  'native-macos-runtime-v1.0',
  'native-linux-runtime-v1.0'
]);

console.log('ok Patch Studio beta.34 generated site hardening surface');
