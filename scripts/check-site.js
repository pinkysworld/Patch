import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('_site');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

for (const required of [
  'index.html', 'style.css', 'playground.js', 'forms-designer.js', 'forms-designer.css', 'native-build.js', 'native-local-kit.js', 'runtime-loader.js', 'sealed-runtime.js', 'sealed-native-gui.js', 'sealed-native-package.js', 'sw.js',
  'src/parser.js', 'src/interpreter.js', 'src/compiler.js', 'src/wasm-direct.js', 'src/window-webapp.js', 'src/window-events.js', 'src/window-build.js', 'src/form-layout.js', 'src/designer.js', 'src/native-gui-ir.js', 'src/native-result-dialog-overlay.js', 'src/win32-gui.js', 'src/win32-gui-v07.js', 'src/appkit-gui.js', 'src/appkit-gui-v07.js', 'src/gtk-gui.js', 'src/gtk-gui-v07.js', 'src/sealed-native-gui.js', 'src/sealed-native-package.js', 'src/range-analysis.js', 'src/change-analysis.js',
  'examples/counter-window.patch', 'examples/forms-navigation.patch', 'examples/input-window.patch', 'examples/checkbox-window.patch', 'examples/combo-window.patch', 'examples/listbox-window.patch', 'examples/radio-window.patch', 'examples/tabs-window.patch', 'examples/menu-dialog-window.patch', 'examples/result-dialog-window.patch', 'examples/range-why.patch'
]) if (!exists(required)) throw new Error(`site is missing ${required}`);

const html = read('index.html');
requireAll('Studio index', html, [
  'Patch Studio', 'Patch Code', 'id="source"', 'id="run"', 'id="preview"', 'id="download"', 'id="designer"', 'id="result"',
  'id="designerCanvas"', 'id="formsStatus"', 'id="patchFormSelect"', 'id="patchAddForm"', 'id="patchFormName"', 'id="patchFormWidth"', 'id="patchFormHeight"',
  'id="patchControlId"', 'id="patchControlText"', 'id="patchControlOptions"', 'id="patchControlX"', 'id="patchControlY"', 'id="patchControlWidth"', 'id="patchControlHeight"', 'id="patchDeleteControl"',
  'id="addText"', 'id="addButton"', 'id="addInput"', 'id="addCheckbox"', 'id="addCombo"', 'id="addListbox"', 'id="addRadio"', 'id="addTabs"',
  'id="projectType"', 'id="target"', 'id="nativePlatform"', 'id="nativeMode"', 'id="buildNative"', 'id="nativeStatus"', 'id="nativeToken"', 'id="nativeTokenField"',
  'value="counter"', 'value="formsNavigation"', 'value="inputWindow"', 'value="checkboxWindow"', 'value="comboWindow"', 'value="listboxWindow"', 'value="radioWindow"', 'value="tabsWindow"', 'value="menuDialogWindow"', 'value="resultDialogWindow"', 'value="rangeWhy"',
  'value="portable"', 'value="wasm"', 'value="wasm-direct"', 'value="c99"', 'value="web"', 'value="native"',
  'type="module" src="./playground.js"'
]);

const css = read('style.css');
requireAll('Studio stylesheet', css, [
  '.workspace', 'grid-template-columns:minmax(0,1fr)', '.result-pane', 'min-height:660px', '.forms-designer-canvas', 'min-height:575px',
  '.workspace > .result-pane', '.result-tab-panel.active'
]);

const playground = read('playground.js');
requireAll('Studio runtime', playground, [
  'PatchInterpreter','compile','buildStandaloneWebApp','buildNativeBuildPlan','installFormsDesigner','installNativeBuilder','PATCH_STUDIO_VERSION',
  'windowEvents','triggerWindowEvent','formsNavigation','inputWindow','checkboxWindow','comboWindow','listboxWindow','radioWindow','tabsWindow','menuDialogWindow','resultDialogWindow','rangeWhy',
  "addControl('checkbox')", "addControl('combo')", "addControl('listbox')", "addControl('radio')", "addControl('tabs')", "control.type === 'combo'", "control.type === 'listbox'", "control.type === 'radio'", "control.type === 'tabs'",
  'patch-tabs-list','patch-tab-button','aria-selected','patch-tab-panel','safeNativeId','Patch native build', 'registerServiceWorker'
]);

const nativeBuild = read('native-build.js');
requireAll('Studio native build integration', nativeBuild, [
  'buildNativeGuiIR','buildWindowsNativeGuiPackage','buildLinuxNativeGuiPackage','buildMacosNativeGuiPackage',
  'Native Win32 app (no token, recommended)','Native GTK app (no token, recommended)','Native AppKit app (no token, unsigned)',
  'Compatibility package (Electron, no token)','Native AOT app (GitHub Actions)','NATIVE_WINDOW_AOT_WORKFLOW','buildNativeWindowAotWorkflow','native GUI v0.7',
  'patch-windows-native-gui-runtime.exe','patch-linux-native-gui-runtime.bin','patch-macos-native-gui-runtime.bin'
]);

const formsDesigner = read('forms-designer.js');
requireAll('forms designer', formsDesigner, [
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
  "PATCH_WINDOW_EVENTS_VERSION = '0.6'", "controlType === 'checkbox'", 'Boolean event-local value',
  "['input', 'combo', 'listbox', 'radio'].includes(controlType)", 'text event-local value', 'function findControlType'
]);

const designer = read('_site/src/designer.js');
requireAll('named Form Designer source contract', designer, [
  'nextFormId','renameFormActions','window ${titleExpr} as ${id}', 'open|close', "['combo', 'listbox', 'radio'].includes(control.type)",
  'A ${label} needs at least two options', "type === 'radio'", "type === 'listbox'", "type === 'tabs'", 'tab "General"', 'tab "Advanced"'
]);
const windowBuild = read('_site/src/window-build.js');
requireAll('Window Form/Menu lifecycle build validation', windowBuild, [
  'openForm','closeForm','namedForms','formActions','tabs: tabs.size','menuItems: menuItems.size','registerMenu','menuItem', 'transient page selection',
  "Form name '${node.id}' is declared more than once", "controlType === 'combo'", "controlType === 'listbox'", "controlType === 'radio'"
]);
const nativeIr = read('_site/src/native-gui-ir.js');
requireAll('Native GUI IR v0.7', nativeIr, [
  "PATCH_NATIVE_GUI_IR_VERSION = '0.7'", 'confirmResult', 'fileResult', "action.kind === 'confirmDialog'", "action.kind === 'openFileDialog'", "action.kind === 'saveFileDialog'", 'eventValue'
]);
const sealedNative = read('_site/src/sealed-native-gui.js');
requireAll('sealed native GUI v7', sealedNative, ['PATCH_SEALED_NATIVE_GUI_VERSION = 7', 'confirmDialog', 'openFileDialog', 'saveFileDialog']);
const sw = read('sw.js');
requireAll('service worker', sw, ['patch-studio-0.2-beta.32-forms8', './src/native-result-dialog-overlay.js', './src/win32-gui-v07.js', './src/appkit-gui-v07.js', './src/gtk-gui-v07.js']);

console.log('ok Patch Studio site');

function requireText(where, content, text) {
  if (!content.includes(text)) throw new Error(`${where} is missing required generated contract: ${text}`);
}
function requireAll(where, content, texts) { for (const text of texts) requireText(where, content, text); }
