#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const beta = /^0\.2\.0-beta\.(\d+)$/.exec(pkg.version)?.[1];
if (!beta) throw new Error(`Unexpected project version ${pkg.version}`);

const pages = ['index.html', 'language.html', 'docs.html', 'downloads.html', 'help.html'];
const staticAssets = [
  'style.css', 'site-navigation.css', 'site-pages.css', 'studio-accessibility.css',
  'designer-inspector.css', 'forms-designer.css', 'form-window-resize.css',
  'designer-multiselect.css', 'designer-responsive-layout.css', 'beta35-studio.css', 'project-lifecycle.css',
  'recovery-manager.css', 'studio-diagnostics.css', 'manifest.webmanifest', 'icon.svg'
];
const browserModules = [
  'playground.js', 'beta35-studio.js', 'forms-designer.js', 'table-stage1.js', 'designer-alignment.js',
  'designer-alignment-guides.js', 'designer-multiselect.js', 'designer-layout-policy.js',
  'designer-responsive-layout.js', 'form-window-resize.js', 'native-build.js',
  'project-lifecycle.js', 'project-config-restore.js', 'recovery-manager.js',
  'studio-diagnostics.js', 'studio-accessibility.js', 'sw.js'
];
const sourceModules = [
  'interpreter.js', 'parser.js', 'expression.js', 'change.js', 'change-analysis.js',
  'range-analysis.js', 'formal-range.js', 'formal-guard.js', 'formal-calls.js',
  'formal-bridge.js', 'formal-source.js', 'source-validation.js', 'guard-validation.js',
  'compiler.js', 'diagnostics.js', 'artifact-name.js', 'bundle.js', 'wasm.js',
  'wasm-direct.js', 'c99.js', 'webapp.js', 'window-webapp.js',
  'window-web-accessibility.js', 'window-build.js', 'window-events.js', 'designer.js',
  'form-layout.js', 'window-layout-policy.js', 'studio-project.js', 'studio-diagnostics.js',
  'window-compiled.js', 'native-gui-ir.js', 'native-gui-ir-v08.js',
  'sealed-native-gui.js', 'sealed-native-package.js', 'prebuilt-native.js',
  'prebuilt-window.js', 'local-native-kit.js', 'concrete-call-witness.js',
  'concrete-call-certificate.js', 'concrete-call-body.js', 'concrete-call-body-certificate.js'
];

for (const name of pages) requireFile(`_site/${name}`);
for (const name of staticAssets) requireFile(`_site/${name}`);
for (const name of browserModules) requireFile(`_site/${name}`);
for (const name of sourceModules) requireFile(`_site/src/${name}`);

const sitePages = new Map(pages.map(name => [name, read(`_site/${name}`)]));
for (const [file, content] of sitePages) {
  requireAll(`${file} navigation`, content, [
    './index.html', './language.html', './docs.html', './downloads.html', './help.html',
    'class="site-tabs"'
  ]);
  requireText(`${file} release`, content, `data-patch-version="${pkg.version}"`);
}
requireCurrentTab('Studio', 'index.html');
requireCurrentTab('Language', 'language.html');
requireCurrentTab('Documentation', 'docs.html');
requireCurrentTab('Downloads', 'downloads.html');
requireCurrentTab('Help', 'help.html');

const html = sitePages.get('index.html');
requireAll('Studio assets', html, [
  './style.css', './site-navigation.css', './studio-accessibility.css',
  './designer-multiselect.css', './designer-responsive-layout.css', './beta35-studio.css', './manifest.webmanifest',
  './native-build.js', './project-lifecycle.js', './project-config-restore.js',
  './recovery-manager.js', './playground.js', './beta35-studio.js', './forms-designer.js', './table-stage1.js',
  './designer-alignment-guides.js', './designer-multiselect.js',
  './designer-responsive-layout.js', './form-window-resize.js',
  './studio-diagnostics.js', './studio-accessibility.js', './icon.svg'
]);
for (const id of [
  'skipToEditor', 'code', 'run', 'build', 'buildTarget', 'resultTabs', 'tabDesigner',
  'tabApp', 'tabOutput', 'tabChanges', 'tabIr', 'output', 'changes', 'ir', 'app',
  'designer', 'designerCanvas', 'addText', 'addButton', 'addInput', 'addCheckbox',
  'addRadio', 'addCombo', 'addListbox', 'addTable', 'addTabs', 'projectName',
  'projectKind', 'exportProject', 'importProject', 'recoverProject', 'importProjectFile',
  'copyDiagnostics', 'downloadDiagnostics', 'diagnosticsState', 'nativeBuildPanel',
  'nativeBuildToken', 'nativeBuildStatus'
]) requireText('Studio UI', html, `id="${id}"`);
requireAll('Studio accessibility shell', html, [
  'class="skip-link" href="#code"', 'role="tablist" aria-label="Result views"',
  'role="tab" data-tab="designer"', 'aria-controls="designer"',
  'role="tabpanel" aria-labelledby="tabDesigner"',
  'aria-keyshortcuts="Control+Enter Meta+Enter"',
  'aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter"',
  'role="status" aria-live="polite"', 'aria-labelledby="editorTitle"'
]);
requireAll('Studio release and targets', html, [
  `0.2 beta.${beta}`, 'Windows App (.exe)', 'macOS App (.app)', 'Linux App',
  'FreeBSD Console', 'value="web"', 'value="native-windows"', 'value="native-macos"',
  'value="native-linux"', 'value="native-freebsd"', 'value="wasm-direct"',
  'value="wasm-bootstrap"'
]);
if (html.includes('class="site-info"')) throw new Error('Studio information content must remain on dedicated site pages.');

