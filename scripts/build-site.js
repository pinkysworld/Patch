#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceWeb = path.join(root, 'web');
const sourceSrc = path.join(root, 'src');
const out = path.join(root, '_site');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const SITE_HTML_FILES = ['index.html','language.html','docs.html','help.html'];
const SITE_SRC_FILES = [
  'interpreter.js','parser.js','picture-control.js','picture-source.js','button-image.js','window-icon.js','shape-control.js','shape-source.js','paintbox-control.js','imagelist-control.js','expression.js','change.js','change-analysis.js','range-analysis.js',
  'formal-range.js','formal-guard.js','formal-calls.js','formal-bridge.js','formal-source.js',
  'source-validation.js','guard-validation.js','call-site-validation.js','independent-range-expression.js','independent-guard-expression.js','compiler.js','diagnostics.js','backend-diagnostic-context.js','artifact-name.js','bundle.js','wasm.js','wasm-direct.js',
  'c99.js','webapp.js','window-webapp.js','window-web-accessibility.js','window-web-paintbox.js','window-build.js','menu-shortcut.js','window-events.js','designer.js','designer-shape.js','designer-paintbox.js','component-registry.js','designer-menu.js','designer-panel.js','designer-data.js','designer-tabs-nested.js','form-layout.js','window-layout-policy.js','studio-project.js','studio-resources.js','studio-outline-model.js','studio-diagnostics.js',
  'window-compiled.js','native-gui-ir-v12.js','native-gui-ir-v13.js','native-gui-ir-v14.js','native-gui-ir-v15.js','native-current-contract.js','native-picture-format-policy.js','native-picture-resources.js','native-frozen-contract.js','native-gui-frozen-lower.js','native-gui-frozen-seal.js','native-tree-backend-adapter.js','native-slider-backend-adapter.js','native-chrome-backend-adapter.js','native-shape-backend-adapter.js','sealed-native-gui-v12.js','sealed-native-gui-v13.js','sealed-native-gui-v14.js','sealed-native-gui-v15.js','sealed-native-package.js','prebuilt-native.js','prebuilt-window.js','local-native-kit.js',
  'concrete-call-witness.js','concrete-call-certificate.js','concrete-call-body.js','concrete-call-body-certificate.js'
];

const SITE_WEB_STATIC_FILES = [
  'style.css','site-navigation.css','site-refresh.css','site-pages.css','studio-accessibility.css','studio-command-palette.css','designer-inspector.css','designer-data-editor.css','designer-structure-ux.css','designer-ux.css','designer-toolbox.css','designer-imagelist.css','designer-menu-designer.css','designer-panel.css','form-designer-workflow.css','forms-designer.css','form-window-resize.css','project-lifecycle.css','recovery-manager.css','studio-diagnostics.css','manifest.webmanifest','icon.svg'
];

const SITE_WEB_MODULE_FILES = [
  'studio-bootstrap.js','runtime-integrity.js','native-build.js','project-lifecycle.js','project-config-restore.js','recovery-manager.js',
  'playground.js','forms-designer.js','designer-selection.js','designer-core-selection.js','slider-stage1.js','table-stage1.js','tree-designer.js','designer-workspace.js','designer-paintbox.js','resource-manager.js','designer-data-editor.js','designer-structural-keyboard.js','designer-tabs-nested.js','designer-structure-ux.js','designer-ux.js','designer-event-inspector.js','designer-focus-order.js','designer-menu-designer.js','designer-panel.js','designer-ui-namespace.js','designer-toolbox.js','designer-imagelist.js','designer-statusbar.js','form-designer-workflow.js','designer-alignment.js','designer-alignment-guides.js','form-window-resize.js',
  'studio-dom-sync.js','studio-diagnostics.js','studio-quick-open.js','studio-command-palette.js','studio-accessibility.js','sw.js'
];

