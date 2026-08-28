#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const requireFile = rel => {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing generated site file: ${rel}`);
};
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing: ${marker}`);
};
const rejectAll = (label, text, markers) => {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${label} contains obsolete text: ${marker}`);
};

if (pkg.version !== '0.2.0-beta.36') throw new Error(`Unexpected Patch site package version: ${pkg.version}`);

const requiredFiles = [
  '_site/index.html','_site/language.html','_site/docs.html','_site/downloads.html','_site/help.html',
  '_site/style.css','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',
  '_site/studio-bootstrap.js','_site/native-build.js','_site/runtime-integrity.js','_site/sw.js','_site/playground.js',
  '_site/designer-selection.js','_site/designer-core-selection.js','_site/designer-structural-keyboard.js',
  '_site/designer-multiselect.js','_site/designer-layout-actions.js','_site/designer-toolbox.js',
  '_site/designer-event-inspector.js','_site/designer-focus-order.js',
  '_site/src/compiler.js','_site/src/native-current-contract.js','_site/src/native-frozen-contract.js',
  '_site/src/native-gui-ir-v14.js','_site/src/sealed-native-gui-v14.js','_site/src/native-chrome-backend-adapter.js'
];
for (const rel of requiredFiles) requireFile(rel);
if (fs.existsSync(path.join(root, '_site/paper.html'))) throw new Error('Patch Studio public site must not publish _site/paper.html.');

for (const page of ['index.html','language.html','docs.html','downloads.html','help.html']) {
  const html = read(`_site/${page}`);
  requireAll(`${page} navigation`, html, ['./index.html','./language.html','./docs.html','./downloads.html','./help.html','class="site-tabs"']);
  rejectAll(`${page} private paper boundary`, html, ['./paper.html']);
  requireAll(`${page} version`, html, [`data-patch-version="${pkg.version}"`]);
}

const index = read('_site/index.html');
requireAll('Studio beta36 shell', index, [
  'Patch Studio','0.2 beta.36+','id="code"','id="run"','id="build"','id="designer"','id="app"',
  'multi-file project bundle v4','source-backed Designer','Native GUI IR 1.4','payload v14','runtime v1.5',
  'IR 1.4 / v1.5','id="editorTabs"','id="editorParseStatus"','id="openCommandPalette"',
  'viewBox="0 0 32 32"','M8 6H22V18H13V26H8ZM13 10H18V14H13Z'
]);
rejectAll('Studio beta36 current shell', index, [
  'multi-file project bundle v3','Ready IR 1.3 / v1.4','current runtime v1.4 templates','shape-rendering="crispEdges"','M3 2H18V12H8V20H3ZM8 6H13V8H8Z','./paper.html'
]);

const current = read('_site/src/native-current-contract.js');
requireAll('Current native product facade', current, [
  "native-gui-1.4/payload-14/runtime-1.5","PATCH_CURRENT_NATIVE_GUI_IR_VERSION = PATCH_NATIVE_GUI_IR_V14_VERSION",
  'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION = PATCH_SEALED_NATIVE_GUI_CHROME_VERSION',"PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.5'",
  'native-win32-runtime-v1.5','native-macos-runtime-v1.5','native-linux-runtime-v1.5'
]);

const nativeBuild = read('_site/native-build.js');
requireAll('Studio Ready native builder', nativeBuild, [
  './src/native-current-contract.js','buildCurrentNativeGuiIR as buildNativeGuiIR','sealCurrentNativeGuiRuntime',
  'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION','Native single EXE (no token, recommended)','Native GTK app (no token, recommended)','Native AppKit app (no token, unsigned)',
  'Native GUI IR 1.4','payload v14','runtime v1.5'
]);
rejectAll('Studio Ready native builder stale copy/imports', nativeBuild, [
  './src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js','Patch Studio compiled the GUI to Native GUI IR 1.3','sealed payload v13 into the native','runtime v1.4 app downloaded'
]);