const language = sitePages.get('language.html');
requireAll('Language page', language, [
  `0.2 beta.${beta}`, 'Small syntax. Visible changes.', 'Explicit mutation',
  'Change Contracts', 'Multiple backends', 'Table / Grid stays change-oriented'
]);
const docs = sitePages.get('docs.html');
requireAll('Documentation page', docs, [
  `0.2 beta.${beta}`, 'Patch documentation', 'docs/PATCH_STUDIO.md', 'docs/COMPILER.md',
  'docs/OFFLINE_COMPILER.md', 'docs/CLI_CONTRACT.md', 'docs/FORMAL_MODEL.md',
  'docs/NATIVE_GUI.md', 'docs/NATIVE_APPS.md', 'docs/THREAT_MODEL.md'
]);
const downloads = sitePages.get('downloads.html');
requireAll('Downloads page', downloads, [
  'Patch offline compiler', 'patch-windows-x64.exe', 'patch-macos-arm64',
  'patch-macos-x64.tar.gz', 'patch-linux-x64', 'patch-freebsd-x64.tar.gz',
  'SHA256SUMS', 'patch link app.patch --out App'
]);
const help = sitePages.get('help.html');
requireAll('Help page', help, [
  'Design a Window app', 'Table / Grid', 'lower-right corner', 'Designer scrollbars',
  '.patchproject', 'Copy diagnostics', 'Ready/no-token', 'Offline compiler'
]);

const navCss = read('_site/site-navigation.css');
requireAll('Site navigation stylesheet', navCss, [
  '.site-tabs', '.site-tabs a[aria-current="page"]', 'overflow-x: auto', ':focus-visible'
]);
const pagesCss = read('_site/site-pages.css');
requireAll('Content page stylesheet', pagesCss, [
  '.content-page', '.page-hero', '.doc-links', '.help-step', '@media (max-width: 600px)'
]);

for (const name of browserModules) rejectOutsideSiteImport(name, read(`_site/${name}`));

const accessibility = read('_site/studio-accessibility.js');
requireAll('Studio accessibility behavior', accessibility, [
  'skipToEditor', 'resultTabs', "event.key === 'ArrowRight'", "event.key === 'ArrowLeft'",
  "event.key === 'Home'", "event.key === 'End'", 'next.focus()', 'next.click()',
  'syncResultTabs()', 'event.ctrlKey || event.metaKey', "event.key !== 'Enter'",
  'if (event.shiftKey) buildButton?.click()', 'else runButton?.click()', 'hasOpenDialog()'
]);
const accessibilityCss = read('_site/studio-accessibility.css');
requireAll('Studio accessibility stylesheet', accessibilityCss, [
  '.skip-link', ':focus-visible', '@media (pointer: coarse)',
  '@media (prefers-reduced-motion: reduce)', '@media (forced-colors: active)'
]);