SITE_HTML_FILES.splice(3, 0, 'downloads.html');
SITE_WEB_STATIC_FILES.splice(13, 0, 'designer-multiselect.css', 'designer-responsive-layout.css', 'beta35-studio.css', 'studio-outline.css');
SITE_WEB_MODULE_FILES.splice(7, 0, 'beta35-studio.js', 'studio-outline.js');
SITE_WEB_MODULE_FILES.splice(25, 0, 'designer-multiselect.js', 'designer-layout-policy.js', 'designer-responsive-layout.js');
SITE_WEB_STATIC_FILES.splice(SITE_WEB_STATIC_FILES.indexOf('designer-ux.css') + 1, 0, 'designer-layout-actions.css');
SITE_WEB_MODULE_FILES.splice(SITE_WEB_MODULE_FILES.indexOf('designer-ux.js') + 1, 0, 'designer-layout-actions.js');
SITE_WEB_STATIC_FILES.splice(SITE_WEB_STATIC_FILES.indexOf('designer-layout-actions.css') + 1, 0, 'designer-table-actions.css');
SITE_WEB_MODULE_FILES.splice(SITE_WEB_MODULE_FILES.indexOf('designer-layout-actions.js') + 1, 0,
  'designer-table-model.js', 'designer-table-actions.js',
  'designer-tree-model.js', 'designer-tree-duplicate.js',
  'designer-tabs-control-model.js', 'designer-tabs-control-actions.js',
  'designer-tabs-page-model.js', 'designer-tabs-page-duplicate.js',
  'designer-control-duplicate-model.js', 'designer-control-duplicate.js',
  'designer-z-order-model.js',
  'designer-form-duplicate-model.js', 'designer-form-duplicate.js',
  'designer-form-delete-model.js', 'designer-form-delete.js'
);

const siteRevision = computeSiteRevision();

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of SITE_HTML_FILES) {
  const source = fs.readFileSync(path.join(sourceWeb, name), 'utf8');
  const normalized = normalizeCurrentProductSurface(name, source);
  fs.writeFileSync(path.join(out, name), versionLocalAssetReferences(normalized, siteRevision));
}

for (const name of SITE_WEB_STATIC_FILES) {
  fs.copyFileSync(path.join(sourceWeb, name), path.join(out, name));
}

for (const name of SITE_WEB_MODULE_FILES) {
  let content = fs.readFileSync(path.join(sourceWeb, name), 'utf8')
    .replaceAll("'../src/", "'./src/")
    .replaceAll('"../src/', '"./src/');
  if (name === 'sw.js') content = content.replaceAll('__PATCH_SITE_REV__', siteRevision);
  if (name === 'native-build.js') content = normalizeCurrentNativeBuildCopy(content);
  content = versionRelativeModuleSpecifiers(content, siteRevision);
  fs.writeFileSync(path.join(out, name), content);
}

const siteSrc = path.join(out, 'src');
fs.mkdirSync(siteSrc, { recursive: true });
for (const name of SITE_SRC_FILES) {
  const source = path.join(sourceSrc, name);
  if (!fs.existsSync(source)) throw new Error(`Missing Patch Studio browser dependency: src/${name}`);
  const content = versionRelativeModuleSpecifiers(fs.readFileSync(source, 'utf8'), siteRevision);
  fs.writeFileSync(path.join(siteSrc, name), content);
}

validateGeneratedModuleClosure();
validateGeneratedModuleRevisions();
validateGeneratedHtmlAssetClosure();
validatePaperPrivacyBoundary();
console.log(`built _site/ for Patch ${pkg.version} revision ${siteRevision} with ${SITE_HTML_FILES.length} pages and ${SITE_SRC_FILES.length} browser source modules`);

