#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
const version = pkg.version;
if (version !== '0.2.0-beta.35') throw new Error(`Current project surface expects beta.35, got ${version}`);

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
  docsPage: read('web/docs.html'),
  downloadsPage: read('web/downloads.html'),
  helpPage: read('web/help.html'),
  siteRefresh: read('web/site-refresh.css'),
  studio: read('docs/PATCH_STUDIO.md'),
  studioSurface: read('docs/STUDIO_AUTHORING_SURFACE.md'),
  slider: read('docs/SLIDER_STAGE1.md'),
  offline: read('docs/OFFLINE_COMPILER.md'),
  nativeGui: read('docs/NATIVE_GUI.md'),
  roadmap: read('docs/ROADMAP.md'),
  compiler: read('docs/COMPILER.md'),
  formal: read('docs/FORMAL_MODEL.md'),
  novelty: read('docs/NOVELTY.md'),
  runtime: read('docs/RUNTIME_CORRESPONDENCE.md'),
  paper: read('paper/README.md'),
  paperMain: read('paper/main.tex'),
  compilerJs: read('src/compiler.js'),
  windowEvents: read('src/window-events.js'),
  windowBuild: read('src/window-build.js'),
  nativeGui12: read('src/native-gui-ir-v12.js'),
  sealed12: read('src/sealed-native-gui-v12.js'),
  offlineLinker: read('src/offline-linker.js'),
  nativeBuild: read('web/native-build.js'),
  serviceWorker: read('web/sw.js'),
  siteBuilder: read('scripts/build-site.js'),
  pagesWorkflow: read('.github/workflows/pages.yml'),
  treeWorkflow: read('.github/workflows/native-sealed-tree-runtime-v13.yml'),
  offlineWorkflow: read('.github/workflows/offline-compiler.yml')
};

requireScript('transitive-runtime-certify:example', 'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls.patch --out formal/GeneratedTransitiveRuntimeCertificate.lean');
requireScript('transitive-runtime-certify:repeated', 'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls-repeated.patch --out formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean');
requireScript('transitive-runtime-certify:mixed-guards', 'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls-mixed-guards.patch --out formal/GeneratedMixedGuardTransitiveRuntimeCertificate.lean');
requireScript('evaluate:assurance', 'node scripts/benchmark-assurance.js');
requireScript('evaluate:assurance:controlled', 'node scripts/run-controlled-assurance.js --measurement-class controlled');
requireScript('evaluate:security', 'node scripts/evaluate-security-cases.js');
requireScript('check:site', 'node scripts/check-site.js && node scripts/check-site-v10.js && node scripts/check-site-v12.js && node scripts/check-site-beta35.js');

requireAll('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`', 'Native GUI IR: `1.2`',
  'sealed desktop runtime: `v1.3`', 'canonical multi-file project bundle v3',
  'Slider Stage 1', 'hierarchical TreeView', 'payload v12 / runtime v1.3',
  'Current repository-controlled beta.35+ Studio/compiler backlog closed',
  'GeneratedRepeatedTransitiveRuntimeCertificate.lean'
]);
requireAll('web/index.html', files.website, [
  `data-patch-version="${version}"`, '0.2 beta.35+', 'multi-file project bundle v3',
  'source-backed browser Slider Stage 1', 'Slider Stage 1 is browser-only until a later versioned native contract adds parity',
  'Native GUI IR 1.2', 'payload v12', 'runtime v1.3', 'hierarchical TreeView', './runtime-integrity.js',
  'Local-first Studio', 'Ready desktop builds', 'Explicit persistence', 'Quick start and shortcuts'
]);
requireAll('web/docs.html', files.docsPage, [
  `data-patch-version="${version}"`, 'One current map of Patch.', 'id="docFilter"', 'Find docs',
  'docs/SLIDER_STAGE1.md', 'docs/PATCH_STUDIO.md', 'docs/STUDIO_AUTHORING_SURFACE.md',
  'docs/OFFLINE_COMPILER.md', 'docs/NATIVE_GUI.md', 'docs/ROADMAP.md',
  'Native GUI IR 1.2 / payload v12 / runtime v1.3', 'beta.32 assurance boundary'
]);
requireAll('web/downloads.html', files.downloadsPage, [
  `data-patch-version="${version}"`, 'SHA256SUMS', 'runtime-manifest.json',
  'Native GUI IR <strong>1.2</strong>', 'payload <strong>v12</strong>', 'runtime <strong>v1.3</strong>',
  'hierarchical TreeView', 'native-win32-runtime-v1.3',
  'Slider Stage 1 is currently a Patch Studio and Standalone Window Web feature'
]);
requireAll('web/help.html', files.helpPage, [
  'Slider Stage 1', 'Keyboard-only structural Properties', 'ListBox: single or multi-select',
  'Ready runtime verification', 'Offline compiler'
]);
requireAll('web/site-refresh.css', files.siteRefresh, [
  '.site-tabs', '.studio-launchpad', '.studio-snapshot', '.studio-guide',
  '.docs-contract-grid', '.docs-commandbar', '.docs-search', '@media (prefers-reduced-motion: reduce)'
]);
rejectAll('public current surfaces', files.website + files.downloadsPage, [
  'Current native Ready/AOT/offline Window builds do not claim list-backed multi-select ListBox support.',
  'list-backed multi-select ListBox is currently browser-only and native builds fail closed'
]);

