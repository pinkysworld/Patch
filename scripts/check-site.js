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

for (const rel of [
  '_site/index.html','_site/language.html','_site/docs.html','_site/downloads.html','_site/help.html',
  '_site/style.css','_site/site-navigation.css','_site/site-refresh.css','_site/site-pages.css',
  '_site/native-build.js','_site/runtime-integrity.js','_site/sw.js','_site/playground.js',
  '_site/project-lifecycle.js','_site/recovery-manager.js','_site/studio-outline.js','_site/slider-stage1.js','_site/table-stage1.js',
  '_site/tree-designer.js','_site/designer-selection.js','_site/designer-core-selection.js','_site/designer-workspace.js',
  '_site/designer-ux.js','_site/designer-ux.css','_site/designer-toolbox.js','_site/designer-toolbox.css',
  '_site/designer-structure-ux.js','_site/designer-structure-ux.css',
  '_site/form-designer-workflow.js','_site/form-designer-workflow.css','_site/designer-structural-keyboard.js','_site/designer-inspector.css',
  '_site/src/compiler.js','_site/src/studio-project.js','_site/src/window-build.js','_site/src/window-events.js',
  '_site/src/native-gui-ir-v08.js','_site/src/native-gui-ir-v11.js','_site/src/native-gui-ir-v12.js',
  '_site/src/native-tree-backend-adapter.js','_site/src/sealed-native-gui-v11.js','_site/src/sealed-native-gui-v12.js',
  '_site/src/sealed-native-package.js'
]) requireFile(rel);

const pages = ['index.html','language.html','docs.html','downloads.html','help.html'];
for (const page of pages) {
  const html = read(`_site/${page}`);
  requireAll(`${page} navigation`, html, ['./index.html','./language.html','./docs.html','./downloads.html','./help.html','class="site-tabs"']);
  requireAll(`${page} version`, html, [`data-patch-version="${pkg.version}"`]);
}

const index = read('_site/index.html');
requireAll('Studio shell', index, [
  'Patch Studio', 'id="code"', 'id="run"', 'id="build"', 'id="designer"', 'id="app"',
  'id="projectName"', 'id="projectKind"', 'id="exportProject"', 'id="importProject"',
  'id="recoverProject"', 'id="nativeBuildPanel"', 'id="nativeBuildStatus"',
  'Project Outline', 'multi-file project bundle v3', 'source-backed browser Slider Stage 1',
  'Slider Stage 1 is browser-only until a later versioned native contract adds parity',
  'hierarchical TreeView', 'runtime v1.3', 'Native GUI IR 1.2', 'payload v12',
  'Local-first Studio', 'Ready desktop builds', 'Explicit persistence', 'Quick start and shortcuts',
  'id="addSlider"', 'id="addTree"', './slider-stage1.js', './tree-designer.js', './designer-workspace.js',
  './designer-core-selection.js', './runtime-integrity.js', './native-build.js', './studio-outline.js'
]);
rejectAll('Studio shell', index, [
  'currently browser-only and native builds fail closed',
  'Current native Ready/AOT/offline Window builds do not claim list-backed multi-select ListBox support.'
]);

const refreshCss = read('_site/site-refresh.css');
requireAll('Shared website refresh', refreshCss, [
  '.site-tabs', '.studio-launchpad', '.studio-snapshot', '.studio-guide',
  '.docs-contract-grid', '.docs-commandbar', '.docs-search', '.doc-link',
  '@media (prefers-reduced-motion: reduce)', '@media (forced-colors: active)'
]);
const navigationCss = read('_site/site-navigation.css');
requireAll('Website navigation refresh import', navigationCss, ['@import url("./site-refresh.css")']);

