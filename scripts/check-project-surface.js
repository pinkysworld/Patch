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
  studio: read('docs/PATCH_STUDIO.md'),
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
  sealed12: read('src/sealed-native-gui-v12.js'),
  sealed13: read('src/sealed-native-gui-v13.js'),
  buildSite: read('scripts/build-site.js'),
  sw: read('web/sw.js')
};

requireScript('build:site', 'node scripts/build-site.js');
requireScript('check:site', 'node scripts/check-site.js && node scripts/check-site-v10.js && node scripts/check-site-v12.js && node scripts/check-site-beta35.js');

requireAll('README current contract', files.readme, [
  'Current development beta: `0.2.0-beta.35`','Change IR: `0.10`','Native GUI IR: `1.3`','sealed payload: `v13`','sealed desktop runtime: `v1.4`',
  'Native GUI IR **1.3** / sealed payload **v13** / runtime **v1.4**','Native GUI IR **1.2** / payload **v12** / runtime **v1.3**',
  'TRACKBAR','NSSlider','GtkScale','GeneratedRepeatedTransitiveRuntimeCertificate.lean'
]);
requireAll('README frozen compatibility evidence', files.readme, [
  'Native GUI IR **0.8**','sealed payload **v9** / runtime **v1.0**','**Native GUI IR 1.1**','sealed payload **v10** / runtime **v1.1**','payload **v11** / runtime **v1.2**'
]);
rejectAll('README obsolete Slider boundary', files.readme, ['native v1.3 intentionally fails closed |','future versioned native contract adds parity']);

for (const [label, text] of [
  ['Studio', files.website],['Language', files.language],['Documentation page', files.docsPage],['Downloads page', files.downloadsPage],['Help page', files.helpPage]
]) requireAll(`${label} public version`, text, ['0.2 beta.35']);

requireAll('Studio current native contract', files.website, ['Native GUI IR 1.3','payload v13','runtime v1.4','native Slider','payload v12 / runtime v1.3 compatibility line remains Slider fail-closed']);
requireAll('Language current native contract', files.language, ['Native GUI IR 1.3','payload v13','runtime v1.4','TRACKBAR','NSSlider','GtkScale','frozen']);
requireAll('Documentation current map', files.docsPage, [
  'Native GUI IR 1.3 / payload v13 / runtime v1.4','IR 1.2 / payload v12 / runtime v1.3 frozen','beta.32 assurance boundary',
  'Center H/Center V, Default size and collision-aware Auto place','text-backed single-select and list-backed multi-select contracts','nested Table/TreeView structural Properties editing'
]);
requireAll('Downloads current native contract', files.downloadsPage, ['Native GUI IR <strong>1.3</strong>','payload <strong>v13</strong>','runtime <strong>v1.4</strong>','native-win32-runtime-v1.4','native-macos-runtime-v1.4','native-linux-runtime-v1.4']);
requireAll('Help current native contract', files.helpPage, ['Native GUI IR 1.3 / payload v13 / runtime v1.4','runtime-v1.4 releases','Native runtime v1.3 is TreeView-capable but Slider-free']);

for (const [label, text] of [
  ['Patch Studio docs', files.studio],['Studio authoring docs', files.studioSurface],['Slider docs', files.slider],['Offline compiler docs', files.offline],
  ['Native GUI docs', files.nativeGui],['Native apps docs', files.nativeApps],['Targets docs', files.targets],['Production readiness docs', files.production],['Roadmap', files.roadmap]
]) requireAll(`${label} current native line`, text, ['Native GUI IR **1.3**','v13','v1.4']);

requireAll('Slider current native evidence', files.slider, ['direct native backend **1.4**','sealed payload **v13**','sealed native runtime **v1.4**','TRACKBAR','NSSlider','GtkScale','Frozen v1.3 compatibility boundary']);
requireAll('Roadmap closed native Slider work', files.roadmap, ['Native GUI IR: **1.3**','current sealed native GUI payload: **v13**','current token-free Ready/offline native runtime: **v1.4**','native Slider parity through backend 1.4','Native Slider parity is **not** an open item anymore']);
rejectAll('Roadmap obsolete native Slider backlog', files.roadmap, ['native Slider parity through a **future versioned Native GUI IR/backend/payload/runtime contract**']);

for (const [label, text] of [
  ['Studio docs', files.studio],['Studio authoring docs', files.studioSurface],['Slider docs', files.slider],['Offline docs', files.offline],['Native GUI docs', files.nativeGui],['Native apps docs', files.nativeApps],['Targets docs', files.targets],['Production docs', files.production],['Roadmap', files.roadmap]
]) requireAll(`${label} frozen v1.3 compatibility`, text, ['v12','v1.3']);

requireAll('Compiler semantic contract', files.compilerJs, ["PATCH_IR_VERSION = '0.10'",'formalCalls','sourceValidation','guardValidation']);
requireAll('Window event adapter', files.windowEvents, ["PATCH_WINDOW_EVENTS_VERSION = '0.9'","controlType === 'slider'",'finite number']);
requireAll('Window target Slider gate', files.windowBuild, ['allowSlider','Slider is not enabled for this Window target']);
requireAll('Native GUI IR 1.3 implementation', files.gui13, ["PATCH_NATIVE_GUI_IR_V13_VERSION = '1.3'",'buildNativeGuiIRV13','slider']);
requireAll('Native payload v13 implementation', files.sealed13, ['PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION','sealNativeGuiRuntimeV13']);
requireAll('Frozen Native GUI IR 1.2 implementation', files.gui12, ["PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'",'buildNativeGuiIRV12']);
requireAll('Frozen payload v12 implementation', files.sealed12, ['PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12','sealNativeGuiRuntimeV12']);

requireAll('Site build complete browser compiler graph', files.buildSite, [
  "'site-navigation.css','site-refresh.css','site-pages.css'",'call-site-validation.js','independent-range-expression.js','independent-guard-expression.js','native-gui-ir-v13.js','sealed-native-gui-v13.js'
]);
requireAll('Service worker complete browser compiler graph', files.sw, [
  './src/call-site-validation.js','./src/independent-range-expression.js','./src/independent-guard-expression.js','./src/native-gui-ir-v13.js','./src/sealed-native-gui-v13.js'
]);

requireAll('Formal claim boundary', files.formal, ['beta.32']);
requireAll('Runtime correspondence boundary', files.runtime, ['beta.32']);
requireAll('Paper boundary', files.paper, ['beta.32']);
requireAll('Production external gates remain open', files.production, ['real credentialed Windows code-signing evidence','real credentialed macOS signing + notarization evidence','manual assistive-technology/browser accessibility audit']);
requireAll('Roadmap research gates remain open', files.roadmap, ['controlled paper-quality benchmark runs','genuine external/third-party plugin or extension integration study','expert/venue feedback']);

console.log('Patch project surface is synchronized: beta.35+, Change IR 0.10, Native GUI IR 1.3, payload v13, runtime v1.4; v12/v1.3 remains frozen compatibility; beta.32 assurance unchanged.');
