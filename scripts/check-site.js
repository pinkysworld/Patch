#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const beta = /^0\.2\.0-beta\.(\d+)$/.exec(pkg.version)?.[1];
if (!beta) throw new Error(`Unexpected project version ${pkg.version}`);

const required = [
  '_site/index.html','_site/language.html','_site/docs.html','_site/help.html',
  '_site/style.css','_site/site-navigation.css','_site/site-pages.css','_site/studio-accessibility.css','_site/designer-inspector.css','_site/forms-designer.css','_site/form-window-resize.css','_site/project-lifecycle.css','_site/recovery-manager.css','_site/studio-diagnostics.css',
  '_site/playground.js','_site/forms-designer.js','_site/form-window-resize.js','_site/native-build.js','_site/project-lifecycle.js','_site/project-config-restore.js','_site/recovery-manager.js','_site/studio-diagnostics.js','_site/studio-accessibility.js','_site/sw.js','_site/manifest.webmanifest','_site/icon.svg',
  '_site/src/interpreter.js','_site/src/parser.js','_site/src/expression.js','_site/src/change.js','_site/src/change-analysis.js','_site/src/range-analysis.js',
  '_site/src/formal-range.js','_site/src/formal-guard.js','_site/src/formal-calls.js','_site/src/formal-bridge.js','_site/src/formal-source.js',
  '_site/src/source-validation.js','_site/src/guard-validation.js','_site/src/compiler.js','_site/src/diagnostics.js','_site/src/artifact-name.js','_site/src/bundle.js','_site/src/wasm.js','_site/src/wasm-direct.js',
  '_site/src/c99.js','_site/src/webapp.js','_site/src/window-webapp.js','_site/src/window-build.js','_site/src/window-events.js','_site/src/designer.js','_site/src/form-layout.js','_site/src/studio-project.js','_site/src/studio-diagnostics.js',
  '_site/src/window-compiled.js','_site/src/native-gui-ir.js','_site/src/sealed-native-gui.js','_site/src/sealed-native-package.js','_site/src/prebuilt-native.js','_site/src/prebuilt-window.js','_site/src/local-native-kit.js',
  '_site/src/concrete-call-witness.js','_site/src/concrete-call-certificate.js','_site/src/concrete-call-body.js','_site/src/concrete-call-body-certificate.js'
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing generated site file: ${rel}`);

const html = read('_site/index.html');
requireAll('index assets', html, [
  './style.css','./site-navigation.css','./studio-accessibility.css','./form-window-resize.css','./manifest.webmanifest',
  './native-build.js','./project-lifecycle.js','./project-config-restore.js','./recovery-manager.js','./playground.js','./forms-designer.js','./form-window-resize.js','./studio-diagnostics.js','./studio-accessibility.js','./icon.svg'
]);
for (const id of [
  'skipToEditor','code','run','build','buildTarget','resultTabs','tabDesigner','tabApp','tabOutput','tabChanges','tabIr','output','changes','ir','app','designer','designerCanvas','addText','addButton','addInput','addRadio','addCombo','addListbox','addTabs',
  'projectName','projectKind','exportProject','importProject','recoverProject','importProjectFile','copyDiagnostics','downloadDiagnostics','diagnosticsState','nativeBuildPanel','nativeBuildToken','nativeBuildStatus'
]) requireText('index UI', html, `id="${id}"`);
requireAll('index accessibility contract', html, [
  'class="skip-link" href="#code"','role="tablist" aria-label="Result views"','role="tab" data-tab="designer"','aria-controls="designer"','role="tabpanel" aria-labelledby="tabDesigner"',
  'aria-keyshortcuts="Control+Enter Meta+Enter"','aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter"','role="status" aria-live="polite"','aria-labelledby="editorTitle"','tabindex="0"'
]);
requireAll('index current release', html, [
  `0.2 beta.${beta}`, `data-patch-version="${pkg.version}"`,
  'Windows App (.exe)', 'macOS App (.app)', 'Linux App', 'FreeBSD Console', 'value="tabsWindow"'
]);
requireSiteTabs('Studio', html, 'index.html');
if (html.includes('Small syntax. Visible changes. One Studio.')) throw new Error('Studio must not contain the long language marketing block.');
if (html.includes('class="site-info"')) throw new Error('Studio information content must live on separate site pages.');
for (const option of [
  'value="web"','value="native-windows"','value="native-macos"','value="native-linux"','value="native-freebsd"',
  'value="wasm-direct"','value="wasm-bootstrap"'
]) requireText('build selector', html, option);

const languagePage = read('_site/language.html');
const docsPage = read('_site/docs.html');
const helpPage = read('_site/help.html');
requireSiteTabs('Language', languagePage, 'language.html');
requireSiteTabs('Documentation', docsPage, 'docs.html');
requireSiteTabs('Help', helpPage, 'help.html');
requireAll('language page', languagePage, [
  `data-patch-version="${pkg.version}"`, `0.2 beta.${beta}`, 'Small syntax. Visible changes.', 'Explicit mutation', 'Change Contracts', 'Multiple backends', 'Beta.32 introduced invocation-frame-aware direct-Wasm correspondence'
]);
requireAll('documentation page', docsPage, [
  `data-patch-version="${pkg.version}"`, `0.2 beta.${beta}`, 'Patch documentation', 'docs/PATCH_STUDIO.md', 'docs/COMPILER.md', 'docs/CLI_CONTRACT.md', 'docs/FORMAL_MODEL.md', 'docs/NATIVE_APPS.md', 'docs/THREAT_MODEL.md'
]);
requireAll('help page', helpPage, [
  `data-patch-version="${pkg.version}"`, 'Design a Window app', 'lower-right corner', 'Designer scrollbars', '.patchproject', 'Copy diagnostics', 'Ready/no-token'
]);
const navCss = read('_site/site-navigation.css');
requireAll('site navigation stylesheet', navCss, ['.site-tabs','.site-tabs a[aria-current="page"]','overflow-x: auto',':focus-visible']);
const pagesCss = read('_site/site-pages.css');
requireAll('content page stylesheet', pagesCss, ['.content-page','.page-hero','.doc-links','.help-step','@media (max-width: 600px)']);

const accessibility = read('_site/studio-accessibility.js');
rejectOutsideSiteImport('Studio accessibility', accessibility);
requireAll('Studio accessibility behavior', accessibility, [
  'skipToEditor','resultTabs',"event.key === 'ArrowRight'", "event.key === 'ArrowLeft'", "event.key === 'Home'", "event.key === 'End'",'next.focus()','next.click()','syncResultTabs()',
  'event.ctrlKey || event.metaKey',"event.key !== 'Enter'",'if (event.shiftKey) buildButton?.click()','else runButton?.click()','hasOpenDialog()','attributeFilter: [\'class\']'
]);
const accessibilityCss = read('_site/studio-accessibility.css');
requireAll('Studio accessibility stylesheet', accessibilityCss, [
  '.skip-link',':focus-visible','@media (pointer: coarse)','min-height: 40px !important','@media (pointer: coarse) and (max-width: 760px)','@media (prefers-reduced-motion: reduce)','@media (forced-colors: active)','@media (max-width: 820px)','@media (max-width: 560px)','overscroll-behavior-inline: contain'
]);

const projectLifecycle = read('_site/project-lifecycle.js');
rejectOutsideSiteImport('project lifecycle', projectLifecycle);
requireAll('project lifecycle', projectLifecycle, [
  './src/studio-project.js','./src/artifact-name.js','patchStudio.project.v2','patchStudio.project.pending.v2','patchStudio.project.v1','patchStudio.project.pending.v1','patchStudio.recovery.v1','patchStudio.project',
  'bootstrapProjectStorage','persistBundle','addRecoverySnapshot','serializeRecoverySnapshots','parseStudioProjectBundle',
  'Exported ${filename}','Imported ${file.name}','project-lifecycle.css','patchArtifactFilename',
  'getRecoverySnapshotSummaries','createManualRecoverySnapshot','restoreRecoverySnapshot','exportRecoverySnapshot','deleteRecoverySnapshot','clearRecoverySnapshots',
  'buildTarget: state.buildTarget','buildTarget: buildTarget?.value','nativeBuildMode: nativeBuildMode?.value',
  'patch:open-recovery-manager','patch:recovery-changed','protectCurrentProject()'
]);
const projectRestore = read('_site/project-config-restore.js');
rejectOutsideSiteImport('project config restore', projectRestore);
requireAll('project config restore', projectRestore, ['./src/studio-project.js','patchStudio.project.v2','state.buildTarget','state.nativeBuildMode','buildTarget?.dispatchEvent','nativeBuildMode?.dispatchEvent']);
const projectCss = read('_site/project-lifecycle.css');
requireAll('project lifecycle stylesheet', projectCss, ['.project-actions','#saveState','button:disabled','@media (max-width: 720px)']);
const studioProject = read('_site/src/studio-project.js');
requireAll('Studio project schema', studioProject, [
  "PATCH_STUDIO_PROJECT_FORMAT = 'patch-studio-project'", 'PATCH_STUDIO_PROJECT_VERSION = 2',
  "PATCH_STUDIO_RECOVERY_FORMAT = 'patch-studio-recovery'", 'PATCH_STUDIO_RECOVERY_VERSION = 1',
  'PATCH_STUDIO_BUILD_TARGETS','PATCH_STUDIO_NATIVE_BUILD_MODES','PATCH_STUDIO_DEFAULT_BUILD_TARGET','PATCH_STUDIO_DEFAULT_NATIVE_BUILD_MODE',
  'buildStudioProjectBundle','validateStudioProjectBundle','parseStudioProjectBundle','parseStoredStudioProject','studioProjectFileStem',
  'createRecoverySnapshot','addRecoverySnapshot','STUDIO_PROJECT_FUTURE_VERSION','STUDIO_PROJECT_BUILD_TARGET','STUDIO_PROJECT_NATIVE_MODE','main.patch'
]);
const artifactNames = read('_site/src/artifact-name.js');
requireAll('artifact naming contract', artifactNames, ['PATCH_ARTIFACT_NAMING_VERSION = 1','patchArtifactStem','patchArtifactFilename',"case 'project'", "case 'web'", "case 'native-ready'", "case 'windows-exe'"]);

const recoveryManager = read('_site/recovery-manager.js');
rejectOutsideSiteImport('recovery manager', recoveryManager);
requireAll('recovery manager', recoveryManager, [
  './project-lifecycle.js','getRecoverySnapshotSummaries','createManualRecoverySnapshot','restoreRecoverySnapshot','exportRecoverySnapshot','deleteRecoverySnapshot','clearRecoverySnapshots',
  'patch:open-recovery-manager','patch:recovery-changed','showModal','Snapshot now','Clear all','Restore','Export','Delete','aria-live="polite"','recovery-manager.css'
]);
if (/localStorage/.test(recoveryManager)) throw new Error('Recovery manager must use the project lifecycle API instead of reading browser storage directly.');
const recoveryCss = read('_site/recovery-manager.css');
requireAll('recovery manager stylesheet', recoveryCss, ['.recovery-dialog','.recovery-list','overflow: auto','scrollbar-gutter: stable','@media (max-width: 620px)']);

const diagnostics = read('_site/studio-diagnostics.js');
rejectOutsideSiteImport('Studio diagnostics', diagnostics);
requireAll('Studio diagnostics browser integration', diagnostics, [
  './src/compiler.js','./src/studio-project.js','./src/studio-diagnostics.js','copyDiagnostics','downloadDiagnostics',
  'MutationObserver','unhandledrejection','navigator.clipboard','document.execCommand','serviceWorkerControlled','.patchreport',
  'Nothing uploaded','studio-diagnostics.css'
]);
if (/\bfetch\s*\(/.test(diagnostics) || /XMLHttpRequest/.test(diagnostics)) throw new Error('Studio diagnostics must remain local-only and contain no network upload path.');
const diagnosticsCss = read('_site/studio-diagnostics.css');
requireAll('Studio diagnostics stylesheet', diagnosticsCss, ['.support-actions','#diagnosticsState','.diagnostics-copy-fallback','@media (max-width: 720px)']);
const diagnosticsCore = read('_site/src/studio-diagnostics.js');
requireAll('Studio diagnostics schema', diagnosticsCore, [
  "PATCH_STUDIO_DIAGNOSTICS_FORMAT = 'patch-studio-diagnostics'", 'PATCH_STUDIO_DIAGNOSTICS_VERSION = 1',
  'sha256Text','redactDiagnosticText','redactSourceEchoes','buildStudioDiagnosticReport','serializeStudioDiagnosticReport',
  'sourceIncluded: false','uploaded: false','sourceEchoesRedacted: true','[redacted-token]','[redacted-email]'
]);

const playground = read('_site/playground.js');
rejectOutsideSiteImport('playground', playground);
requireAll('playground imports', playground, [
  './src/interpreter.js','./src/compiler.js','./src/bundle.js','./src/wasm.js','./src/wasm-direct.js','./src/webapp.js',
  './src/window-events.js','./src/designer.js','./src/studio-project.js'
]);
requireAll('playground Designer/runtime contract', playground, [
  'triggerWindowEvent','listDesignerControls','updateDesignerControl','removeDesignerControl','designerInspectorApply',
  "control.type === 'checkbox'", "input.type = 'checkbox'", 'value: input.checked',
  "control.type === 'radio'", "input.type = 'radio'", 'patch-radio', "addControl('radio')",
  "control.type === 'combo'", "control.type === 'listbox'", "document.createElement('select')", 'patch-listbox', 'el.size = Math.min',
  "control.type === 'tabs'", 'patch-tabs-list', 'patch-tab-button', 'patch-tab-panel', 'aria-selected', "addControl('tabs')",
  'designerInspectorOptions', 'splitOptionExpressions', "['combo', 'listbox', 'radio']", 'Local save unavailable',
  'changeContractTimer','studioProjectFileStem','model.visible === false', "addEventListener('input'", 'Direct WebAssembly currently supports Console projects only'
]);

const inspectorCss = read('_site/designer-inspector.css');
requireAll('Designer inspector stylesheet', inspectorCss, [
  '.designer-inspector','.designer-control','.designer-selected','#designer #addRadio::before',
  'height: clamp(580px, 72vh, 780px)','overflow-y: scroll !important','overscroll-behavior: contain'
]);

const formsDesigner = read('_site/forms-designer.js');
rejectOutsideSiteImport('forms designer', formsDesigner);
requireAll('forms designer contract', formsDesigner, [
  './src/designer.js','./src/form-layout.js','addDesignerWindow','updateDesignerWindow','updateDesignerControl','formControlDefaultSize',
  'installCheckboxTool','addCheckbox', "['#addCheckbox', 'checkbox']", "['#addRadio', 'radio']", "['#addCombo', 'combo']", "['#addListbox', 'listbox']", "['#addTabs', 'tabs']",
  'pendingReveal','revealPendingDesignerTarget','scrollIntoView','growFormForControl',
  'patchFormSelect','patchAddForm','patchFormName','patchControlX','patchControlWidth','pointerdown','patch-form-resize-handle'
]);
const formsCss = read('_site/forms-designer.css');
requireAll('forms designer stylesheet', formsCss, ['.forms-toolbar-group','.patch-checkbox','.patch-radio','.patch-form-layout','.patch-form-resize-handle','.forms-geometry-grid']);
const formWindowResize = read('_site/form-window-resize.js');
rejectOutsideSiteImport('form window resize', formWindowResize);
requireAll('form window resize behavior', formWindowResize, [
  './src/designer.js','updateDesignerWindow','patch-window-resize-handle','pointerdown','pointermove','pointerup','pointercancel',
  'MIN_FORM_WIDTH = 240','MIN_FORM_HEIGHT = 160',"'ArrowLeft'", "'ArrowRight'", "'ArrowUp'", "'ArrowDown'", 'patch:form-resized','scrollIntoView'
]);
const formWindowResizeCss = read('_site/form-window-resize.css');
requireAll('form window resize stylesheet', formWindowResizeCss, ['.patch-window.patch-window-resizable','max-width: none !important','cursor: nwse-resize','@media (pointer: coarse)','@media (forced-colors: active)']);
const formLayout = read('_site/src/form-layout.js');
requireAll('shared form layout runtime', formLayout, [
  'PATCH_FORM_LAYOUT_VERSION','PATCH_FORM_CONTROL_DEFAULTS','formControlDefaultSize','formControlDefaultLayout',
  'buildFormLayoutManifest','applyFormLayout','patch-source-backed-form-layout','checkbox','radio','combo','listbox','tabs'
]);
const webapp = read('_site/src/webapp.js');
requireAll('Window Web form layout bridge', webapp, ['./form-layout.js','data-patch-form-layout','patchApplyFormLayout','formLayoutVersion']);
const windowWebapp = read('_site/src/window-webapp.js');
requireAll('Window Web Form lifecycle/runtime controls', windowWebapp, [
  "PATCH_WINDOW_WEB_VERSION = '0.8'", "control.type==='checkbox'", "el.type='checkbox'", 'value:el.checked',
  "control.type==='combo'||control.type==='listbox'", 'el.size=Math.min', "document.createElement('select')", 'node.options.map(uiOption)', "value:el.value",
  "control.type==='tabs'", 'tabSelections=new Map', 'patch-tabs-list', 'patch-tab-button', 'patch-tab-panel', 'function buildUIItems', 'function findControl',
  "case 'openForm'", "case 'closeForm'", 'formVisibility', 'shell.hidden=model.visible===false'
]);
const windowEvents = read('_site/src/window-events.js');
requireAll('typed Window changed events', windowEvents, [
  "PATCH_WINDOW_EVENTS_VERSION = '0.6'", "controlType === 'checkbox'", 'Boolean event-local value',
  "['input', 'combo', 'listbox', 'radio'].includes(controlType)", 'text event-local value', 'function findControlType'
]);

const designer = read('_site/src/designer.js');
requireAll('named Form Designer source contract', designer, [
  './form-layout.js','formControlDefaultSize','nextControlLayout','growWindowToFit','nextFormId','renameFormActions','window ${titleExpr} as ${id}', 'open|close', "['combo', 'listbox', 'radio'].includes(control.type)",
  'A ${label} needs at least two options', "type === 'radio'", "type === 'listbox'", "type === 'tabs'", 'tab "General"', 'tab "Advanced"'
]);
const windowBuild = read('_site/src/window-build.js');
requireAll('Window Form/Menu lifecycle build validation', windowBuild, [
  'openForm','closeForm','namedForms','formActions','tabs: tabs.size','menuItems: menuItems.size','registerMenu','menuItem', 'transient page selection',
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
requireAll('Native GUI IR v0.7 Menu/Dialog/Radio/Tabs contract', nativeGui, [
  "PATCH_NATIVE_GUI_IR_VERSION = '0.7'", 'formControlDefaultLayout','flattenNativeGuiControls','flattenNativeGuiMenuItems', "type: 'tabs'", "type: 'menuItem'", 'menus: []', "kind: 'dialog'",
  "['combo', 'listbox', 'radio'].includes(control.type)", 'parentTabIndex', 'pageIndex', 'does not support nested Tabs'
]);
const sealedNative = read('_site/src/sealed-native-gui.js');
requireAll('sealed native GUI payload v8 responsive compatibility contract', sealedNative, [
  'PATCH_SEALED_NATIVE_GUI_VERSION = 8', 'PATCH_SEALED_NATIVE_GUI_PREVIOUS_VERSION = 7', 'writeLayoutPolicy', "policy.kind === 'anchor'", "policy.kind === 'dock'",
  'writer.u32(form.menus.length)', "writer.u8(4)", "if (type === 'tabs') return 7", "if (type === 'radio') return 8",
  'parentTabIndex', 'pageIndex', 'Native Tabs payload needs at least two page titles', 'Native Radio payload needs at least two options'
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
  "PATCH_IR_VERSION = '0.10'", 'formalCalls','sourceValidation','guardValidation', 'OPEN_FORM','CLOSE_FORM','ui.form-lifecycle','ui.tabs','ui.radio','ui.menu','ui.dialog','TABS','TAB_PAGE','MENU','MENU_ITEM','DIALOG','fields.options'
]);

const sw = read('_site/sw.js');
rejectOutsideSiteImport('service worker', sw);
requireAll('service worker current release', sw, [
  `const PATCH_RELEASE = '${pkg.version}'`, 'const REVISION = ', 'const CACHE = `${CACHE_PREFIX}${REVISION}`',
  "'./language.html'", "'./docs.html'", "'./help.html'", "'./site-navigation.css'", "'./site-pages.css'", "'./form-window-resize.js'", "'./form-window-resize.css'",
  "'./project-config-restore.js'", "'./native-build.js'", "'./forms-designer.js'", "'./project-lifecycle.js'", "'./recovery-manager.js'", "'./studio-diagnostics.js'", "'./studio-accessibility.js'", "'./src/studio-project.js'", "'./src/artifact-name.js'", "'./src/form-layout.js'", "'./src/window-compiled.js'",
  "'./src/prebuilt-window.js'", "'./src/compiler.js'", "'./src/formal-calls.js'", "'./src/formal-guard.js'", "'./src/guard-validation.js'", "'./src/window-events.js'", "'./src/prebuilt-native.js'", 'freshFirst'
]);

const manifest = JSON.parse(read('_site/manifest.webmanifest'));
if (manifest.name !== 'Patch Studio') throw new Error('PWA manifest name is not Patch Studio.');
if (manifest.display !== 'standalone') throw new Error('PWA manifest must use standalone display mode.');
if (!manifest.icons?.some(icon => icon.src === './icon.svg')) throw new Error('PWA manifest is missing the Patch icon.');

console.log(`ok generated Patch site for ${pkg.version}`);

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function requireText(where, content, text) {
  if (!content.includes(text)) throw new Error(`${where} is missing required generated contract: ${text}`);
}
function requireAll(where, content, texts) { for (const text of texts) requireText(where, content, text); }
function rejectOutsideSiteImport(where, content) {
  if (content.includes("'../src/") || content.includes('"../src/')) throw new Error(`${where} still points outside the deployed site.`);
}
function requireSiteTabs(label, content, file) {
  requireAll(`${label} navigation`, content, ['./index.html','./language.html','./docs.html','./help.html','class="site-tabs"']);
  const current = new RegExp(`<a href="\\./${file}" aria-current="page">${label}</a>`);
  if (!current.test(content)) throw new Error(`${label} page is missing its current navigation tab.`);
}
