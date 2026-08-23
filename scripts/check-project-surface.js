#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '0.2.0-beta.35') throw new Error(`Current project surface expects beta.35, got ${pkg.version}`);

const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing required current marker: ${marker}`);
};
const rejectAll = (label, text, markers) => {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${label} still contains obsolete current-product text: ${marker}`);
};
const requireScript = (name, command) => {
  if (pkg.scripts?.[name] !== command) throw new Error(`package.json script ${name} drifted from '${command}'.`);
};

const files = {
  readme: read('README.md'),
  website: read('web/index.html'),
  language: read('web/language.html'),
  docsPage: read('web/docs.html'),
  downloadsPage: read('web/downloads.html'),
  helpPage: read('web/help.html'),
  spec: read('docs/SPEC.md'),
  studio: read('docs/PATCH_STUDIO.md'),
  commandPaletteDocs: read('docs/STUDIO_COMMAND_PALETTE.md'),
  studioSurface: read('docs/STUDIO_AUTHORING_SURFACE.md'),
  slider: read('docs/SLIDER_STAGE1.md'),
  offline: read('docs/OFFLINE_COMPILER.md'),
  nativeGui: read('docs/NATIVE_GUI.md'),
  nativeApps: read('docs/NATIVE_APPS.md'),
  targets: read('docs/TARGETS.md'),
  production: read('docs/PRODUCTION_READINESS.md'),
  roadmap: read('docs/ROADMAP.md'),
  compiler: read('docs/COMPILER.md'),
  formal: read('docs/FORMAL_MODEL.md'),
  runtime: read('docs/RUNTIME_CORRESPONDENCE.md'),
  paper: read('paper/README.md'),
  compilerJs: read('src/compiler.js'),
  windowEvents: read('src/window-events.js'),
  windowBuild: read('src/window-build.js'),
  gui12: read('src/native-gui-ir-v12.js'),
  gui13: read('src/native-gui-ir-v13.js'),
  nativeCurrent: read('src/native-current-contract.js'),
  nativeFrozen: read('src/native-frozen-contract.js'),
  nativeCompat: read('docs/NATIVE_COMPATIBILITY.md'),
  sealed12: read('src/sealed-native-gui-v12.js'),
  sealed13: read('src/sealed-native-gui-v13.js'),
  buildSite: read('scripts/build-site.js'),
  bootstrap: read('web/studio-bootstrap.js'),
  accessibility: read('web/studio-accessibility.js'),
  playground: read('web/playground.js'),
  sw: read('web/sw.js')
};

requireScript('check:syntax', 'node scripts/check-js-syntax.js');
requireScript('build:site', 'node scripts/build-site.js');
requireScript('check:site', 'node scripts/check-site.js && node scripts/check-site-v10.js && node scripts/check-site-v12.js && node scripts/check-site-beta35.js');

requireAll('README current contract', files.readme, [
  'Development beta `0.2.0-beta.35`','Change IR `0.10`','Native GUI IR `1.3`','payload `v13`','desktop runtime `v1.4`',
  'Native GUI IR 1.3 / sealed payload v13 / runtime v1.4','Ctrl/Cmd+K Command Palette','real Chrome responsiveness gate',
  'native-current-contract.js','native-frozen-contract.js','docs/NATIVE_COMPATIBILITY.md'
]);
requireAll('README native Slider evidence', files.readme, ['TRACKBAR','NSSlider','GtkScale']);
requireAll('README scoped assurance', files.readme, ['beta.32','does **not** claim full compiler/runtime verification']);
rejectAll('README obsolete backlog boundary', files.readme, ['product backlog is closed','future versioned native contract adds parity']);

requireAll('Language SPEC current contract', files.spec, [
  'Status: **0.2.0-beta.35 development**','Change IR **0.10**','**beta.32**','`slider`','`table`','`tree`','`tabs`','menu item separator enabled checked shortcut','__proto__','constructor'
]);
rejectAll('Language SPEC obsolete assurance/product markers', files.spec, ['0.2.0-beta.8','Change IR 0.6','Beta 8 source/evidence']);

for (const [label, text] of [
  ['Studio', files.website],['Language', files.language],['Documentation page', files.docsPage],['Downloads page', files.downloadsPage],['Help page', files.helpPage]
]) requireAll(`${label} public version`, text, ['0.2 beta.35']);

