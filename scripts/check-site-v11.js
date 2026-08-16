#!/usr/bin/env node
import fs from 'node:fs';

const read = file => fs.readFileSync(`_site/${file}`, 'utf8');
const index = read('index.html');
const nativeBuild = read('native-build.js');
const downloads = read('downloads.html');
const docs = read('docs.html');

function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`Studio Ready v1.1 site check failed: ${label} is missing '${marker}'.`);
}
function rejectText(text, marker, label) {
  if (text.includes(marker)) throw new Error(`Studio Ready v1.1 site check failed: ${label} still contains '${marker}'.`);
}

requireText(index, 'token-free Ready/offline Windows, macOS and Linux apps', 'Studio compatibility strip');
requireText(index, 'Native GUI IR 1.1', 'Studio native status');
requireText(index, 'payload v10', 'Studio native status');
requireText(index, 'runtime v1.1', 'Studio native status');
rejectText(index, 'currently browser-only and native builds fail closed', 'Studio index');

requireText(nativeBuild, 'buildNativeGuiIRV11 as buildNativeGuiIR', 'browser native builder');
requireText(nativeBuild, 'PATCH_SEALED_NATIVE_GUI_LIST_VERSION', 'browser native builder');
rejectText(nativeBuild, 'PATCH_SEALED_NATIVE_GUI_TABLE_VERSION', 'browser native builder');

requireText(downloads, 'Native GUI IR 1.1 / payload v10 / runtime v1.1', 'Downloads current Window contract');
requireText(downloads, 'multi-select ListBox', 'Downloads multi-select evidence');
requireText(downloads, 'Payload <strong>v9</strong> / runtime <strong>v1.0</strong> remains a frozen', 'Downloads compatibility line');

requireText(docs, 'docs/NATIVE_LIST_STATE.md', 'Documentation index');
requireText(docs, 'payload v10/runtime v1.1', 'Documentation current list contract');

console.log('Patch Studio Ready v1.1 public-site surface validated.');