const projectLifecycle = read('_site/project-lifecycle.js');
requireAll('Project lifecycle', projectLifecycle, [
  './src/studio-project.js', './src/artifact-name.js', 'patchStudio.project.v2',
  'patchStudio.project.v1', 'patchStudio.recovery.v1', 'bootstrapProjectStorage',
  'persistBundle', 'addRecoverySnapshot', 'parseStudioProjectBundle',
  'getRecoverySnapshotSummaries', 'restoreRecoverySnapshot', 'protectCurrentProject()'
]);
const projectRestore = read('_site/project-config-restore.js');
requireAll('Project config restore', projectRestore, [
  './src/studio-project.js', 'patchStudio.project.v2', 'state.buildTarget',
  'state.nativeBuildMode', 'buildTarget?.dispatchEvent', 'nativeBuildMode?.dispatchEvent'
]);
const studioProject = read('_site/src/studio-project.js');
requireAll('Studio project schema', studioProject, [
  "PATCH_STUDIO_PROJECT_FORMAT = 'patch-studio-project'", 'PATCH_STUDIO_PROJECT_VERSION = 2',
  "PATCH_STUDIO_RECOVERY_FORMAT = 'patch-studio-recovery'", 'PATCH_STUDIO_RECOVERY_VERSION = 1',
  'PATCH_STUDIO_BUILD_TARGETS', 'PATCH_STUDIO_NATIVE_BUILD_MODES', 'main.patch'
]);

const recovery = read('_site/recovery-manager.js');
requireAll('Recovery manager', recovery, [
  './project-lifecycle.js', 'getRecoverySnapshotSummaries', 'createManualRecoverySnapshot',
  'restoreRecoverySnapshot', 'exportRecoverySnapshot', 'deleteRecoverySnapshot',
  'clearRecoverySnapshots', 'Snapshot now', 'Clear all', 'Restore', 'Export', 'Delete'
]);
if (/localStorage/.test(recovery)) throw new Error('Recovery manager must use the project lifecycle API instead of direct storage access.');

