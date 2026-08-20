#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceWeb = path.join(root, 'web');
const sourceSrc = path.join(root, 'src');
const out = path.join(root, '_site');

const SITE_HTML_FILES = ['index.html','language.html','docs.html','help.html'];
const SITE_SRC_FILES = [
  'interpreter.js','parser.js','expression.js','change.js','change-analysis.js','range-analysis.js',
  'formal-range.js','formal-guard.js','formal-calls.js','formal-bridge.js','formal-source.js',
  'source-validation.js','guard-validation.js','compiler.js','diagnostics.js','backend-diagnostic-context.js','artifact-name.js','bundle.js','wasm.js','wasm-direct.js',
  'c99.js','webapp.js','window-webapp.js','window-web-accessibility.js','window-build.js','menu-shortcut.js','window-events.js','designer.js','designer-data.js','designer-tabs-nested.js','form-layout.js','window-layout-policy.js','studio-project.js','studio-outline-model.js','studio-diagnostics.js',
  'window-compiled.js','native-gui-ir.js','native-gui-ir-v08.js','native-gui-ir-v09.js','native-gui-ir-v10.js','native-gui-ir-v11.js','native-gui-ir-v12.js','native-tree-backend-adapter.js','sealed-native-gui.js','sealed-native-gui-v11.js','sealed-native-gui-v12.js','sealed-native-package.js','prebuilt-native.js','prebuilt-window.js','local-native-kit.js',
  'concrete-call-witness.js','concrete-call-certificate.js','concrete-call-body.js','concrete-call-body-certificate.js'
];

const SITE_WEB_STATIC_FILES = [
  'style.css','site-navigation.css','site-pages.css','studio-accessibility.css','designer-inspector.css','designer-data-editor.css','designer-structure-ux.css','designer-ux.css','designer-toolbox.css','form-designer-workflow.css','forms-designer.css','form-window-resize.css','project-lifecycle.css','recovery-manager.css','studio-diagnostics.css','manifest.webmanifest','icon.svg'
];

const SITE_WEB_MODULE_FILES = [
  'runtime-integrity.js','native-build.js','project-lifecycle.js','project-config-restore.js','recovery-manager.js',
  'playground.js','forms-designer.js','designer-selection.js','designer-core-selection.js','table-stage1.js','tree-designer.js','designer-workspace.js','designer-data-editor.js','designer-structural-keyboard.js','designer-tabs-nested.js','designer-structure-ux.js','designer-ux.js','designer-toolbox.js','form-designer-workflow.js','designer-alignment.js','designer-alignment-guides.js','form-window-resize.js',
  'studio-dom-sync.js','studio-diagnostics.js','studio-accessibility.js','sw.js'
];

SITE_HTML_FILES.splice(3, 0, 'downloads.html');
SITE_WEB_STATIC_FILES.splice(11, 0, 'designer-multiselect.css', 'designer-responsive-layout.css', 'beta35-studio.css', 'studio-outline.css');
SITE_WEB_MODULE_FILES.splice(6, 0, 'beta35-studio.js', 'studio-outline.js');
SITE_WEB_MODULE_FILES.splice(23, 0, 'designer-multiselect.js', 'designer-layout-policy.js', 'designer-responsive-layout.js');
SITE_WEB_STATIC_FILES.splice(SITE_WEB_STATIC_FILES.indexOf('designer-ux.css') + 1, 0, 'designer-layout-actions.css');
SITE_WEB_MODULE_FILES.splice(SITE_WEB_MODULE_FILES.indexOf('designer-ux.js') + 1, 0, 'designer-layout-actions.js');
SITE_WEB_STATIC_FILES.splice(SITE_WEB_STATIC_FILES.indexOf('designer-layout-actions.css') + 1, 0, 'designer-table-actions.css');
SITE_WEB_MODULE_FILES.splice(SITE_WEB_MODULE_FILES.indexOf('designer-layout-actions.js') + 1, 0,
  'designer-table-model.js', 'designer-table-actions.js',
  'designer-tree-model.js', 'designer-tree-duplicate.js',
  'designer-tabs-control-model.js', 'designer-tabs-control-actions.js',
  'designer-tabs-page-model.js', 'designer-tabs-page-duplicate.js',
  'designer-control-duplicate-model.js', 'designer-control-duplicate.js',
  'designer-form-duplicate-model.js', 'designer-form-duplicate.js',
  'designer-form-delete-model.js', 'designer-form-delete.js'
);

const siteRevision = computeSiteRevision();

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of SITE_HTML_FILES) {
  const source = fs.readFileSync(path.join(sourceWeb, name), 'utf8');
  fs.writeFileSync(path.join(out, name), versionLocalAssetReferences(source, siteRevision));
}

for (const name of SITE_WEB_STATIC_FILES) {
  fs.copyFileSync(path.join(sourceWeb, name), path.join(out, name));
}

for (const name of SITE_WEB_MODULE_FILES) {
  let content = fs.readFileSync(path.join(sourceWeb, name), 'utf8')
    .replaceAll("'../src/", "'./src/")
    .replaceAll('"../src/', '"./src/');
  if (name === 'sw.js') content = content.replaceAll('__PATCH_SITE_REV__', siteRevision);
  fs.writeFileSync(path.join(out, name), content);
}

const siteSrc = path.join(out, 'src');
fs.mkdirSync(siteSrc, { recursive: true });
for (const name of SITE_SRC_FILES) {
  const source = path.join(sourceSrc, name);
  if (!fs.existsSync(source)) throw new Error(`Missing Patch Studio browser dependency: src/${name}`);
  fs.copyFileSync(source, path.join(siteSrc, name));
}

console.log(`built _site/ for Patch revision ${siteRevision} with ${SITE_HTML_FILES.length} pages and ${SITE_SRC_FILES.length} browser source modules`);

function computeSiteRevision() {
  const files = [
    ...SITE_HTML_FILES.map(name => path.join(sourceWeb, name)),
    ...SITE_WEB_STATIC_FILES.map(name => path.join(sourceWeb, name)),
    ...SITE_WEB_MODULE_FILES.map(name => path.join(sourceWeb, name)),
    ...SITE_SRC_FILES.map(name => path.join(sourceSrc, name))
  ].sort();
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    if (!fs.existsSync(file)) throw new Error(`Missing Patch Studio revision input: ${path.relative(root, file)}`);
    hash.update(path.relative(root, file).split(path.sep).join('/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

function versionLocalAssetReferences(html, revision) {
  return html.replace(/((?:href|src)="\.\/[^"?]+\.(?:css|js|webmanifest|svg))"/g, `$1?v=${revision}"`);
}