requireAll('Studio current product surface', files.website, [
  'Native GUI IR 1.3','payload v13','runtime v1.4','Browser-gated delivery','id="openCommandPalette"','id="commandPalette"','./studio-command-palette.js'
]);
requireAll('Language current native contract', files.language, ['Native GUI IR 1.3','payload v13','runtime v1.4','TRACKBAR','NSSlider','GtkScale','frozen']);
requireAll('Documentation current map', files.docsPage, [
  'Native GUI IR 1.3 / payload v13 / runtime v1.4','IR 1.2 / payload v12 / runtime v1.3 frozen','beta.32 assurance boundary',
  'Command Palette','Public deploy gated by real Chrome responsiveness','docs/STUDIO_COMMAND_PALETTE.md',
  'Center H/Center V, Default size and collision-aware Auto place','text-backed single-select and list-backed multi-select contracts','nested Table/TreeView structural Properties editing',
  'docs/NATIVE_COMPATIBILITY.md','two live native product contracts','do not gate Ready or Pages'
]);
requireAll('Downloads current native contract', files.downloadsPage, ['Native GUI IR <strong>1.3</strong>','payload <strong>v13</strong>','runtime <strong>v1.4</strong>','native-win32-runtime-v1.4','native-macos-runtime-v1.4','native-linux-runtime-v1.4']);
requireAll('Help current product surface', files.helpPage, ['Command Palette','Ctrl/Cmd+K','Native GUI IR 1.3 / payload v13 / runtime v1.4','runtime-v1.4 releases','Native runtime v1.3 is TreeView-capable but Slider-free','Service-worker registration is owned by the early bootstrap only','NATIVE_COMPATIBILITY.md']);

requireAll('Command Palette docs', files.commandPaletteDocs, [
  'Ctrl/Cmd+K','Run project','Build selected target','transient IDE interaction state','project-file and symbol quick-open','must not introduce a second persistent project model'
]);

for (const [label, text] of [
  ['Patch Studio docs', files.studio],['Studio authoring docs', files.studioSurface],['Slider docs', files.slider],['Offline compiler docs', files.offline],
  ['Native GUI docs', files.nativeGui],['Native apps docs', files.nativeApps],['Targets docs', files.targets],['Production readiness docs', files.production]
]) requireAll(`${label} current native line`, text, ['Native GUI IR **1.3**','v13','v1.4']);
requireAll('Roadmap current native line', files.roadmap, [
  'Native GUI IR: **1.3**','current sealed native GUI payload: **v13**','current token-free Ready/offline runtime: **v1.4** on Windows, macOS and Linux'
]);
requireAll('Paper current/frozen native boundary', files.paper, [
  'current native product contract: **Native GUI IR 1.3 / sealed payload v13 / runtime v1.4**',
  'frozen TreeView compatibility contract: **Native GUI IR 1.2 / sealed payload v12 / runtime v1.3**',
  'formal runtime-correspondence milestone: **beta.32**'
]);

requireAll('Patch Studio reliability boundary', files.studio, ['Active UX and reliability milestone','Command Palette','single service-worker','real Chrome']);
requireAll('Slider current native evidence', files.slider, ['direct native backend **1.4**','sealed payload **v13**','sealed native runtime **v1.4**','TRACKBAR','NSSlider','GtkScale','Frozen v1.3 compatibility boundary']);
requireAll('Roadmap active UX reliability milestone', files.roadmap, [
  'Active UX and reliability milestone','real Headless Chrome startup/responsiveness test','single service-worker registration and revision-refresh owner',
  'type-safe offline routing','Command Palette','Command Palette v2: project-file and symbol quick-open','Workspace Layout v2','Studio startup diagnostics v2'
]);
requireAll('Workspace Layout v2 implementation boundary', files.accessibility, [
  "patchStudio.workspaceSplit.v2","role', 'separator'","aria-orientation', 'horizontal'","max-width: 760px","--workspace-source-height","--workspace-result-height"
]);
rejectAll('Roadmap obsolete closed backlog claim', files.roadmap, ['The current beta.35+ Studio/compiler product backlog is closed.']);

for (const [label, text] of [
  ['Studio docs', files.studio],['Studio authoring docs', files.studioSurface],['Slider docs', files.slider],['Offline docs', files.offline],['Native GUI docs', files.nativeGui],['Native apps docs', files.nativeApps],['Targets docs', files.targets],['Production docs', files.production],['Roadmap', files.roadmap]
]) requireAll(`${label} frozen v1.3 compatibility`, text, ['v12','v1.3']);

