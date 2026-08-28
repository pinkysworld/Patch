#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing required current marker: ${marker}`);
};
const rejectAll = (label, text, markers) => {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${label} still contains obsolete current-product text: ${marker}`);
};
const requireScript = (name, command) => {
  if (pkg.scripts?.[name] !== command) throw new Error(`package.json script ${name} drifted from '${command}'.`);
};

if (pkg.version !== '0.2.0-beta.36') throw new Error(`Current project surface expects beta.36, got ${pkg.version}`);
requireScript('build:offline-compiler', 'node scripts/build-offline-compiler.js');
requireScript('build:site', 'node scripts/build-site.js');
requireScript('check:site', 'node scripts/check-site.js && node scripts/check-site-v10.js && node scripts/check-site-v12.js && node scripts/check-site-beta36.js');

const current = read('src/native-current-contract.js');
requireAll('current native facade', current, [
  "PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.7/payload-17/runtime-1.8'",
  "PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.8'",
  'PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V17_VERSION',
  'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_PAINTBOX_IMAGE_VERSION',
  "windows: 'native-win32-runtime-v1.8'",
  "macos: 'native-macos-runtime-v1.8'",
  "linux: 'native-linux-runtime-v1.8'",
  'buildCurrentNativeGuiIR','sealCurrentNativeGuiRuntime'
]);

const ir14 = read('src/native-gui-ir-v14.js');
requireAll('Native GUI IR 1.4', ir14, [
  "PATCH_NATIVE_GUI_IR_V14_VERSION = '1.4'",
  "PATCH_NATIVE_CHROME_CONTROLS = Object.freeze(['panel', 'timer', 'picture', 'statusbar'])",
  'buildNativeGuiIRV14','validateNativeGuiIRV14','sourceExpr'
]);
const sealed14 = read('src/sealed-native-gui-v14.js');
requireAll('sealed native payload v14', sealed14, ['sealNativeGuiRuntimeV14','PATCH_SEALED_NATIVE_GUI_CHROME_VERSION']);
const ir15 = read('src/native-gui-ir-v15.js');
requireAll('Native GUI IR 1.5', ir15, [
  "PATCH_NATIVE_GUI_IR_V15_VERSION = '1.5'",
  "PATCH_NATIVE_SHAPE_CONTROLS = Object.freeze(['shape'])",
  'buildNativeGuiIRV15','validateNativeGuiIRV15'
]);
const sealed15 = read('src/sealed-native-gui-v15.js');
requireAll('sealed native payload v15', sealed15, ['sealNativeGuiRuntimeV15','PATCH_SEALED_NATIVE_GUI_SHAPE_VERSION']);
const ir16 = read('src/native-gui-ir-v16.js');
requireAll('Native GUI IR 1.6', ir16, [
  "PATCH_NATIVE_GUI_IR_V16_VERSION = '1.6'",
  "PATCH_NATIVE_PAINTBOX_CONTROLS = Object.freeze(['paintbox'])",
  'buildNativeGuiIRV16','validateNativeGuiIRV16'
]);
const sealed16 = read('src/sealed-native-gui-v16.js');
requireAll('sealed native payload v16', sealed16, ['sealNativeGuiRuntimeV16','PATCH_SEALED_NATIVE_GUI_PAINTBOX_VERSION']);
const ir17 = read('src/native-gui-ir-v17.js');
requireAll('Native GUI IR 1.7', ir17, [
  "PATCH_NATIVE_GUI_IR_V17_VERSION = '1.7'",
  'buildNativeGuiIRV17','validateNativeGuiIRV17'
]);
const sealed17 = read('src/sealed-native-gui-v17.js');
requireAll('sealed native payload v17', sealed17, ['sealNativeGuiRuntimeV17','PATCH_SEALED_NATIVE_GUI_PAINTBOX_IMAGE_VERSION']);

const offline = read('.github/workflows/offline-compiler.yml');
requireAll('offline compiler v0.2 workflow', offline, [
  'native-runtime\\win32-sealed-gui-v18.cpp','native-runtime/gtk-sealed-gui-v18.cpp','native-runtime/appkit-sealed-gui-v18.mm',
  'examples/chrome-window.patch','examples/shape-window.patch','examples/paintbox-window.patch','examples/paintbox-image-window.patch','payload v17','offline-compiler-v0.2','Patch Offline Compiler v0.2'
]);
rejectAll('offline compiler current path', offline, [
  'Build Slider-capable Win32 runtime v1.4','Build Slider-capable GTK runtime v1.4','Build Slider-capable AppKit runtime v1.4',
  'is not sealed payload v13','is not sealed payload v14','offline-compiler-v0.1'
]);

const siteBuild = read('scripts/build-site.js');
requireAll('beta36 site build normalization', siteBuild, [
  "const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))",
  'normalizeCurrentProductSurface','0.2 beta.36+','Native GUI IR 1.7 / payload v17 / runtime v1.8',
  'native-win32-runtime-v1.8'
]);

const sw = read('web/sw.js');
requireAll('beta36 service worker source', sw, ["const PATCH_RELEASE = '0.2.0-beta.36'",'self.skipWaiting()','self.clients.claim()']);

const multi = read('web/designer-multiselect.js');
requireAll('RAD multi-selection', multi, [
  'patchAlignLeft','patchAlignRight','patchAlignTop','patchAlignBottom','patchAlignHCenter','patchAlignVCenter',
  'patchSameWidth','patchSameHeight','patchDistributeHorizontal','patchDistributeVertical',
  "alignSelection('right')","alignSelection('bottom')","sizeSelection('width')","sizeSelection('height')",
  "distributeSelection('horizontal')","distributeSelection('vertical')"
]);

const beta36 = read('docs/BETA36.md');
requireAll('beta36 milestone', beta36, [
  'Patch 0.2.0-beta.36','Native GUI IR: `1.7`','sealed payload: `v17`','desktop runtime: `v1.8`','offline compiler line: `offline-compiler-v0.2`',
  'multi-select alignment and center operations','same width/height','equal horizontal/vertical distribution'
]);

const audit = read('docs/GROK_REVIEW_2026-08-25.md');
requireAll('Grok review record', audit, [
  'Offline compiler workflow was stale','PictureBox source is transported but not rendered','Panel is visual grouping, not full containment semantics',
  'StatusBar backend parity differs','New v1.5 controls were not carried through the full Studio authoring path'
]);

const pages = read('.github/workflows/pages.yml');
requireAll('Pages current runtime acquisition', pages, ['native-win32-runtime-v1.8','native-macos-runtime-v1.8','native-linux-runtime-v1.8']);
rejectAll('Pages current runtime acquisition', pages, ['WIN32_RUNTIME_TAG: native-win32-runtime-v1.7','LINUX_NATIVE_RUNTIME_TAG: native-linux-runtime-v1.7','MACOS_NATIVE_RUNTIME_TAG: native-macos-runtime-v1.7']);

console.log('Patch project surface is coherent for beta.36 / IR 1.7 / payload v17 / runtime v1.8 / offline compiler v0.2.');