const diagnostics = read('_site/studio-diagnostics.js');
requireAll('Studio diagnostics integration', diagnostics, [
  './src/compiler.js', './src/studio-project.js', './src/studio-diagnostics.js',
  'copyDiagnostics', 'downloadDiagnostics', 'MutationObserver', 'unhandledrejection',
  '.patchreport', 'Nothing uploaded'
]);
if (/\bfetch\s*\(/.test(diagnostics) || /XMLHttpRequest/.test(diagnostics)) {
  throw new Error('Studio diagnostics must remain local-only and contain no network upload path.');
}
const diagnosticsCore = read('_site/src/studio-diagnostics.js');
requireAll('Studio diagnostics schema', diagnosticsCore, [
  "PATCH_STUDIO_DIAGNOSTICS_FORMAT = 'patch-studio-diagnostics'",
  'PATCH_STUDIO_DIAGNOSTICS_VERSION = 1', 'sourceIncluded: false', 'uploaded: false',
  'sourceEchoesRedacted: true'
]);

const playground = read('_site/playground.js');
requireAll('Studio playground contracts', playground, [
  './src/interpreter.js', './src/compiler.js', './src/window-events.js', './src/designer.js',
  'triggerWindowEvent', 'listDesignerControls', 'updateDesignerControl',
  "control.type === 'checkbox'", "control.type === 'radio'", "control.type === 'combo'",
  "control.type === 'listbox'", "control.type === 'tabs'", 'patch-studio-table-changed'
]);
const formsDesigner = read('_site/forms-designer.js');
requireAll('Forms Designer contract', formsDesigner, [
  './src/designer.js', './src/form-layout.js', 'addDesignerWindow', 'updateDesignerWindow',
  'updateDesignerControl', "['#addRadio', 'radio']", "['#addCombo', 'combo']",
  "['#addListbox', 'listbox']", "['#addTabs', 'tabs']", 'patch-form-resize-handle'
]);
const tableDesigner = read('_site/table-stage1.js');
requireAll('Table Designer contract', tableDesigner, [
  'addTable', 'patch-studio-table-changed', 'row', 'table'
]);
const formResize = read('_site/form-window-resize.js');
requireAll('Form resize behavior', formResize, [
  './src/designer.js', 'updateDesignerWindow', 'patch-window-resize-handle',
  'pointerdown', 'pointermove', 'pointerup', 'MIN_FORM_WIDTH = 240',
  'MIN_FORM_HEIGHT = 160', 'patch:form-resized'
]);

const compiler = read('_site/src/compiler.js');
requireAll('Compiler release contract', compiler, [
  "PATCH_IR_VERSION = '0.10'", 'formalCalls', 'sourceValidation', 'guardValidation',
  'ui.form-lifecycle', 'ui.tabs', 'ui.radio', 'ui.menu', 'ui.dialog'
]);
const windowBuild = read('_site/src/window-build.js');
requireAll('Window build validation', windowBuild, [
  'openForm', 'closeForm', 'namedForms', 'formActions', 'registerMenu', 'menuItem',
  "controlType === 'combo'", "controlType === 'listbox'", "controlType === 'radio'"
]);
const compiledWindow = read('_site/src/window-compiled.js');
requireAll('Compiled Window artifact', compiledWindow, [
  "PATCH_COMPILED_WINDOW_VERSION = '0.2'",
  "PATCH_COMPILED_WINDOW_FORMAT = 'patch-compiled-window-program'",
  "PATCH_COMPILED_WINDOW_IR_VERSION = '0.10'", 'buildCompiledWindowArtifact',
  'validateCompiledWindowArtifact', 'runCompiledWindow', 'formLayout'
]);

const nativeBuild = read('_site/native-build.js');
requireAll('Native builder imports', nativeBuild, [
  './src/compiler.js', './src/wasm-direct.js', './src/c99.js', './src/window-build.js',
  './src/window-compiled.js', './src/native-gui-ir-v08.js', './src/sealed-native-gui.js',
  './src/sealed-native-package.js', './src/prebuilt-native.js', './src/prebuilt-window.js'
]);
requireAll('Native builder modes', nativeBuild, [
  'native-windows', 'native-macos', 'native-linux', 'native-freebsd',
  'validateWindowRuntimeSupport', 'compileToC99', 'buildNativeGuiIR', 'sealNativeGuiRuntime',
  'buildLinuxNativeGuiPackage', 'buildMacosNativeGuiPackage',
  'PATCH_SEALED_NATIVE_GUI_TABLE_VERSION', 'Ready app download (no token)',
  'workflow_dispatch', 'source_b64'
]);
const nativeGuiBase = read('_site/src/native-gui-ir.js');
requireAll('Native GUI IR 0.7 base', nativeGuiBase, [
  "PATCH_NATIVE_GUI_IR_VERSION = '0.7'", 'flattenNativeGuiControls',
  'flattenNativeGuiMenuItems', "type: 'tabs'", "type: 'menuItem'"
]);
const nativeGuiTable = read('_site/src/native-gui-ir-v08.js');
requireAll('Native GUI IR 0.8 Table extension', nativeGuiTable, [
  "PATCH_NATIVE_GUI_IR_V08_VERSION = '0.8'", 'buildNativeGuiIRV08',
  'validateNativeGuiIRV08', "type: 'table'", "event.valueType = 'text-list'"
]);
const sealedNative = read('_site/src/sealed-native-gui.js');
requireAll('Versioned sealed native GUI contracts', sealedNative, [
  'PATCH_SEALED_NATIVE_GUI_VERSION = 8', 'PATCH_SEALED_NATIVE_GUI_PREVIOUS_VERSION = 7',
  'PATCH_SEALED_NATIVE_GUI_TABLE_VERSION = 9', 'writeLayoutPolicy',
  "policy.kind === 'anchor'", "policy.kind === 'dock'"
]);

const sw = read('_site/sw.js');
requireAll('Service worker release', sw, [
  `const PATCH_RELEASE = '${pkg.version}'`, 'const REVISION = ',
  'const CACHE = `${CACHE_PREFIX}${REVISION}`', "'./language.html'", "'./docs.html'",
  "'./downloads.html'", "'./help.html'", "'./native-build.js'", "'./forms-designer.js'",
  "'./table-stage1.js'", "'./beta35-studio.js'", "'./beta35-studio.css'", "'./designer-multiselect.js'", "'./designer-responsive-layout.js'",
  "'./src/native-gui-ir-v08.js'", "'./src/window-events.js'", 'freshFirst'
]);

const manifest = JSON.parse(read('_site/manifest.webmanifest'));
if (manifest.name !== 'Patch Studio') throw new Error('PWA manifest name is not Patch Studio.');
if (manifest.display !== 'standalone') throw new Error('PWA manifest must use standalone display mode.');
if (!manifest.icons?.some(icon => icon.src === './icon.svg')) throw new Error('PWA manifest is missing the Patch icon.');

console.log(`ok Patch Studio check-site for ${pkg.version}`);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function requireFile(rel) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing generated site file: ${rel}`);
}
function requireText(where, content, text) {
  if (!content.includes(text)) throw new Error(`${where} is missing required generated contract: ${text}`);
}
function requireAll(where, content, texts) {
  for (const text of texts) requireText(where, content, text);
}
function rejectOutsideSiteImport(where, content) {
  if (content.includes("'../src/") || content.includes('"../src/')) {
    throw new Error(`${where} still points outside the deployed site.`);
  }
}
function requireCurrentTab(label, file) {
  const content = sitePages.get(file);
  const current = new RegExp(`<a href="\\./${file}" aria-current="page">${label}</a>`);
  if (!current.test(content)) throw new Error(`${label} page is missing its current navigation tab.`);
}