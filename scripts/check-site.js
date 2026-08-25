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

if (pkg.version !== '0.2.0-beta.35') throw new Error(`Unexpected Patch site package version: ${pkg.version}`);

const requiredFiles = [
  '_site/index.html','_site/language.html','_site/docs.html','_site/paper.html','_site/downloads.html','_site/help.html',
  '_site/style.css','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',
  '_site/studio-bootstrap.js','_site/native-build.js','_site/runtime-integrity.js','_site/sw.js','_site/playground.js',
  '_site/studio-command-palette.js','_site/studio-command-palette.css',
  '_site/project-lifecycle.js','_site/recovery-manager.js','_site/studio-outline.js','_site/slider-stage1.js','_site/table-stage1.js',
  '_site/tree-designer.js','_site/designer-selection.js','_site/designer-core-selection.js','_site/designer-workspace.js',
  '_site/designer-ux.js','_site/designer-ux.css','_site/designer-toolbox.js','_site/designer-toolbox.css',
  '_site/designer-structure-ux.js','_site/designer-structure-ux.css','_site/form-designer-workflow.js','_site/form-designer-workflow.css',
  '_site/designer-structural-keyboard.js','_site/designer-inspector.css',
  '_site/src/compiler.js','_site/src/call-site-validation.js','_site/src/independent-range-expression.js','_site/src/independent-guard-expression.js',
  '_site/src/studio-project.js','_site/src/window-build.js','_site/src/window-events.js',
  '_site/src/native-gui-ir-v12.js','_site/src/native-gui-ir-v13.js','_site/src/native-gui-ir-v14.js','_site/src/native-current-contract.js','_site/src/native-frozen-contract.js','_site/src/native-gui-frozen-lower.js','_site/src/native-gui-frozen-seal.js',
  '_site/src/native-tree-backend-adapter.js','_site/src/native-slider-backend-adapter.js','_site/src/native-chrome-backend-adapter.js',
  '_site/src/sealed-native-gui-v12.js','_site/src/sealed-native-gui-v13.js','_site/src/sealed-native-gui-v14.js','_site/src/sealed-native-package.js'
];
for (const rel of requiredFiles) requireFile(rel);

for (const page of ['index.html','language.html','docs.html','paper.html','downloads.html','help.html']) {
  const html = read(`_site/${page}`);
  requireAll(`${page} navigation`, html, ['./index.html','./language.html','./docs.html','./paper.html','./downloads.html','./help.html','class="site-tabs"']);
  requireAll(`${page} version`, html, [`data-patch-version="${pkg.version}"`]);
}

const index = read('_site/index.html');
requireAll('Studio shell', index, [
  'Patch Studio','id="code"','id="run"','id="build"','id="designer"','id="app"',
  'id="projectName"','id="projectKind"','id="exportProject"','id="importProject"','id="recoverProject"',
  'Project Outline','multi-file project bundle v3','value="sliderWindow">Slider app</option>','value="workshopDesk">Workshop desk</option>','Native GUI IR 1.3','payload v13','runtime v1.4',
  'hierarchical TreeView','native Slider','Local-first Studio','Verified desktop path','Browser-gated delivery','Contracts and quick start',
  'id="editorCaret"','id="saveState"','status-chip','IR 1.3 / v1.4','id="editorTabs"','id="editorParseStatus"','id="addSlider"','id="addTree"','id="openCommandPalette"','id="commandPalette"','id="commandPaletteInput"',
  './studio-command-palette.css','./studio-command-palette.js','./studio-bootstrap.js','./slider-stage1.js','./tree-designer.js',
  './designer-workspace.js','./runtime-integrity.js','./native-build.js'
]);
rejectAll('Studio shell', index, [
  'Slider Stage 1 is browser-only until a later versioned native contract adds parity',
  'currently browser-only and native builds fail closed',
  '<details class="studio-launchpad" open'
]);

const bootstrap = read('_site/studio-bootstrap.js');
requireAll('Studio recovery bootstrap', bootstrap, [
  "navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })",'await registration.update()','controllerchange','patch-studio-sw-reload-guard','window.location.reload()'
]);
if (/^\s*import\s/m.test(bootstrap)) throw new Error('Studio recovery bootstrap must remain dependency-free.');

const playground = read('_site/playground.js');
const accessibility = read('_site/studio-accessibility.js');
rejectAll('Studio playground service-worker ownership', playground, ['serviceWorker.register']);
rejectAll('Studio accessibility service-worker ownership', accessibility, ['serviceWorker.register']);

const palette = read('_site/studio-command-palette.js');
requireAll('Studio command palette', palette, [
  "'Run project'","'Build selected target'","'Focus source editor'","'Open Designer'","'Open Recovery'",
  "navigate('./docs.html')","navigate('./paper.html')","navigate('./downloads.html')","navigate('./help.html')",'event.key.toLowerCase()','ArrowDown','ArrowUp'
]);
rejectAll('Studio command palette persistence boundary', palette, ['localStorage','sessionStorage','indexedDB']);

