#!/usr/bin/env node
import fs from 'node:fs';

const read = file => fs.readFileSync(`_site/${file}`, 'utf8');
const index = read('index.html');
const nativeBuild = read('native-build.js');
const docs = read('docs.html');
const downloads = read('downloads.html');
const current = read('src/native-current-contract.js');
const frozen = read('src/native-frozen-contract.js');
const gui12 = read('src/native-gui-ir-v12.js');
const sealed12 = read('src/sealed-native-gui-v12.js');

function requireText(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`Frozen v12 compatibility site check failed: ${label} is missing '${marker}'.`);
}
function rejectText(text, marker, label) {
  if (text.includes(marker)) throw new Error(`Frozen v12 compatibility site check failed: ${label} still contains obsolete current-product text '${marker}'.`);
}

// The public Ready surface is beta.36/current. This compatibility gate must never
// force the current copy backwards merely to prove that the frozen TreeView line
// remains packaged and documented.
requireText(index, 'Native GUI IR 1.7', 'Studio current native status');
requireText(index, 'payload v17', 'Studio current native status');
requireText(index, 'runtime v1.8', 'Studio current native status');
rejectText(index, 'Ready IR 1.3 / v1.4', 'Studio current native status');

requireText(nativeBuild, './src/native-current-contract.js', 'browser current native builder');
requireText(nativeBuild, 'buildCurrentNativeGuiIR as buildNativeGuiIR', 'browser current native builder');
requireText(nativeBuild, 'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION', 'browser current native builder');
requireText(nativeBuild, 'sealCurrentNativeGuiRuntime', 'browser current native builder');
requireText(nativeBuild, 'allowSlider: true', 'browser current native builder');
rejectText(nativeBuild, './src/native-gui-ir-v13.js', 'browser current native builder');
rejectText(nativeBuild, './src/sealed-native-gui-v13.js', 'browser current native builder');

requireText(current, "PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.7/payload-17/runtime-1.8'", 'current native facade');
requireText(current, "PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.8'", 'current native facade');
requireText(current, 'PATCH_CURRENT_NATIVE_GUI_IR_VERSION', 'current native facade');
requireText(current, 'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION', 'current native facade');

// Frozen v12 remains a separately addressable compatibility contract.
requireText(frozen, "PATCH_FROZEN_NATIVE_CONTRACT_ID = 'native-gui-1.2/payload-12/runtime-1.3'", 'frozen native facade');
requireText(frozen, 'buildFrozenNativeGuiIR', 'frozen native facade');
requireText(frozen, 'sealFrozenNativeGuiRuntime', 'frozen native facade');

requireText(gui12, "PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'", 'frozen Native GUI IR 1.2 module');
requireText(gui12, 'buildNativeGuiIRV12', 'frozen Native GUI IR 1.2 module');
requireText(sealed12, 'PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12', 'frozen payload v12 module');
requireText(sealed12, 'sealNativeGuiRuntimeV12', 'frozen payload v12 module');

requireText(docs, 'IR 1.2 / payload v12 / runtime v1.3 frozen', 'Documentation compatibility card');
requireText(docs, 'docs/NATIVE_COMPATIBILITY.md', 'Documentation native compatibility link');
requireText(docs, 'two live native product contracts', 'Documentation two-contract wording');
requireText(downloads, 'Native GUI IR 1.2 / payload v12 / runtime v1.3 remains the frozen TreeView line', 'Downloads frozen compatibility line');
requireText(downloads, 'Explicit legacy linking fails closed when a program requires a newer feature', 'Downloads frozen compatibility behavior');
requireText(downloads, 'Native GUI IR <strong>1.7</strong>', 'Downloads current IR');
requireText(downloads, 'payload <strong>v17</strong>', 'Downloads current payload');
requireText(downloads, 'runtime <strong>v1.8</strong>', 'Downloads current runtime');

rejectText(index, 'Slider Stage 1 is browser-only until a later versioned native contract adds parity', 'Studio index');
rejectText(downloads, 'Native Slider parity requires a future versioned native GUI contract', 'Downloads page');

console.log('Patch Studio frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 compatibility surface validated separately behind the current IR 1.7 / payload v17 / runtime v1.8 facade.');