function normalizeCurrentProductSurface(name, source) {
  let html = source
    .replaceAll('0.2.0-beta.35', pkg.version)
    .replaceAll('0.2 beta.35+', '0.2 beta.36+')
    .replaceAll('0.2 beta.35', '0.2 beta.36');

  // Research sources stay in paper/, but the working manuscript is deliberately
  // not part of the public Patch Studio website or its navigation.
  html = html.replace(/\s*<a\b[^>]*href="\.\/paper\.html"[^>]*>[\s\S]*?<\/a>/g, '');

  // downloads.html is authored directly for the current contract and intentionally
  // mentions older IR/payload/runtime lines as compatibility history.
  if (name !== 'downloads.html') {
    html = html
      .replaceAll('Native GUI IR 1.3 / payload v13 / runtime v1.4', 'Native GUI IR 1.4 / payload v14 / runtime v1.5')
      .replaceAll('Native GUI IR <strong>1.3</strong>', 'Native GUI IR <strong>1.4</strong>')
      .replaceAll('payload <strong>v13</strong>', 'payload <strong>v14</strong>')
      .replaceAll('runtime <strong>v1.4</strong>', 'runtime <strong>v1.5</strong>')
      .replaceAll('Native GUI IR 1.3 as payload v13', 'Native GUI IR 1.4 as payload v14')
      .replaceAll('current runtime v1.4 templates', 'current runtime v1.5 templates')
      .replaceAll('Current runtime v1.4 templates', 'Current runtime v1.5 templates')
      .replaceAll('IR 1.3 / v1.4', 'IR 1.4 / v1.5')
      .replaceAll('native-win32-runtime-v1.4', 'native-win32-runtime-v1.5')
      .replaceAll('native-macos-runtime-v1.4', 'native-macos-runtime-v1.5')
      .replaceAll('native-linux-runtime-v1.4', 'native-linux-runtime-v1.5')
      .replaceAll('Native GUI IR 1.4 / payload v14 / runtime v1.5', 'Native GUI IR 1.5 / payload v15 / runtime v1.6')
      .replaceAll('Native GUI IR <strong>1.4</strong>', 'Native GUI IR <strong>1.5</strong>')
      .replaceAll('payload <strong>v14</strong>', 'payload <strong>v15</strong>')
      .replaceAll('runtime <strong>v1.5</strong>', 'runtime <strong>v1.6</strong>')
      .replaceAll('Native GUI IR 1.4 as payload v14', 'Native GUI IR 1.5 as payload v15')
      .replaceAll('current runtime v1.5 templates', 'current runtime v1.6 templates')
      .replaceAll('Current runtime v1.5 templates', 'Current runtime v1.6 templates')
      .replaceAll('IR 1.4 / v1.5', 'IR 1.5 / v1.6')
      .replaceAll('native-win32-runtime-v1.5', 'native-win32-runtime-v1.6')
      .replaceAll('native-macos-runtime-v1.5', 'native-macos-runtime-v1.6')
      .replaceAll('native-linux-runtime-v1.5', 'native-linux-runtime-v1.6');
  }

  if (name === 'index.html') {
    html = html.replace(
      '<svg viewBox="0 0 22 22" focusable="false" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="M3 2H18V12H8V20H3ZM8 6H13V8H8Z"/></svg>',
      '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M8 6H22V18H13V26H8ZM13 10H18V14H13Z"/></svg>'
    );
  }
  return html;
}

function normalizeCurrentNativeBuildCopy(source) {
  return source
    .replaceAll('Native GUI IR 1.3', 'Native GUI IR 1.4')
    .replaceAll('payload v13', 'payload v14')
    .replaceAll('runtime v1.4', 'runtime v1.5')
    .replaceAll('Native GUI IR 1.4', 'Native GUI IR 1.5')
    .replaceAll('payload v14', 'payload v15')
    .replaceAll('runtime v1.5', 'runtime v1.6');
}