const downloads = read('_site/downloads.html');
requireAll('Downloads beta36', downloads, [
  'patch-windows-x64.exe','patch-macos-arm64','patch-macos-x64.tar.gz','patch-linux-x64','patch-freebsd-x64.tar.gz','SHA256SUMS',
  'Native GUI IR <strong>1.4</strong>','payload <strong>v14</strong>','runtime <strong>v1.5</strong>',
  'offline-compiler-v0.2','native-win32-runtime-v1.5','native-macos-runtime-v1.5','native-linux-runtime-v1.5','runtime-manifest.json',
  'Native GUI IR 1.3 / payload v13 / runtime v1.4 remains the Slider-capable compatibility line',
  'PictureBox note:'
]);
rejectAll('Downloads beta36 current links', downloads, ['offline-compiler-v0.1','href="https://github.com/pinkysworld/Patch/releases/tag/native-win32-runtime-v1.4"','href="https://github.com/pinkysworld/Patch/releases/tag/native-macos-runtime-v1.4"','href="https://github.com/pinkysworld/Patch/releases/tag/native-linux-runtime-v1.4"','./paper.html']);

const selection = read('_site/designer-selection.js');
requireAll('Shared Designer selection state', selection, [
  'patch-designer-selection-change','currentDesignerSelection','installDesignerSelectionBridge'
]);

const coreSelection = read('_site/designer-core-selection.js');
requireAll('Core Designer selection bridge', coreSelection, [
  'currentDesignerSelection','installDesignerSelectionBridge','captureCoreSelection','populateSharedInspector'
]);

const structuralKeyboard = read('_site/designer-structural-keyboard.js');
requireAll('Designer structural keyboard accessibility', structuralKeyboard, [
  'installDesignerStructuralKeyboard','aria-keyshortcuts','Control+Enter','nextStructuralOptionIndex'
]);

const multiselect = read('_site/designer-multiselect.js');
requireAll('RAD multi-select arrange tools', multiselect, [
  'patchAlignLeft','patchAlignRight','patchAlignTop','patchAlignBottom','patchAlignHCenter','patchAlignVCenter',
  'patchSameWidth','patchSameHeight','patchDistributeHorizontal','patchDistributeVertical',
  "alignSelection('right')","alignSelection('bottom')","sizeSelection('width')","sizeSelection('height')",
  "distributeSelection('horizontal')","distributeSelection('vertical')"
]);

const eventInspector = read('_site/designer-event-inspector.js');
requireAll('RAD Object Inspector events', eventInspector, [
  'designerPropertiesTab','designerEventsTab','designerObjectSelect','Create handler','Open handler',
  "event: 'clicked', label: 'OnClick'","event: 'changed', label: 'OnChange'","event: 'ticked', label: 'OnTick'",
  'ensureDesignerEventHandler','findDesignerEventHandler'
]);

const toolbox = read('_site/designer-toolbox.js');
requireAll('Searchable RAD Component Palette', toolbox, [
  'designerComponentSearch','filterDesignerTools','Search Designer controls','event.key.toLowerCase()'
]);

const focusOrder = read('_site/designer-focus-order.js');
requireAll('RAD Focus Order Stage 1', focusOrder, [
  'Focus Order · Stage 1','listDesignerFocusOrder','Independent Delphi-style TabOrder metadata is a later contract','reorderDesignerControl'
]);

const sw = read('_site/sw.js');
requireAll('beta36 service worker', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.36'",'const freshFirst = navigation || codeAsset || htmlAsset || runtimeAsset',
  'self.skipWaiting()','self.clients.claim()','./designer-event-inspector.js','./designer-focus-order.js',
  './designer-selection.js','./designer-core-selection.js','./designer-structural-keyboard.js'
]);
rejectAll('beta36 service worker paper privacy', sw, ['./paper.html']);

const palette = read('_site/studio-command-palette.js');
rejectAll('Studio command palette paper privacy', palette, ["command('paper'",'./paper.html','Open Paper']);

const bootstrap = read('_site/studio-bootstrap.js');
requireAll('Studio cache refresh bootstrap', bootstrap, ["navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })",'await registration.update()','controllerchange']);

console.log('Patch public site validation passed for beta.36 / project bundle v4 / Native GUI IR 1.4 / payload v14 / runtime v1.5 / RAD Object Inspector, Component Palette and Focus Order Stage 1; research paper remains repository-only.');
