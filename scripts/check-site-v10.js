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
const requireAllFolded = (label, text, markers) => {
  const folded = text.toLowerCase();
  for (const marker of markers) if (!folded.includes(marker.toLowerCase())) throw new Error(`${label} is missing compatibility evidence: ${marker}`);
};

for (const rel of [
  '_site/downloads.html', '_site/table-stage1.js', '_site/designer-alignment.js',
  '_site/designer-alignment-guides.js', '_site/designer-multiselect.js',
  '_site/designer-layout-policy.js', '_site/designer-responsive-layout.js',
  '_site/designer-multiselect.css', '_site/designer-responsive-layout.css',
  '_site/src/native-gui-ir-v08.js', '_site/src/native-gui-ir-v12.js',
  '_site/src/native-gui-ir-v13.js', '_site/src/sealed-native-gui-v13.js'
]) requireFile(rel);

const index = read('_site/index.html');
requireAll('Studio page', index, [
  './downloads.html', 'id="addTable"', './table-stage1.js',
  './designer-alignment-guides.js', './designer-multiselect.js',
  './designer-responsive-layout.js', './designer-multiselect.css',
  './designer-responsive-layout.css'
]);

// Table originated in Native GUI IR 0.8 / payload v9. The current Ready tier is
// Native GUI IR 1.3 / payload v13 / runtime v1.4 and must preserve the Table
// contract while the frozen IR 1.2/v12 TreeView line remains available as
// compatibility evidence rather than as the current Ready implementation.
const nativeBuild = read('_site/native-build.js');
requireAll('Studio native Ready builder', nativeBuild, [
  "./src/native-gui-ir-v13.js",
  "./src/sealed-native-gui-v13.js",
  'buildNativeGuiIRV13 as buildNativeGuiIR',
  'PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION',
  'sealNativeGuiRuntimeV13',
  'Native single EXE (no token, recommended)',
  'Native GTK app (no token, recommended)',
  'Native AppKit app (no token, unsigned)'
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
  "'./designer-responsive-layout.js'", "'./src/native-gui-ir-v08.js'",
  "'./src/native-gui-ir-v12.js'", "'./src/native-gui-ir-v13.js'",
  "'./src/sealed-native-gui-v13.js'"
]);

const nativeGuiV08 = read('_site/src/native-gui-ir-v08.js');
requireAll('Native GUI IR 0.8 browser module', nativeGuiV08, [
  "PATCH_NATIVE_GUI_IR_V08_VERSION = '0.8'", "type: 'table'", "event.valueType = 'text-list'"
]);

const nativeGuiV12 = read('_site/src/native-gui-ir-v12.js');
requireAll('Frozen Native GUI IR 1.2 compatibility module', nativeGuiV12, [
  "PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'", 'buildNativeGuiIRV12'
]);

const nativeGuiV13 = read('_site/src/native-gui-ir-v13.js');
requireAll('Current Native GUI IR 1.3 module', nativeGuiV13, [
  "PATCH_NATIVE_GUI_IR_V13_VERSION = '1.3'", 'buildNativeGuiIRV13'
]);

console.log('ok Table-compatible current Patch Studio site surface on Native GUI IR 1.3 / payload v13 / runtime v1.4');
