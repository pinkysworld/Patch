#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const requireFile = rel => {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing generated Table-ready site file: ${rel}`);
};
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing: ${marker}`);
};
const rejectAll = (label, text, markers) => {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${label} contains obsolete current-product marker: ${marker}`);
};
const requireAllFolded = (label, text, markers) => {
  const folded = text.toLowerCase();
  for (const marker of markers) if (!folded.includes(marker.toLowerCase())) throw new Error(`${label} is missing compatibility evidence: ${marker}`);
};

for (const rel of [
  '_site/downloads.html', '_site/table-stage1.js', '_site/designer-alignment.js',
  '_site/designer-alignment-guides.js', '_site/designer-multiselect.js',
  '_site/designer-layout-policy.js', '_site/designer-responsive-layout.js',
  '_site/designer-multiselect.css', '_site/designer-responsive-layout.css',
  '_site/src/native-gui-ir-v12.js',
  '_site/src/native-gui-ir-v13.js', '_site/src/native-current-contract.js', '_site/src/native-frozen-contract.js', '_site/src/native-gui-frozen-lower.js', '_site/src/sealed-native-gui-v13.js'
]) requireFile(rel);

const index = read('_site/index.html');
requireAll('Studio page', index, [
  './downloads.html', 'id="addTable"', './table-stage1.js',
  './designer-alignment-guides.js', './designer-multiselect.js',
  './designer-responsive-layout.js', './designer-multiselect.css',
  './designer-responsive-layout.css'
]);

// Table originated in Native GUI IR 0.8 / payload v9. The current Ready tier is
// Native GUI IR 1.5 / payload v15 / runtime v1.6 and must preserve that Table
// contract while historical v13 and frozen v12 implementation modules remain
// packaged as compatibility evidence. Product code reaches the current tier
// through the stable native-current-contract facade rather than importing v13.
const nativeBuild = read('_site/native-build.js');
requireAll('Studio native Ready builder', nativeBuild, [
  "./src/native-current-contract.js",
  'buildCurrentNativeGuiIR as buildNativeGuiIR',
  'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION',
  'sealCurrentNativeGuiRuntime',
  'Native single EXE (no token, recommended)',
  'Native GTK app (no token, recommended)',
  'Native AppKit app (no token, unsigned)'
]);
rejectAll('Studio native Ready builder', nativeBuild, [
  './src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js','buildNativeGuiIRV13 as buildNativeGuiIR','sealNativeGuiRuntimeV13'
]);

const downloads = read('_site/downloads.html');
const language = read('_site/language.html');
const help = read('_site/help.html');
requireAllFolded('Downloads', downloads, ['v9/v1.0', 'Table line']);
for (const [label, text] of [['Downloads', downloads], ['Language', language], ['Help', help]]) {
  requireAll(label, text, ['Table']);
  if (/does not yet claim Table support|Table is not yet claimed|Table is not yet part of the sealed/i.test(text)) {
    throw new Error(`${label} still contains a pre-v1.0 Table support disclaimer.`);
  }
}

const sw = read('_site/sw.js');
requireAll('Patch Studio service worker', sw, [
  "'./downloads.html'", "'./table-stage1.js'", "'./designer-multiselect.js'",
  "'./designer-responsive-layout.js'", "'./src/native-gui-ir-v12.js'",
  "'./src/native-gui-ir-v13.js'", "'./src/native-current-contract.js'", "'./src/native-frozen-contract.js'",
  "'./src/sealed-native-gui-v13.js'"
]);

const nativeGuiV12 = read('_site/src/native-gui-ir-v12.js');
requireAll('Frozen Native GUI IR 1.2 browser module', nativeGuiV12, [
  "PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'", 'buildNativeGuiIRV12'
]);
const frozenLower = read('_site/src/native-gui-frozen-lower.js');
requireAll('Frozen lowering snapshot preserves Table', frozenLower, [
  "type: 'table'", "event.valueType = 'text-list'"
]);

const current = read('_site/src/native-current-contract.js');
requireAll('Current native product facade', current, [
  "PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.8/payload-18/runtime-1.9'",
  'buildCurrentNativeGuiIR','sealCurrentNativeGuiRuntime'
]);

const frozen = read('_site/src/native-frozen-contract.js');
requireAll('Frozen native TreeView product facade', frozen, [
  "PATCH_FROZEN_NATIVE_CONTRACT_ID = 'native-gui-1.2/payload-12/runtime-1.3'",
  'buildFrozenNativeGuiIR','sealFrozenNativeGuiRuntime'
]);

const nativeGuiV13 = read('_site/src/native-gui-ir-v13.js');
requireAll('Historical Native GUI IR 1.3 implementation module', nativeGuiV13, [
  "PATCH_NATIVE_GUI_IR_V13_VERSION = '1.3'", 'buildNativeGuiIRV13'
]);

console.log('ok Table compatibility is preserved from payload v9 through the current Native GUI IR 1.8 / payload v18 / runtime v1.9 facade.');
