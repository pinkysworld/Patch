#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const requireFile = rel => {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing beta.35 generated site file: ${rel}`);
};
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing: ${marker}`);
};
const rejectAll = (label, text, markers) => {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${label} contains obsolete text: ${marker}`);
};

if (pkg.version !== '0.2.0-beta.35') throw new Error(`beta.35 site validator requires package 0.2.0-beta.35, got ${pkg.version}`);

for (const rel of [
  '_site/index.html','_site/language.html','_site/docs.html','_site/paper.html','_site/downloads.html','_site/help.html',
  '_site/beta35-studio.js','_site/slider-stage1.js','_site/table-stage1.js','_site/src/webapp.js','_site/src/window-events.js','_site/src/window-build.js',
  '_site/src/native-gui-ir-v12.js','_site/src/native-gui-ir-v13.js','_site/src/sealed-native-gui-v12.js','_site/src/sealed-native-gui-v13.js','_site/sw.js'
]) requireFile(rel);

// beta.35 introduced browser ListBox multi-selection. beta.35+ product work later
// completed Slider in browser and in the additive Native GUI IR 1.3 / v13 / v1.4 line.
// The previous v12/v1.3 TreeView line remains frozen and Slider fail-closed.
const index = read('_site/index.html');
requireAll('beta.35+ Studio page', index, [
  'data-patch-version="0.2.0-beta.35"','0.2 beta.35+','value="sliderWindow">Slider app</option>','id="addSlider"','native Slider',
  'multi-file project bundle v3','source-backed Designer','Native GUI IR 1.3','payload v13','runtime v1.4','payload v12 / runtime v1.3 compatibility line remains Slider fail-closed',
  'explicit <b>change</b>','./beta35-studio.js?v=','./slider-stage1.js?v=','./table-stage1.js?v=',
  'id="editorCaret"','Contracts and quick start','status-chip','IR 1.3 / v1.4'
]);
rejectAll('beta.35+ Studio page', index, [
  'Slider Stage 1 is browser-only until a later versioned native contract adds parity',
  'list-backed multi-select ListBox is currently browser-only and native builds fail closed'
]);

const beta35Studio = read('_site/beta35-studio.js');
requireAll('beta.35 Studio example module', beta35Studio, [
  "option.value = 'listboxMultiWindow'","option.textContent = 'Multi-select ListBox'",'create list fruits = ["Banana", "Mango"]',"document.querySelector('#tabDesigner')?.click()"
]);

const sliderStudio = read('_site/slider-stage1.js');
requireAll('Slider Stage 1 Studio module', sliderStudio, ["document.querySelector('#addSlider')",'addDesignerControl',"'slider'",'patch-slider']);

const studioAdapter = read('_site/table-stage1.js');
requireAll('Studio multi-select ListBox adapter', studioAdapter, ['appListboxSelections','collectListInitials','select.multiple = true','aria-multiselectable','select.selectedOptions','patch-studio-table-changed']);

const webapp = read('_site/src/webapp.js');
requireAll('Standalone Web multi-select ListBox contract', webapp, ['addWindowListboxMultiselect','hasListBackedListbox','listboxSelections=new Map()',"el.multiple=true",'selectedOptions',"listboxMultiSelectMode: 'list-state-text-list'"]);

const events = read('_site/src/window-events.js');
requireAll('Window event adapter current contract', events, ["PATCH_WINDOW_EVENTS_VERSION = '0.9'","controlType === 'slider'",'finite number',"controlType === 'listbox'","stateType === 'list'",'text-list event-local value']);
const windowBuild = read('_site/src/window-build.js');
requireAll('Slider target capability boundary', windowBuild, ['allowSlider','Slider','not enabled for this Window target']);

const nativeGuiV12 = read('_site/src/native-gui-ir-v12.js');
requireAll('Frozen Native GUI IR 1.2 TreeView extension', nativeGuiV12, ["PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'",'buildNativeGuiIRV12',"control.type = 'tree'"]);
const sealedV12 = read('_site/src/sealed-native-gui-v12.js');
requireAll('frozen sealed payload v12 TreeView contract', sealedV12, ['PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12','sealNativeGuiRuntimeV12','inspectNativeGuiTreesV12']);
const nativeGuiV13 = read('_site/src/native-gui-ir-v13.js');
requireAll('Current Native GUI IR 1.3 Slider extension', nativeGuiV13, ["PATCH_NATIVE_GUI_IR_V13_VERSION = '1.3'",'buildNativeGuiIRV13','slider']);
const sealedV13 = read('_site/src/sealed-native-gui-v13.js');
requireAll('current sealed payload v13 Slider contract', sealedV13, ['PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION','sealNativeGuiRuntimeV13']);

const language = read('_site/language.html');
requireAll('beta.35 Language page', language, ['data-patch-version="0.2.0-beta.35"','Slider Stage 1 uses transient numbers','slider 0..100 as volume step 5','ListBox selection follows the state type','create list fruits','Native GUI IR 1.3','runtime v1.4','Things are own-field records','fail closed on Things']);

const docs = read('_site/docs.html');
requireAll('beta.35 Documentation page', docs, ['docs/SLIDER_STAGE1.md','Slider Stage 1','Native GUI IR 1.3 / payload v13 / runtime v1.4','Thing fields such as player.score']);

const paper = read('_site/paper.html');
requireAll('beta.35 Paper page', paper, ['data-patch-version="0.2.0-beta.35"','Working manuscript','Native GUI IR 1.3','no controlled paper-quality timing dataset yet','not an end-to-end compiler theorem','checkedObservedTransitiveRuntimeRefinesCallerSignature','id="open-gates"','Still open','genuine external/third-party']);

const help = read('_site/help.html');
requireAll('beta.35 Help page', help, ['data-patch-version="0.2.0-beta.35"','ListBox: single or multi-select','Ready runtime verification','Offline compiler','Native GUI IR 1.3 / payload v13 / runtime v1.4','Thing fields as <code>player.score</code>','patch doctor','PATCH2003','file:line']);

const downloads = read('_site/downloads.html');
requireAll('beta.35+ Downloads page', downloads, ['data-patch-version="0.2.0-beta.35"','Native GUI IR <strong>1.3</strong>','payload <strong>v13</strong>','runtime <strong>v1.4</strong>','native Slider','SHA256SUMS','runtime-manifest.json','Native GUI IR 1.2 / payload v12 / runtime v1.3','self-checks the interpreter, direct Wasm and C99 numeric subset']);
rejectAll('beta.35+ Downloads page', downloads, ['Native Slider parity requires a future versioned native GUI contract']);

const sw = read('_site/sw.js');
requireAll('beta.35 Service Worker', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.35'","url.pathname.includes('/runtimes/')","const navigation = event.request.mode === 'navigate'","const htmlAsset = sameOrigin","freshFirst = navigation || codeAsset || htmlAsset || runtimeAsset",'./slider-stage1.js','./src/window-events.js',
  './src/native-gui-ir-v12.js','./src/native-gui-ir-v13.js','./src/sealed-native-gui-v12.js','./src/sealed-native-gui-v13.js',
  './src/call-site-validation.js','./src/independent-range-expression.js','./src/independent-guard-expression.js','if (navigation)','throw error'
]);

console.log('ok Patch Studio beta.35+ native Slider v1.4 with frozen v1.3 compatibility surface');