const playground = read('_site/playground.js');
requireAll('Designer renderer boundary', playground, [
  'installDesignerInspector()', 'designerInspectorEmpty', 'designerInspectorForm',
  'el.dataset.windowIndex = String(windowIndex)', 'el.dataset.controlIndex = String(controlIndex)'
]);
rejectAll('Designer renderer boundary', playground, [
  'designerSelection', 'designerControls', 'currentDesignerControl', 'selectDesignerControl',
  'renderDesignerInspector', 'applyDesignerProperties', 'removeSelectedDesignerControl', 'revealSelectedDesignerSource',
  'addDesignerControl', 'removeDesignerControl', 'updateDesignerControl'
]);

const sharedSelection = read('_site/designer-selection.js');
requireAll('Shared Designer selection store', sharedSelection, [
  'patch-designer-selection-change', 'designerSelectionForControl', "control.type === 'table'", "control.type === 'tree'",
  "control.type === 'table' ? 'table' : control.type === 'tree' ? 'tree' : 'core'"
]);
const coreSelection = read('_site/designer-core-selection.js');
requireAll('Core Designer selection bridge', coreSelection, [
  'CORE_TOOL_TYPES', "designerSelectionForControl(control, 'core')", 'captureToolboxIntent',
  'captureCoreSelection', 'captureCoreSelectionKey', 'add-core-control', 'missing-core-control',
  'installSharedInspectorBridge', 'applySharedInspector', 'captureInspectorDelete', 'captureInspectorSource',
  'populateSharedInspector', 'decorateDesignerAdapterElement', 'patchDesignerAdapter',
  'if (type) type.textContent = displayControlType(control.type)', "if (type === 'tree') return 'TreeView'"
]);
const sliderStage = read('_site/slider-stage1.js');
requireAll('Slider Stage 1 Studio integration', sliderStage, ["document.querySelector('#addSlider')", 'addDesignerControl', "'slider'", 'patch-slider']);
const designerUx = read('_site/designer-ux.js');
requireAll('Designer UX workflow', designerUx, [
  'designer-context-group', 'Focus selected', 'Focus form', 'designer-form-settings', 'patchFormCount',
  "event.key !== 'Escape'", 'Property changes ready to apply.', 'Source-backed · up to date.'
]);
const designerUxCss = read('_site/designer-ux.css');
requireAll('Designer UX presentation', designerUxCss, [
  '.designer-context-group', '.designer-form-settings-panel', '.inspector-state', '.designer-focus-pulse',
  '@media (max-width: 640px)', '@media (prefers-reduced-motion: reduce)'
]);
const toolbox = read('_site/designer-toolbox.js');
requireAll('Designer toolbox discovery', toolbox, [
  'DESIGNER_TOOL_CATALOG', "type: 'slider'", "buttonId: 'addSlider'", "group: 'Basic'", "group: 'Choices'", "group: 'Data'", "group: 'Containers'",
  'designerAddControl', 'button.click()', 'Ctrl/Cmd+Shift+A'
]);
const toolboxCss = read('_site/designer-toolbox.css');
requireAll('Designer toolbox presentation', toolboxCss, [
  '.designer-add-control-picker', '@media (max-width: 760px)', 'button[id^="add"]', 'display: none',
  '@media (forced-colors: active)'
]);
const structureUx = read('_site/designer-structure-ux.js');
requireAll('Structural Properties usability', structureUx, [
  'filterStructureLabels', 'structuralEditorSummary', 'designer-structure-overview', 'Filter nodes', 'Filter pages',
  'Filter page controls', 'No rows yet', 'Add first row', 'clickExisting', 'button.click()'
]);
rejectAll('Structural Properties usability', structureUx, ['code.value', 'addDesignerControl', 'updateDesignerTableData', 'updateDesignerTreeNodes']);
const structureUxCss = read('_site/designer-structure-ux.css');
requireAll('Structural Properties presentation', structureUxCss, [
  '.designer-structure-overview', '.designer-structure-filter', '.designer-structure-empty',
  '@media (max-width: 760px)', '@media (forced-colors: active)'
]);
const formWorkflow = read('_site/form-designer-workflow.js');
requireAll('Active Form Designer workflow', formWorkflow, [
  'suggestDesignerFormSize', 'patchPreviousForm', 'patchNextForm', 'Alt+PageUp', 'Alt+PageDown',
  'patchFitFormControls', 'patchDefaultFormSize', 'designer-active-form', 'updateDesignerWindow(code.value, windowIndex, size)'
]);
const formWorkflowCss = read('_site/form-designer-workflow.css');
requireAll('Active Form Designer presentation', formWorkflowCss, [
  '.designer-form-nav', '.designer-active-form', '.designer-form-size-actions', '.designer-form-action-status'
]);