const nativeBuild = read('_site/native-build.js');
requireAll('Studio native Ready builder', nativeBuild, [
  "./src/native-current-contract.js",'buildCurrentNativeGuiIR as buildNativeGuiIR',
  'sealCurrentNativeGuiRuntime','PATCH_CURRENT_NATIVE_PAYLOAD_VERSION','allowTree: true','allowSlider: true',
  'runtime v1.4','payload v13','Native single EXE (no token, recommended)','Native GTK app (no token, recommended)','Native AppKit app (no token, unsigned)'
]);
rejectAll('Studio native Ready builder direct-version imports', nativeBuild, [
  './src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js','sealNativeGuiRuntimeV13','PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION'
]);

const downloads = read('_site/downloads.html');
requireAll('Downloads page', downloads, [
  'patch-windows-x64.exe','patch-macos-arm64','patch-macos-x64.tar.gz','patch-linux-x64','patch-freebsd-x64.tar.gz','SHA256SUMS',
  'Native GUI IR <strong>1.3</strong>','payload <strong>v13</strong>','runtime <strong>v1.4</strong>','native Slider',
  'runtime-manifest.json','native-win32-runtime-v1.4','native-macos-runtime-v1.4','native-linux-runtime-v1.4',
  'Native GUI IR 1.2 / payload v12 / runtime v1.3','Slider fail-closed',
  'self-checks the interpreter, direct Wasm and C99 numeric subset'
]);
rejectAll('Downloads page', downloads, ['Native Slider parity requires a future versioned native GUI contract']);

const docs = read('_site/docs.html');
requireAll('Documentation page', docs, [
  'One current map of Patch.','id="docFilter"','id="docFilterStatus"','Find docs',
  'docs/SLIDER_STAGE1.md','docs/PATCH_STUDIO.md','docs/STUDIO_AUTHORING_SURFACE.md','docs/STUDIO_SELECTION_ARCHITECTURE.md',
  'docs/STUDIO_KEYBOARD_ACCESSIBILITY.md','docs/COMPILER.md','docs/OFFLINE_COMPILER.md','docs/FORMAL_MODEL.md',
  'docs/REPRODUCIBILITY_BUNDLE.md','docs/NATIVE_GUI.md','docs/NATIVE_APPS.md','docs/TARGETS.md','docs/ROADMAP.md',
  'Native GUI IR 1.3 / payload v13 / runtime v1.4','IR 1.2 / payload v12 / runtime v1.3 frozen','beta.32 assurance boundary',
  'Bring to front / Send to back and the 8 px design grid',
  'text-backed single-select and list-backed multi-select contracts','nested Table/TreeView structural Properties editing',
  'Thing fields such as player.score'
]);

const paper = read('_site/paper.html');
requireAll('Paper page', paper, [
  'Working manuscript','beta.32','Native GUI IR 1.3','payload v13','runtime v1.4',
  'no controlled paper-quality timing dataset yet','No empirical overhead claim',
  'not an end-to-end compiler theorem','Patch reject / coarse accept',
  'loyalty-over-limit','balance = 80','used = 35','prototype-free Things',
  'checkedObservedTransitiveRuntimeRefinesCallerSignature','twelve invocation frames',
  'hosted-ci','none collected','Construct validity','Contributions',
  'id="open-gates"','Still open','genuine external/third-party','expert/venue feedback'
]);
rejectAll('Paper page', paper, [
  'controlled paper-quality timing dataset has been collected'
]);

const language = read('_site/language.html');
requireAll('Language current Slider contract', language, [
  'Slider Stage 1','Native GUI IR 1.3','payload v13','runtime v1.4','TRACKBAR','NSSlider','GtkScale',
  'Native GUI IR 1.2 / payload v12 / runtime v1.3','frozen'
]);
requireAll('Language Thing own-field contract', language, [
  'Things are own-field records','__proto__','prototype-free','JSON serialization is not the equality oracle','fail closed on Things'
]);

const help = read('_site/help.html');
requireAll('Help page current control surface', help, [
  'Slider Stage 1','ListBox: single or multi-select','Keyboard-only structural Properties','Ready runtime verification','Offline compiler',
  'Native GUI IR 1.3 / payload v13 / runtime v1.4','Native runtime v1.3 is TreeView-capable but Slider-free',
  'Click <strong>Edit</strong> beside a nested Table','Click <strong>Edit</strong> beside a nested TreeView',
  'Thing fields as <code>player.score</code>','direct Wasm or C99 build rejects a Thing','patch doctor','PATCH2003','file:line',
  'editor tabs','Parsed','Bring to front','Harbor Desk'
]);