requireAll('Compiler semantic contract', files.compilerJs, ["PATCH_IR_VERSION = '0.10'",'formalCalls','sourceValidation','guardValidation']);
requireAll('Window event adapter', files.windowEvents, ["PATCH_WINDOW_EVENTS_VERSION = '0.9'","controlType === 'slider'",'finite number']);
requireAll('Window target Slider gate', files.windowBuild, ['allowSlider','Slider is not enabled for this Window target']);
requireAll('Native GUI IR 1.3 implementation', files.gui13, ["PATCH_NATIVE_GUI_IR_V13_VERSION = '1.3'",'buildNativeGuiIRV13','slider']);
requireAll('Native payload v13 implementation', files.sealed13, ['PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION','sealNativeGuiRuntimeV13']);
requireAll('Stable current native product entry point', files.nativeCurrent, [
  'PATCH_CURRENT_NATIVE_CONTRACT_ID','PATCH_CURRENT_NATIVE_GUI_IR_VERSION','PATCH_CURRENT_NATIVE_PAYLOAD_VERSION','PATCH_CURRENT_NATIVE_RUNTIME_VERSION',
  'native-win32-runtime-v1.4','native-macos-runtime-v1.4','native-linux-runtime-v1.4','buildCurrentNativeGuiIR','sealCurrentNativeGuiRuntime'
]);
requireAll('Stable frozen native TreeView entry point', files.nativeFrozen, [
  'PATCH_FROZEN_NATIVE_CONTRACT_ID','native-gui-1.2/payload-12/runtime-1.3','native-win32-runtime-v1.3','buildFrozenNativeGuiIR','sealFrozenNativeGuiRuntime'
]);
requireAll('Native compatibility two-contract boundary', files.nativeCompat, [
  'native-current-contract.js','native-frozen-contract.js','native-gui-frozen-lower.js','native-gui-frozen-seal.js','native-gui-1.3/payload-13/runtime-1.4','native-gui-1.2/payload-12/runtime-1.3','Historical include chain','do not gate Ready/Pages'
]);
rejectAll('Native compatibility remaining collapse work', files.nativeCompat, ['The remaining work is keeping unversioned historical bases']);
requireAll('Frozen Native GUI IR 1.2 implementation', files.gui12, ["PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'",'buildNativeGuiIRV12']);
requireAll('Frozen payload v12 implementation', files.sealed12, ['PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12','sealNativeGuiRuntimeV12']);

requireAll('Site build complete browser graph', files.buildSite, [
  "'site-navigation.css','site-refresh.css','site-pages.css'",'studio-command-palette.css','studio-command-palette.js',
  'call-site-validation.js','independent-range-expression.js','independent-guard-expression.js','native-current-contract.js','native-frozen-contract.js','native-gui-frozen-lower.js','native-gui-frozen-seal.js','native-gui-ir-v13.js','sealed-native-gui-v13.js'
]);
requireAll('Single service-worker ownership', files.bootstrap, ['navigator.serviceWorker.register','patch-studio-sw-reload-guard']);
rejectAll('Accessibility worker ownership', files.accessibility, ['serviceWorker.register']);
rejectAll('Playground worker ownership', files.playground, ['serviceWorker.register']);
requireAll('Service worker complete browser graph and type-safe fallback', files.sw, [
  './studio-command-palette.css','./studio-command-palette.js','./src/call-site-validation.js','./src/independent-range-expression.js',
  './src/independent-guard-expression.js','./src/native-current-contract.js','./src/native-frozen-contract.js','./src/native-gui-frozen-lower.js','./src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js','const navigation = event.request.mode === \'navigate\'','throw error'
]);

requireAll('Formal claim boundary', files.formal, ['beta.32']);
requireAll('Runtime correspondence boundary', files.runtime, ['beta.32']);
requireAll('Paper boundary', files.paper, ['beta.32']);
requireAll('Production external gates remain open', files.production, ['real credentialed Windows code-signing evidence','real credentialed macOS signing + notarization evidence','manual assistive-technology/browser accessibility audit']);
requireAll('Roadmap research gates remain open', files.roadmap, ['controlled paper-quality benchmark runs','genuine external/third-party plugin or extension integration study','expert/venue feedback']);

console.log('Patch project surface is synchronized: beta.35+ product, current SPEC/paper product boundary, Change IR 0.10, Native GUI IR 1.3, payload v13, runtime v1.4; beta.32 assurance unchanged.');