const treeDesigner = read('_site/tree-designer.js');
requireAll('TreeView Designer integration', treeDesigner, [
  "addDesignerControl(code.value, 'tree'", 'installDesignerSelectionBridge', 'selectDesignerElement',
  'decorateDesignerAdapterElement', 'restoreDesignerAdapterSelection', 'patch-tree-designer-control'
]);
rejectAll('TreeView Designer integration', treeDesigner, [
  'designerInspectorApply', 'designerInspectorDelete', 'designerInspectorSource', 'function installInspectorBridge',
  "type.textContent = 'TreeView'", 'updateDesignerControl', 'removeDesignerControl'
]);
const tableDesigner = read('_site/table-stage1.js');
requireAll('Table Designer integration', tableDesigner, [
  "addDesignerControl(code.value, 'table'", 'installDesignerSelectionBridge', 'selectDesignerElement',
  'decorateDesignerAdapterElement', 'restoreDesignerAdapterSelection'
]);
rejectAll('Table Designer integration', tableDesigner, [
  'designerInspectorApply', 'designerInspectorDelete', 'designerInspectorSource', 'function installInspectorBridge',
  'updateDesignerControl', 'removeDesignerControl'
]);
const designerWorkspace = read('_site/designer-workspace.js');
requireAll('Designer Properties workspace', designerWorkspace, [
  "import './designer-structure-ux.js'", "import './designer-ux.js'", "import './form-designer-workflow.js'", "import './designer-toolbox.js'",
  'patch-studio-designer-properties-v1', 'designerPropertiesToggle', 'designer-inspector-resize', 'setPointerCapture'
]);
const structuralKeyboard = read('_site/designer-structural-keyboard.js');
requireAll('Designer structural keyboard accessibility', structuralKeyboard, [
  'nextStructuralOptionIndex', 'structuralShortcut', 'aria-keyshortcuts', 'Control+Enter Meta+Enter',
  'data-tabs-tree-action', 'data-tabs-table-action', 'requestAnimationFrame'
]);
const designerCss = read('_site/designer-inspector.css');
requireAll('Designer layout', designerCss, [
  '--designer-inspector-width: 340px', '#designer #addSlider { top: 287px; }', '#designer #addTable { top: 321px; }',
  '#designer #addTree { top: 355px; }', '#designer #addTabs { top: 389px; }', '#designer #addSlider::before',
  'designer-properties-collapsed', 'designer-inspector-resize'
]);

const nativeBuild = read('_site/native-build.js');
requireAll('Studio native Ready builder', nativeBuild, [
  "./src/native-gui-ir-v12.js", "./src/sealed-native-gui-v12.js",
  'buildNativeGuiIRV12 as buildNativeGuiIR', 'sealNativeGuiRuntimeV12',
  'PATCH_SEALED_NATIVE_GUI_TREE_VERSION', 'allowTree: true',
  'Native single EXE (no token, recommended)', 'Native GTK app (no token, recommended)',
  'Native AppKit app (no token, unsigned)'
]);
rejectAll('Studio native Ready Slider boundary', nativeBuild, ['allowSlider: true']);

