import fs from 'node:fs';

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function requireAll(label, text, values) {
  const missing = values.filter(value => !text.includes(value));
  if (missing.length) throw new Error(`${label} is missing:\n- ${missing.join('\n- ')}`);
}

function rejectAll(label, text, values) {
  const present = values.filter(value => text.includes(value));
  if (present.length) throw new Error(`${label} contains stale/forbidden text:\n- ${present.join('\n- ')}`);
}

for (const file of [
  '_site/index.html','_site/language.html','_site/docs.html','_site/downloads.html','_site/help.html','_site/privacy.html','_site/terms.html',
  '_site/icon.svg','_site/manifest.webmanifest','_site/style.css','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',
  '_site/studio-bootstrap.js','_site/native-build.js','_site/runtime-integrity.js','_site/sw.js','_site/playground.js',
  '_site/designer-alignment.js','_site/designer-alignment-guides.js','_site/designer-multiselect.js','_site/designer-multiselect.css',
  '_site/src/interpreter.js','_site/src/compiler.js','_site/src/native-current-contract.js','_site/src/native-frozen-contract.js',
  '_site/src/native-gui-ir-v12.js','_site/src/native-tree-backend-adapter.js','_site/src/sealed-native-gui-v12.js',
  '_site/src/native-gui-ir-v13.js','_site/src/native-slider-backend-adapter.js','_site/src/sealed-native-gui-v13.js',
  '_site/src/native-gui-ir-v14.js','_site/src/native-gui-ir-v15.js','_site/src/native-gui-ir-v16.js','_site/src/native-gui-ir-v17.js','_site/src/native-gui-ir-v18.js','_site/src/native-gui-ir-v19.js',
  '_site/src/native-chrome-backend-adapter.js','_site/src/native-shape-backend-adapter.js','_site/src/native-paintbox-backend-adapter.js',
  '_site/src/sealed-native-gui-v14.js','_site/src/sealed-native-gui-v15.js','_site/src/sealed-native-gui-v16.js','_site/src/sealed-native-gui-v17.js','_site/src/sealed-native-gui-v18.js','_site/src/sealed-native-gui-v19.js',
  '_site/src/native-paintbox-image-backend-adapter.js','_site/src/native-button-image-backend-adapter.js','_site/src/native-window-icon-backend-adapter.js','_site/src/native-window-icon-package-v110.js'
]) {
  if (!fs.existsSync(file)) throw new Error(`Public site is missing ${file}`);
}
if (fs.existsSync('_site/paper.html')) throw new Error('Public site must not contain paper.html.');

const index = read('_site/index.html');
requireAll('Studio shell', index, [
  'Patch Studio','href="./downloads.html"','./studio-bootstrap.js?v=','./native-build.js?v=','./playground.js?v=',
  'Build','Run','Designer','Source'
]);
rejectAll('Studio shell retired entrypoints', index, ['./paper.html']);

const docs = read('_site/docs.html');
requireAll('Docs current contract', docs, [
  'Patch documentation','href="./downloads.html"','Native GUI IR 1.9','payload v19','runtime v1.10',
  'native-win32-runtime-v1.10','native-macos-runtime-v1.10','native-linux-runtime-v1.10','currentNativeHasButtonImage','currentNativeHasWindowIcon'
]);

const nativeBuild = read('_site/native-build.js');
requireAll('Studio Ready native builder', nativeBuild, [
  './src/native-current-contract.js','buildCurrentNativeGuiIR as buildNativeGuiIR','sealCurrentNativeGuiRuntime',
  'PATCH_CURRENT_NATIVE_PAYLOAD_VERSION','Native single EXE (no token, recommended)','Native GTK app (no token, recommended)','Native AppKit app (no token, unsigned)',
  'Native GUI IR 1.9','payload v19','runtime v1.10','allowImageList: true'
]);
rejectAll('Studio Ready native builder stale copy/imports', nativeBuild, [
  './src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js','Patch Studio compiled the GUI to Native GUI IR 1.3','sealed payload v13 into the native','runtime v1.4 app downloaded'
]);

const downloads = read('_site/downloads.html');
requireAll('Downloads beta36 release contract', downloads, [
  'Patch Studio Offline IDE + compiler',
  'offline-studio-v0.2',
  'PatchStudio-windows-x64.exe','PatchStudio-windows-arm64.exe','PatchStudio-macos-arm64','PatchStudio-macos-x64.tar.gz','PatchStudio-linux-x64','PatchStudio-linux-arm64','PatchStudio-portable-node18.tar.gz','offline-studio-manifest.json','SHA256SUMS',
  'Stage 2 R0.2','--workspace','authenticated localhost Build bridge','Windows ARM64, Linux ARM64, macOS Intel and the portable Node bundle remain Stage 1','project-v4 binary resources',
  'patch-windows-x64.exe','patch-macos-arm64','patch-macos-x64.tar.gz','patch-linux-x64','patch-freebsd-x64.tar.gz',
  'Native GUI IR <strong>1.9</strong>','payload <strong>v19</strong>','runtime <strong>v1.10</strong>',
  'offline-compiler-v0.2','native-win32-runtime-v1.10','native-macos-runtime-v1.10','native-linux-runtime-v1.10','runtime-manifest.json',
  'Native GUI IR 1.7 / payload v17 / runtime v1.8',
  'Native GUI IR 1.6 / payload v16 / runtime v1.7',
  'Native GUI IR 1.5 / payload v15 / runtime v1.6',
  'PictureBox note:'
]);
rejectAll('Downloads beta36 current links', downloads, [
  'offline-studio-v0.1','offline-compiler-v0.1',
  'Host-native desktop Build inside the IDE is the next Stage 2 boundary',
  'does not yet expose the standalone native compiler/runtime through a privileged local Build bridge',
  'href="https://github.com/pinkysworld/Patch/releases/tag/native-win32-runtime-v1.4"',
  'href="https://github.com/pinkysworld/Patch/releases/tag/native-macos-runtime-v1.4"',
  'href="https://github.com/pinkysworld/Patch/releases/tag/native-linux-runtime-v1.4"','./paper.html'
]);

const selection = read('_site/designer-selection.js');
requireAll('Shared Designer selection state', selection, ['patch-designer-selection-change','currentDesignerSelection','installDesignerSelectionBridge']);

const runtimeIntegrity = read('_site/runtime-integrity.js');
requireAll('Studio runtime integrity gate', runtimeIntegrity, ['runtime-manifest.json','SHA-256','crypto.subtle.digest']);

console.log('Patch public site validation passed.');
