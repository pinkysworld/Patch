#!/usr/bin/env node
import fs from 'node:fs';

const read = file => fs.readFileSync(`_site/${file}`, 'utf8');
const index = read('index.html');
const nativeBuild = read('native-build.js');
const docs = read('docs.html');
const downloads = read('downloads.html');
const gui12 = read('src/native-gui-ir-v12.js');
const sealed12 = read('src/sealed-native-gui-v12.js');

function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`Frozen v12 compatibility site check failed: ${label} is missing '${marker}'.`);
}
function rejectText(text, marker, label) {
  if (text.includes(marker)) throw new Error(`Frozen v12 compatibility site check failed: ${label} still contains obsolete current-product text '${marker}'.`);
}

requireText(index, 'Native GUI IR 1.3', 'Studio current native status');
requireText(index, 'payload v13', 'Studio current native status');
requireText(index, 'runtime v1.4', 'Studio current native status');
requireText(index, 'payload v12 / runtime v1.3 compatibility line remains Slider fail-closed', 'Studio frozen compatibility status');

requireText(nativeBuild, 'buildNativeGuiIRV13 as buildNativeGuiIR', 'browser current native builder');
requireText(nativeBuild, 'PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION', 'browser current native builder');
requireText(nativeBuild, 'sealNativeGuiRuntimeV13', 'browser current native builder');
requireText(nativeBuild, 'allowSlider: true', 'browser current native builder');

requireText(gui12, "PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'", 'frozen Native GUI IR 1.2 module');
requireText(gui12, 'buildNativeGuiIRV12', 'frozen Native GUI IR 1.2 module');
requireText(sealed12, 'PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12', 'frozen payload v12 module');
requireText(sealed12, 'sealNativeGuiRuntimeV12', 'frozen payload v12 module');

requireText(docs, 'IR 1.2 / payload v12 / runtime v1.3 frozen', 'Documentation compatibility card');
requireText(downloads, 'Native GUI IR 1.2 / payload v12 / runtime v1.3', 'Downloads frozen compatibility line');
requireText(downloads, 'Slider fail-closed', 'Downloads frozen compatibility behavior');
requireText(downloads, 'payload <strong>v13</strong>', 'Downloads current payload');
requireText(downloads, 'runtime <strong>v1.4</strong>', 'Downloads current runtime');

rejectText(index, 'Slider Stage 1 is browser-only until a later versioned native contract adds parity', 'Studio index');
rejectText(downloads, 'Native Slider parity requires a future versioned native GUI contract', 'Downloads page');

console.log('Patch Studio frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 compatibility surface validated alongside current v1.4.');
