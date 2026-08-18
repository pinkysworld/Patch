#!/usr/bin/env node
import fs from 'node:fs';

const read = file => fs.readFileSync(`_site/${file}`, 'utf8');
const index = read('index.html');
const nativeBuild = read('native-build.js');
const docs = read('docs.html');
const downloads = read('downloads.html');

function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`Studio Ready v1.3 site check failed: ${label} is missing '${marker}'.`);
}
function rejectText(text, marker, label) {
  if (text.includes(marker)) throw new Error(`Studio Ready v1.3 site check failed: ${label} still contains '${marker}'.`);
}

requireText(index, 'Ready/offline Windows, macOS and Linux', 'Studio compatibility strip');
requireText(index, 'Native GUI IR 1.2', 'Studio native status');
requireText(index, 'payload v12', 'Studio native status');
requireText(index, 'runtime v1.3', 'Studio native status');
requireText(index, 'hierarchical TreeView', 'Studio TreeView status');
rejectText(index, 'currently browser-only and native builds fail closed', 'Studio index');

requireText(nativeBuild, 'buildNativeGuiIRV12 as buildNativeGuiIR', 'browser native builder');
requireText(nativeBuild, 'PATCH_SEALED_NATIVE_GUI_TREE_VERSION', 'browser native builder');
requireText(nativeBuild, 'sealNativeGuiRuntimeV12', 'browser native builder');
requireText(nativeBuild, 'allowTree: true', 'browser native builder');
rejectText(nativeBuild, 'PATCH_SEALED_NATIVE_GUI_MENU_VERSION', 'browser native builder current tier');

requireText(docs, 'docs/NATIVE_LIST_STATE.md', 'Documentation index');
requireText(docs, 'Native GUI IR 1.2 / payload v12 / runtime v1.3', 'Documentation current native contract');
requireText(downloads, 'payload <strong>v12</strong>', 'Downloads current payload');
requireText(downloads, 'runtime <strong>v1.3</strong>', 'Downloads current runtime');
requireText(downloads, 'hierarchical TreeView', 'Downloads TreeView support');

console.log('Patch Studio Ready v1.3 public-site runtime surface validated.');
