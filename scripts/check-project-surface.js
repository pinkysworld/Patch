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
  "PATCH_CURRENT_NATIVE_CONTRACT_ID = 'native-gui-1.4/payload-14/runtime-1.5'",
  "PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.5'",
  'PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V14_VERSION',
  'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_CHROME_VERSION',
  "windows: 'native-win32-runtime-v1.5'",
  "macos: 'native-macos-runtime-v1.5'",
  "linux: 'native-linux-runtime-v1.5'",
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

const offline = read('.github/workflows/offline-compiler.yml');
requireAll('offline compiler v0.2 workflow', offline, [
  'native-runtime\\win32-sealed-gui-v15.cpp','native-runtime/gtk-sealed-gui-v15.cpp','native-runtime/appkit-sealed-gui-v15.mm',
  'examples/chrome-window.patch','payload v14','offline-compiler-v0.2','Patch Offline Compiler v0.2'
]);
rejectAll('offline compiler current path', offline, [
  'Build Slider-capable Win32 runtime v1.4','Build Slider-capable GTK runtime v1.4','Build Slider-capable AppKit runtime v1.4',
  'is not sealed payload v13','offline-compiler-v0.1'
]);

const siteBuild = read('scripts/build-site.js');
requireAll('beta36 site build normalization', siteBuild, [
  "const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))",
  'normalizeCurrentProductSurface','0.2 beta.36+','Native GUI IR 1.4 / payload v14 / runtime v1.5',
  'offline-compiler-v0.2','native-win32-runtime-v1.5','viewBox="0 0 22 22"'
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
  'Patch 0.2.0-beta.36','Native GUI IR `1.4`','sealed payload `v14`','desktop runtime `v1.5`','offline-compiler-v0.2',
  'align left / right','make same width / height','distribute horizontally / vertically'
]);

const audit = read('docs/GROK_REVIEW_2026-08-25.md');
requireAll('Grok review record', audit, [
  'Offline compiler workflow was stale','PictureBox source is transported but not rendered','Panel is visual grouping, not full containment semantics',
  'StatusBar backend parity differs','New v1.5 controls were not carried through the full Studio authoring path'
]);

const pages = read('.github/workflows/pages.yml');
requireAll('Pages current runtime acquisition', pages, ['native-win32-runtime-v1.5','native-macos-runtime-v1.5','native-linux-runtime-v1.5']);
rejectAll('Pages current runtime acquisition', pages, ['WIN32_RUNTIME_TAG: native-win32-runtime-v1.4','LINUX_NATIVE_RUNTIME_TAG: native-linux-runtime-v1.4','MACOS_NATIVE_RUNTIME_TAG: native-macos-runtime-v1.4']);

console.log('Patch project surface is coherent for beta.36 / IR 1.4 / payload v14 / runtime v1.5 / offline compiler v0.2.');