function computeSiteRevision() {
  const files = [
    ...SITE_HTML_FILES.map(name => path.join(sourceWeb, name)),
    ...SITE_WEB_STATIC_FILES.map(name => path.join(sourceWeb, name)),
    ...SITE_WEB_MODULE_FILES.map(name => path.join(sourceWeb, name)),
    ...SITE_SRC_FILES.map(name => path.join(sourceSrc, name)),
    path.join(root, 'package.json')
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

function versionRelativeModuleSpecifiers(source, revision) {
  const staticPattern = /(^\s*(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?)(['\"])(\.{1,2}\/[^'\"]+\.js)\2/gm;
  const dynamicPattern = /(\bimport\s*\(\s*)(['\"])(\.{1,2}\/[^'\"]+\.js)\2(\s*\))/g;
  return source
    .replace(staticPattern, (_match, prefix, quote, specifier) => `${prefix}${quote}${specifier}?v=${revision}${quote}`)
    .replace(dynamicPattern, (_match, prefix, quote, specifier, suffix) => `${prefix}${quote}${specifier}?v=${revision}${quote}${suffix}`);
}

function validateGeneratedModuleClosure() {
  const modules = walkJs(out);
  const missing = [];
  for (const file of modules) {
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of relativeModuleSpecifiers(source)) {
      const clean = specifier.split(/[?#]/, 1)[0];
      const target = path.resolve(path.dirname(file), clean);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        missing.push(`${path.relative(out, file).split(path.sep).join('/')} -> ${specifier}`);
      }
    }
  }
  if (missing.length) {
    throw new Error(`Generated Patch Studio has unresolved relative module imports:\n${missing.map(item => `- ${item}`).join('\n')}`);
  }
}

function validateGeneratedModuleRevisions() {
  const stale = [];
  for (const file of walkJs(out)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of relativeModuleSpecifiers(source)) {
      const clean = specifier.split('#', 1)[0];
      if (!clean.endsWith(`.js?v=${siteRevision}`)) {
        stale.push(`${path.relative(out, file).split(path.sep).join('/')} -> ${specifier}`);
      }
    }
  }
  if (stale.length) {
    throw new Error(`Generated Patch Studio has unversioned relative module imports:\n${stale.map(item => `- ${item}`).join('\n')}`);
  }
}

function validateGeneratedHtmlAssetClosure() {
  const missing = [];
  const assetExtension = /\.(?:js|css|webmanifest|svg|png|ico)$/i;
  for (const name of SITE_HTML_FILES) {
    const file = path.join(out, name);
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/\b(?:href|src)="(\.\/[^"#]+)"/g)) {
      const specifier = match[1];
      const clean = specifier.split(/[?#]/, 1)[0];
      if (!assetExtension.test(clean)) continue;
      const target = path.resolve(path.dirname(file), clean);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        missing.push(`${name} -> ${specifier}`);
      }
    }
  }
  if (missing.length) {
    throw new Error(`Generated Patch Studio has unresolved local HTML assets:\n${missing.map(item => `- ${item}`).join('\n')}`);
  }
}

function validatePaperPrivacyBoundary() {
  if (fs.existsSync(path.join(out, 'paper.html'))) {
    throw new Error('Generated Patch Studio must not publish paper.html. Keep research sources under paper/ only.');
  }
  const leaked = [];
  for (const name of SITE_HTML_FILES) {
    const html = fs.readFileSync(path.join(out, name), 'utf8');
    if (html.includes('./paper.html')) leaked.push(name);
  }
  const palette = fs.readFileSync(path.join(out, 'studio-command-palette.js'), 'utf8');
  const worker = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
  if (palette.includes('./paper.html')) leaked.push('studio-command-palette.js');
  if (worker.includes('./paper.html')) leaked.push('sw.js');
  if (leaked.length) throw new Error(`Generated Patch Studio leaks the private paper web route through: ${leaked.join(', ')}`);
}

function walkJs(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkJs(target));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(target);
  }
  return files;
}

function relativeModuleSpecifiers(source) {
  const found = new Set();
  const patterns = [
    /^\s*import\s+(?:[^'\"]*?\s+from\s+)?['\"](\.{1,2}\/[^'\"]+)['\"]/gm,
    /^\s*export\s+[^'\"]*?\s+from\s+['\"](\.{1,2}\/[^'\"]+)['\"]/gm,
    /\bimport\s*\(\s*['\"](\.{1,2}\/[^'\"]+)['\"]\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return found;
}