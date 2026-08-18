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
  '_site/native-build.js','_site/runtime-integrity.js','_site/sw.js','_site/playground.js',
  '_site/project-lifecycle.js','_site/recovery-manager.js','_site/studio-outline.js','_site/table-stage1.js',
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
  'Project Outline', 'multi-file project bundle v3', 'hierarchical TreeView', 'runtime v1.3',
  'Native GUI IR 1.2', 'payload v12', './runtime-integrity.js', './native-build.js', './studio-outline.js'
]);
rejectAll('Studio shell', index, [
  'currently browser-only and native builds fail closed',
  'Current native Ready/AOT/offline Window builds do not claim list-backed multi-select ListBox support.'
]);

const nativeBuild = read('_site/native-build.js');
requireAll('Studio native Ready builder', nativeBuild, [
  "./src/native-gui-ir-v12.js", "./src/sealed-native-gui-v12.js",
  'buildNativeGuiIRV12 as buildNativeGuiIR', 'sealNativeGuiRuntimeV12',
  'PATCH_SEALED_NATIVE_GUI_TREE_VERSION', 'allowTree: true',
  'Native single EXE (no token, recommended)', 'Native GTK app (no token, recommended)',
  'Native AppKit app (no token, unsigned)'
]);

const downloads = read('_site/downloads.html');
requireAll('Downloads page', downloads, [
  'patch-windows-x64.exe','patch-macos-arm64','patch-macos-x64.tar.gz','patch-linux-x64','patch-freebsd-x64.tar.gz',
  'SHA256SUMS','Native GUI IR <strong>1.2</strong>','payload <strong>v12</strong>','runtime <strong>v1.3</strong>',
  'hierarchical TreeView','runtime-manifest.json','native-win32-runtime-v1.3','native-macos-runtime-v1.3','native-linux-runtime-v1.3'
]);

const docs = read('_site/docs.html');
requireAll('Documentation page', docs, [
  'docs/PATCH_STUDIO.md','docs/COMPILER.md','docs/OFFLINE_COMPILER.md','docs/FORMAL_MODEL.md',
  'docs/NATIVE_GUI.md','docs/NATIVE_APPS.md','docs/ROADMAP.md','Native GUI IR 1.2 / payload v12 / runtime v1.3'
]);

const compiler = read('_site/src/compiler.js');
requireAll('Compiler release contract', compiler, ["PATCH_IR_VERSION = '0.10'", 'formalCalls', 'sourceValidation', 'guardValidation']);
const events = read('_site/src/window-events.js');
requireAll('Window event contract', events, ["PATCH_WINDOW_EVENTS_VERSION = '0.8'", 'text-list event-local value']);
const gui12 = read('_site/src/native-gui-ir-v12.js');
requireAll('Native GUI IR 1.2', gui12, ["PATCH_NATIVE_GUI_IR_V12_VERSION = '1.2'", 'buildNativeGuiIRV12', "control.type = 'tree'"]);
const sealed12 = read('_site/src/sealed-native-gui-v12.js');
requireAll('sealed payload v12', sealed12, ['PATCH_SEALED_NATIVE_GUI_TREE_VERSION = 12', 'sealNativeGuiRuntimeV12', 'inspectNativeGuiTreesV12']);

const sw = read('_site/sw.js');
requireAll('Service worker current compiler cache', sw, [
  "const PATCH_RELEASE = '0.2.0-beta.35'", "url.pathname.includes('/runtimes/')",
  './src/native-gui-ir-v12.js','./src/native-tree-backend-adapter.js','./src/sealed-native-gui-v12.js'
]);

const integrity = read('_site/runtime-integrity.js');
requireAll('Runtime integrity gate', integrity, ['runtime-manifest.json','SHA-256','crypto.subtle']);

console.log('ok current Patch Studio public site surface: beta.35+ / Native GUI IR 1.2 / payload v12 / runtime v1.3');