const downloads = read('_site/downloads.html');
requireAll('Downloads page', downloads, [
  'patch-windows-x64.exe','patch-macos-arm64','patch-macos-x64.tar.gz','patch-linux-x64','patch-freebsd-x64.tar.gz',
  'SHA256SUMS','Native GUI IR <strong>1.2</strong>','payload <strong>v12</strong>','runtime <strong>v1.3</strong>',
  'hierarchical TreeView','runtime-manifest.json','native-win32-runtime-v1.3','native-macos-runtime-v1.3','native-linux-runtime-v1.3',
  'Slider Stage 1 is currently a Patch Studio and Standalone Window Web feature',
  'Native Slider parity requires a future versioned native GUI contract'
]);

const docs = read('_site/docs.html');
requireAll('Documentation page', docs, [
  'One current map of Patch.', 'id="docFilter"', 'id="docFilterStatus"', 'Find docs',
  'docs/SLIDER_STAGE1.md','Slider Stage 1','docs/PATCH_STUDIO.md','docs/STUDIO_AUTHORING_SURFACE.md',
  'docs/STUDIO_SELECTION_ARCHITECTURE.md','docs/STUDIO_KEYBOARD_ACCESSIBILITY.md',
  'docs/COMPILER.md','docs/OFFLINE_COMPILER.md','docs/FORMAL_MODEL.md','docs/REPRODUCIBILITY_BUNDLE.md',
  'docs/NATIVE_GUI.md','docs/NATIVE_APPS.md','docs/TARGETS.md','docs/ROADMAP.md',
  'Native GUI IR 1.2 / payload v12 / runtime v1.3', 'beta.32 assurance boundary'
]);

const help = read('_site/help.html');
requireAll('Help page current control surface', help, [
  'Slider Stage 1', 'ListBox: single or multi-select', 'Keyboard-only structural Properties',
  'Ready runtime verification', 'Offline compiler', 'Native runtime v1.3 is TreeView-capable but Slider-free'
]);

const compiler = read('_site/src/compiler.js');
requireAll('Compiler release contract', compiler, ["PATCH_IR_VERSION = '0.10'", 'formalCalls', 'sourceValidation', 'guardValidation']);
const events = read('_site/src/window-events.js');
requireAll('Window event contract', events, ["PATCH_WINDOW_EVENTS_VERSION = '0.9'", "controlType === 'slider'", 'finite number', 'text-list event-local value']);
const windowBuild = read('_site/src/window-build.js');
requireAll('Window Slider capability gate', windowBuild, ['allowSlider', 'Slider', 'not enabled for this Window target']);
const gui12 = read('_site/src/native-gui-ir-v12.js');
requireAll('Native GUI IR 1.2', gui12, ["PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'", 'buildNativeGuiIRV12', "control.type = 'tree'"]);
const sealed12 = read('_site/src/sealed-native-gui-v12.js');
requireAll('sealed payload v12', sealed12, ['PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12', 'sealNativeGuiRuntimeV12', 'inspectNativeGuiTreesV12']);

const sw = read('_site/sw.js');
requireAll('Service worker current compiler cache', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.35'", "url.pathname.includes('/runtimes/')", './site-refresh.css',
  './slider-stage1.js','./designer-selection.js','./designer-core-selection.js','./designer-workspace.js','./designer-ux.js','./designer-ux.css',
  './designer-toolbox.js','./designer-toolbox.css','./designer-structure-ux.js','./designer-structure-ux.css',
  './form-designer-workflow.js','./form-designer-workflow.css','./tree-designer.js','./designer-structural-keyboard.js',
  './src/window-events.js','./src/native-gui-ir-v12.js','./src/native-tree-backend-adapter.js','./src/sealed-native-gui-v12.js'
]);

const integrity = read('_site/runtime-integrity.js');
requireAll('Runtime integrity gate', integrity, ['runtime-manifest.json','SHA-256','crypto.subtle']);

console.log('ok current Patch website: beta.35+ Studio refresh / searchable docs / Slider browser contract / native v1.3 fail-closed / completed core Designer surface');