requireAll('docs/PATCH_STUDIO.md', files.studio, [
  'Current status: 0.2 beta.35+', 'multi-file project bundle v3', 'Slider Stage 1',
  'The repository-controlled beta.35+ Studio/compiler backlog is currently closed',
  'Native GUI IR **1.2**', 'payload **v12**', 'runtime **v1.3**',
  'beta.32 invocation-frame'
]);
requireAll('docs/STUDIO_AUTHORING_SURFACE.md', files.studioSurface, [
  'Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table, TreeView and Tabs',
  'Slider Stage 1', 'manual assistive-technology validation',
  'current authoring surface for the **existing Patch UI/control vocabulary**, now including Slider Stage 1'
]);
requireAll('docs/SLIDER_STAGE1.md', files.slider, [
  'Slider Stage 1', 'Window event adapter **0.9**', 'finite **number**',
  'Native GUI IR **1.2**', 'sealed payload **v12**', 'native runtime **v1.3**',
  'future versioned Native GUI IR/backend/payload/runtime contract'
]);
requireAll('docs/NATIVE_GUI.md', files.nativeGui, [
  'Native GUI IR 1.2', 'sealed payload v12 / runtime v1.3', 'TreeView',
  'root-to-node display path', 'native-win32-runtime-v1.3'
]);
requireAll('docs/OFFLINE_COMPILER.md', files.offline, [
  'Native GUI IR **1.2**', 'payload **v12**', 'runtime **v1.3**',
  'hierarchical TreeView', 'payload **v11** / runtime **v1.2**'
]);
requireAll('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`,
  'The current beta.35+ Studio/compiler product backlog is closed.',
  'richer data-control surface beyond Table/Grid, ListBox and TreeView via source-backed Slider Stage 1',
  'structural/nested accessibility and keyboard refinement',
  'sealed payload v12 / runtime v1.3 TreeView parity',
  'token-free Ready/offline consumer switch to TreeView-capable payload v12 / runtime v1.3',
  'controlled paper-quality benchmark runs', 'genuine external/third-party plugin or extension integration study',
  'real credentialed Windows signing evidence', 'manual assistive-technology validation'
]);

requireAll('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", 'formalCalls', 'sourceValidation', 'guardValidation']);
requireAll('src/window-events.js', files.windowEvents, ["PATCH_WINDOW_EVENTS_VERSION = '0.9'", 'finite number', 'text-list event-local value']);
requireAll('src/window-build.js', files.windowBuild, ['allowSlider', 'Slider', 'not enabled for this Window target']);
requireAll('src/native-gui-ir-v12.js', files.nativeGui12, ["PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'", 'buildNativeGuiIRV12', "control.type = 'tree'"]);
requireAll('src/sealed-native-gui-v12.js', files.sealed12, ['PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12', 'sealNativeGuiRuntimeV12', 'inspectNativeGuiTreesV12']);
requireAll('src/offline-linker.js', files.offlineLinker, [
  'options.guiPayloadVersion ?? 12', 'allowTree: guiPayloadVersion >= 12', 'buildNativeGuiIRV12', 'sealNativeGuiRuntimeV12'
]);
rejectAll('current native Ready/offline Slider boundary', files.offlineLinker + files.nativeBuild, ['allowSlider: true']);
requireAll('web/native-build.js', files.nativeBuild, [
  'buildNativeGuiIRV12 as buildNativeGuiIR', 'PATCH_SEALED_NATIVE_GUI_TREE_VERSION',
  'sealNativeGuiRuntimeV12', 'allowTree: true', 'runtime v1.3'
]);
requireAll('web/sw.js', files.serviceWorker, [
  './site-refresh.css', './slider-stage1.js', '../src/window-events.js',
  '../src/native-gui-ir-v12.js', '../src/native-tree-backend-adapter.js', '../src/sealed-native-gui-v12.js'
]);
requireAll('scripts/build-site.js', files.siteBuilder, ["'site-navigation.css','site-refresh.css','site-pages.css'"]);

for (const tag of ['native-win32-runtime-v1.3','native-macos-runtime-v1.3','native-linux-runtime-v1.3']) {
  requireAll('.github/workflows/pages.yml', files.pagesWorkflow, [tag]);
}
requireAll('TreeView runtime release workflow', files.treeWorkflow, [
  'Patch Native Sealed TreeView Runtime v1.3', 'patch-windows-native-gui-runtime.exe',
  'patch-macos-native-gui-runtime.bin', 'patch-linux-native-gui-runtime.bin',
  'native-win32-runtime-v1.3', 'native-macos-runtime-v1.3', 'native-linux-runtime-v1.3'
]);
requireAll('offline compiler workflow', files.offlineWorkflow, [
  'win32-sealed-gui-v13.cpp', 'appkit-sealed-gui-v13.mm', 'gtk-sealed-gui-v13.cpp',
  'treeview-window.patch', 'payload v12', 'runtime v1.3'
]);

// Research assurance identity stays beta.32 even while the product surface advances.
requireAll('docs/COMPILER.md', files.compiler, ['Change IR **0.10**', 'Beta.32', 'invocation-frame']);
requireAll('docs/FORMAL_MODEL.md', files.formal, ['Beta.32', 'checkedObservedTransitiveRuntimeRefinesCallerSignature', 'runtime capture']);
requireAll('docs/NOVELTY.md', files.novelty, ['Beta.32', 'Expressibility is not the novelty claim']);
requireAll('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, ['Beta.32', 'invocation frame']);
requireAll('paper/README.md', files.paper, ['formal runtime-correspondence milestone: **beta.32**', 'no controlled paper-quality performance dataset has been collected yet']);
requireAll('paper/main.tex', files.paperMain, ['Beta 35 product artifact / Beta 32 assurance manuscript', 'no controlled paper-quality timing dataset yet']);

console.log('ok Patch project surface: closed beta.35+ core backlog / refreshed Studio+docs site / Slider browser contract / Native GUI IR 1.2 payload v12 runtime v1.3 / beta.32 assurance boundary');