const compiler = read('_site/src/compiler.js');
requireAll('Compiler release contract', compiler, ["PATCH_IR_VERSION = '0.10'",'formalCalls','sourceValidation','guardValidation']);
const events = read('_site/src/window-events.js');
requireAll('Window event contract', events, ["PATCH_WINDOW_EVENTS_VERSION = '0.9'","controlType === 'slider'",'finite number','text-list event-local value']);
const windowBuild = read('_site/src/window-build.js');
requireAll('Window Slider capability gate', windowBuild, ['allowSlider','Slider','not enabled for this Window target']);
const nativeCurrent = read('_site/src/native-current-contract.js');
requireAll('current native product facade', nativeCurrent, [
  'PATCH_CURRENT_NATIVE_GUI_IR_VERSION','PATCH_CURRENT_NATIVE_PAYLOAD_VERSION','PATCH_CURRENT_NATIVE_RUNTIME_VERSION',
  'native-win32-runtime-v1.5','native-macos-runtime-v1.5','native-linux-runtime-v1.5','buildCurrentNativeGuiIR','sealCurrentNativeGuiRuntime'
]);
const nativeFrozen = read('_site/src/native-frozen-contract.js');
requireAll('frozen native TreeView product facade', nativeFrozen, [
  'PATCH_FROZEN_NATIVE_CONTRACT_ID','native-gui-1.2/payload-12/runtime-1.3','native-win32-runtime-v1.3','buildFrozenNativeGuiIR','sealFrozenNativeGuiRuntime'
]);
const gui13 = read('_site/src/native-gui-ir-v13.js');
requireAll('Native GUI IR 1.3 implementation', gui13, ["PATCH_NATIVE_GUI_IR_V13_VERSION = '1.3'",'buildNativeGuiIRV13','slider']);
const sealed13 = read('_site/src/sealed-native-gui-v13.js');
requireAll('sealed payload v13 implementation', sealed13, ['PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION','sealNativeGuiRuntimeV13','13']);
const gui12 = read('_site/src/native-gui-ir-v12.js');
requireAll('frozen Native GUI IR 1.2', gui12, ["PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'",'buildNativeGuiIRV12']);
const sealed12 = read('_site/src/sealed-native-gui-v12.js');
requireAll('frozen payload v12', sealed12, ['PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12','sealNativeGuiRuntimeV12']);

const refreshCss = read('_site/site-refresh.css');
requireAll('Shared website refresh', refreshCss, [
  '.site-tabs','.studio-launchpad','.studio-snapshot','.studio-guide','.docs-contract-grid','.docs-commandbar','.docs-search','.doc-link',
  'grid-template-columns: repeat(3, minmax(0, 1fr))','@media (max-width: 1180px)','@media (max-width: 620px)',
  '@media (prefers-reduced-motion: reduce)','@media (forced-colors: active)'
]);
const navigationCss = read('_site/site-navigation.css');
requireAll('Website navigation refresh import', navigationCss, ['@import url("./site-refresh.css")']);

const sw = read('_site/sw.js');
requireAll('Service worker current compiler cache and type-safe fallback', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.35'","url.pathname.includes('/runtimes/')",'./site-refresh.css','./studio-bootstrap.js',
  './paper.html','./studio-command-palette.css','./studio-command-palette.js','./slider-stage1.js','./src/compiler.js','./src/call-site-validation.js',
  './src/independent-range-expression.js','./src/independent-guard-expression.js','./src/native-current-contract.js','./src/native-frozen-contract.js','./src/native-gui-frozen-lower.js','./src/native-gui-ir-v13.js','./src/native-gui-ir-v14.js',
  './src/native-slider-backend-adapter.js','./src/native-chrome-backend-adapter.js','./src/sealed-native-gui-v13.js','./src/sealed-native-gui-v14.js','const navigation = event.request.mode === \'navigate\'',
  'if (navigation)','throw error'
]);

const coreSelection = read('_site/designer-core-selection.js');
requireAll('Core Designer selection bridge', coreSelection, ['currentDesignerSelection']);
rejectAll('Core Designer selection bridge', coreSelection, ['legacySelected']);

const structureUx = read('_site/designer-structure-ux.js');
requireAll('Structural Properties usability', structureUx, ['filterStructureLabels','structuralEditorSummary','Filter nodes','Filter pages','No rows yet','Add first row','clickExisting']);
const structuralKeyboard = read('_site/designer-structural-keyboard.js');
requireAll('Designer structural keyboard accessibility', structuralKeyboard, ['nextStructuralOptionIndex','structuralShortcut','aria-keyshortcuts','Control+Enter Meta+Enter']);
const toolbox = read('_site/designer-toolbox.js');
requireAll('Designer toolbox discovery', toolbox, ['DESIGNER_TOOL_CATALOG',"type: 'slider'","buttonId: 'addSlider'",'designerAddControl']);

console.log('Patch public site validation passed for beta.35+ / polished Studio / stable current native facade / Native GUI IR 1.3 / payload v13 / runtime v1.4.');
