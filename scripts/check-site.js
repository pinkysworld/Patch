#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const beta = /^0\.2\.0-beta\.(\d+)$/.exec(pkg.version)?.[1];
if (!beta) throw new Error(`Unexpected project version ${pkg.version}`);

const required = [
  '_site/index.html','_site/style.css','_site/designer-inspector.css','_site/forms-designer.css','_site/playground.js','_site/forms-designer.js','_site/native-build.js','_site/sw.js','_site/manifest.webmanifest','_site/icon.svg',
  '_site/src/interpreter.js','_site/src/parser.js','_site/src/expression.js','_site/src/change.js','_site/src/change-analysis.js','_site/src/range-analysis.js',
  '_site/src/formal-range.js','_site/src/formal-guard.js','_site/src/formal-calls.js','_site/src/formal-bridge.js','_site/src/formal-source.js',
  '_site/src/source-validation.js','_site/src/guard-validation.js','_site/src/compiler.js','_site/src/bundle.js','_site/src/wasm.js','_site/src/wasm-direct.js',
  '_site/src/c99.js','_site/src/webapp.js','_site/src/window-webapp.js','_site/src/window-build.js','_site/src/window-events.js','_site/src/designer.js','_site/src/form-layout.js',
  '_site/src/window-compiled.js','_site/src/native-gui-ir.js','_site/src/sealed-native-gui.js','_site/src/sealed-native-package.js','_site/src/prebuilt-native.js','_site/src/prebuilt-window.js','_site/src/local-native-kit.js',
  '_site/src/concrete-call-witness.js','_site/src/concrete-call-certificate.js','_site/src/concrete-call-body.js','_site/src/concrete-call-body-certificate.js'
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing generated site file: ${rel}`);

const html = read('_site/index.html');
requireAll('index assets', html, ['./style.css','./manifest.webmanifest','./native-build.js','./playground.js','./forms-designer.js','./icon.svg']);
for (const id of [
  'code','run','build','buildTarget','output','changes','ir','app','designer','designerCanvas','addText','addButton','addInput','addCombo','addListbox','addTabs',
  'projectName','projectKind','nativeBuildPanel','nativeBuildToken','nativeBuildStatus'
]) requireText('index UI', html, `id="${id}"`);
requireAll('index current release', html, [
  `0.2 beta.${beta}`, `Beta ${pkg.version}`, 'Change IR 0.10',
  'Beta.32 invocation-frame direct-Wasm correspondence', 'GeneratedTransitiveRuntimeCertificate.lean',
  'GeneratedRepeatedTransitiveRuntimeCertificate.lean', 'invocation-frame',
  'Windows App (.exe)', 'macOS App (.app)', 'Linux App', 'FreeBSD Console', 'value="tabsWindow"'
]);
for (const option of [
  'value="web"','value="native-windows"','value="native-macos"','value="native-linux"','value="native-freebsd"',
  'value="wasm-direct"','value="wasm-bootstrap"'
]) requireText('build selector', html, option);

const playground = read('_site/playground.js');
rejectOutsideSiteImport('playground', playground);
requireAll('playground imports', playground, [
  './src/interpreter.js','./src/compiler.js','./src/bundle.js','./src/wasm.js','./src/wasm-direct.js','./src/webapp.js',
  './src/window-events.js','./src/designer.js'
]);
requireAll('playground Designer/runtime contract', playground, [
  'triggerWindowEvent','listDesignerControls','updateDesignerControl','removeDesignerControl','designerInspectorApply',
  "control.type === 'checkbox'", "input.type = 'checkbox'", 'value: input.checked',
  "control.type === 'combo'", "control.type === 'listbox'", "document.createElement('select')", 'patch-listbox', 'el.size = Math.min',
  "control.type === 'tabs'", 'patch-tabs-list', 'patch-tab-button', 'patch-tab-panel', 'aria-selected', "addControl('tabs')",
  'designerInspectorOptions', 'splitOptionExpressions',
  'model.visible === false', "addEventListener('input'", 'Direct WebAssembly currently supports Console projects only'
]);

const inspectorCss = read('_site/designer-inspector.css');
requireAll('Designer inspector stylesheet', inspectorCss, ['.designer-inspector','.designer-control','.designer-selected']);

const formsDesigner = read('_site/forms-designer.js');
rejectOutsideSiteImport('forms designer', formsDesigner);
requireAll('forms designer contract', formsDesigner, [
  './src/designer.js','addDesignerWindow','updateDesignerWindow','updateDesignerControl',
  'installCheckboxTool','addCheckbox', "['#addCheckbox', 'checkbox']", "['#addCombo', 'combo']", "['#addListbox', 'listbox']", "['#addTabs', 'tabs']",
  "control.type === 'listbox'", "control.type === 'tabs'", 'patchFormSelect','patchAddForm','patchFormName','patchControlX','patchControlWidth','pointerdown','patch-form-resize-handle'
]);
const formsCss = read('_site/forms-designer.css');
requireAll('forms designer stylesheet', formsCss, ['.forms-toolbar-group','.patch-checkbox','.patch-form-layout','.patch-form-resize-handle','.forms-geometry-grid']);
const formLayout = read('_site/src/form-layout.js');
requireAll('shared form layout runtime', formLayout, ['PATCH_FORM_LAYOUT_VERSION','buildFormLayoutManifest','applyFormLayout','patch-source-backed-form-layout','checkbox','radio','combo','listbox','tabs']);
const webapp = read('_site/src/webapp.js');
requireAll('Window Web form layout bridge', webapp, ['./form-layout.js','data-patch-form-layout','patchApplyFormLayout','formLayoutVersion']);
const windowWebapp = read('_site/src/window-webapp.js');
requireAll('Window Web Form lifecycle/runtime controls', windowWebapp, [
  "PATCH_WINDOW_WEB_VERSION = '0.8'", "control.type==='checkbox'", "el.type='checkbox'", 'value:el.checked',
  "control.type==='combo'||control.type==='listbox'", 'el.size=Math.min', "document.createElement('select')", 'node.options.map(uiOption)', "value:el.value",
  "control.type==='tabs'", 'tabSelections=new Map', 'patch-tabs-list', 'patch-tab-panel', 'function buildUIItems', 'function findControl',
  "case 'openForm'", "case 'closeForm'", 'formVisibility', 'shell.hidden=model.visible===false'
]);
const windowEvents = read('_site/src/window-events.js');
requireAll('typed Window changed events', windowEvents, [
  "PATCH_WINDOW_EVENTS_VERSION = '0.5'", "controlType === 'checkbox'", 'Boolean event-local value',
  "['input', 'combo', 'listbox', 'radio'].includes(controlType)", 'text event-local value', 'function findControlType'
]);

const designer = read('_site/src/designer.js');
requireAll('named Form Designer source contract', designer, [
  'nextFormId','renameFormActions','window ${titleExpr} as ${id}', 'open|close', "['combo', 'listbox', 'radio'].includes(control.type)",
  'A ${label} needs at least two options', "type === 'radio'", "type === 'listbox'", "type === 'tabs'", 'tab "General"', 'tab "Advanced"'
]);
const windowBuild = read('_site/src/window-build.js');
requireAll('Window Form lifecycle build validation', windowBuild, [
  'openForm','closeForm','namedForms','formActions','tabs: tabs.size', 'transient page selection',
  "Form name '${node.id}' is declared more than once", "controlType === 'combo'", "controlType === 'listbox'", "controlType === 'radio'"
]);
const compiledWindow = read('_site/src/window-compiled.js');
requireAll('compiled Window artifact contract', compiledWindow, [
  "PATCH_COMPILED_WINDOW_VERSION = '0.2'", "PATCH_COMPILED_WINDOW_FORMAT = 'patch-compiled-window-program'",
  "PATCH_COMPILED_WINDOW_IR_VERSION = '0.10'", 'buildCompiledWindowArtifact','validateCompiledWindowArtifact','runCompiledWindow','formLayout'
]);

const nativeBuild = read('_site/native-build.js');
rejectOutsideSiteImport('native builder', nativeBuild);
requireAll('native builder imports', nativeBuild, [
  './src/compiler.js','./src/wasm-direct.js','./src/c99.js','./src/window-build.js','./src/window-compiled.js',
  './src/native-gui-ir.js','./src/sealed-native-gui.js','./src/sealed-native-package.js',
  './src/prebuilt-native.js','./src/prebuilt-window.js'
]);
requireAll('native builder modes', nativeBuild, [
  'native-windows','native-macos','native-linux','native-freebsd','validateWindowRuntimeSupport','compileToC99',
  'buildNativeGuiIR','sealNativeGuiRuntime','buildLinuxNativeGuiPackage','buildMacosNativeGuiPackage',
  'buildCompiledWindowArtifact','buildPrebuiltCompiledWindowPackage','prebuiltNativeTemplateUrl',
  'Ready app download (no token)','workflow_dispatch','source_b64'
]);
const nativeGui = read('_site/src/native-gui-ir.js');
requireAll('Native GUI IR v0.5 Radio/Tabs contract', nativeGui, [
  "PATCH_NATIVE_GUI_IR_VERSION = '0.5'", 'flattenNativeGuiControls', "type: 'tabs'", "control.type === 'radio'", 'parentTabIndex', 'pageIndex', 'does not support nested Tabs'
]);
const sealedNative = read('_site/src/sealed-native-gui.js');
requireAll('sealed native GUI payload v5 Radio/Tabs contract', sealedNative, [
  'PATCH_SEALED_NATIVE_GUI_VERSION = 5', "if (type === 'tabs') return 7", "if (type === 'radio') return 8", 'parentTabIndex', 'pageIndex', 'Native Tabs payload needs at least two page titles', 'Native Radio payload needs at least two options'
]);

const prebuilt = read('_site/src/prebuilt-native.js');
requireAll('prebuilt native packager', prebuilt, [
  'PATCH_PREBUILT_NATIVE_VERSION','PATCH_SEALED_CONSOLE_VERSION','buildPrebuiltNativePackage','sealConsoleRuntimeBinary',
  'decodeSealedConsolePayload','appendStoredFilesToZip','patch-windows-console-runtime.bin','patch-macos-console-runtime.bin',
  'patch-linux-console-runtime.bin','patch-windows-window-runtime.zip','patch-macos-window-runtime.zip','patch-linux-window-runtime.zip'
]);
const prebuiltWindow = read('_site/src/prebuilt-window.js');
requireAll('compiled prebuilt Window packager', prebuiltWindow, [
  "PATCH_PREBUILT_WINDOW_PAYLOAD_VERSION = '0.4'", 'buildPrebuiltCompiledWindowPackage',
  "execution: 'compiled-window-program'", 'validateCompiledWindowArtifact'
]);

const concreteBody = read('_site/src/concrete-call-body.js');
requireAll('guarded concrete-call body producer', concreteBody, [
  "PATCH_CONCRETE_CALL_BODY_VERSION = '0.2'", 'buildFormalGuardExpression', "kind: 'branch'", 'evalGuardExact'
]);
const compiler = read('_site/src/compiler.js');
requireAll('compiler assurance and UI lifecycle modules', compiler, [
  "'./formal-bridge.js'","'./formal-source.js'","'./formal-calls.js'","'./source-validation.js'","'./guard-validation.js'",
  "PATCH_IR_VERSION = '0.10'", 'formalCalls','sourceValidation','guardValidation', 'OPEN_FORM','CLOSE_FORM','ui.form-lifecycle','ui.tabs','ui.radio','TABS','TAB_PAGE','fields.options'
]);

const sw = read('_site/sw.js');
rejectOutsideSiteImport('service worker', sw);
requireAll('service worker current release', sw, [
  `patch-studio-0.2-beta.${beta}-forms6`, "'./native-build.js'", "'./forms-designer.js'", "'./forms-designer.css'", "'./src/form-layout.js'", "'./src/window-compiled.js'",
  "'./src/prebuilt-window.js'", "'./src/compiler.js'", "'./src/formal-calls.js'", "'./src/formal-guard.js'", "'./src/guard-validation.js'", "'./src/window-events.js'", "'./src/prebuilt-native.js'", 'freshFirst'
]);

const manifest = JSON.parse(read('_site/manifest.webmanifest'));
if (manifest.name !== 'Patch Studio') throw new Error('PWA manifest name is not Patch Studio.');
if (manifest.display !== 'standalone') throw new Error('PWA manifest must use standalone display mode.');
if (!manifest.icons?.some(icon => icon.src === './icon.svg')) throw new Error('PWA manifest is missing the Patch icon.');

console.log(`ok generated Patch Studio site for ${pkg.version}`);

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function requireText(where, content, text) {
  if (!content.includes(text)) throw new Error(`${where} is missing required generated contract: ${text}`);
}
function requireAll(where, content, texts) { for (const text of texts) requireText(where, content, text); }
function rejectOutsideSiteImport(where, content) {
  if (content.includes("'../src/") || content.includes('"../src/')) throw new Error(`${where} still points outside the deployed site.`);
}
