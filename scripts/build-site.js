#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceWeb = path.join(root, 'web');
const sourceSrc = path.join(root, 'src');
const out = path.join(root, '_site');

const SITE_SRC_FILES = [
  'interpreter.js','parser.js','expression.js','change.js','change-analysis.js','range-analysis.js',
  'formal-range.js','formal-guard.js','formal-calls.js','formal-bridge.js','formal-source.js',
  'source-validation.js','guard-validation.js','compiler.js','bundle.js','wasm.js','wasm-direct.js',
  'c99.js','webapp.js','window-webapp.js','window-build.js','window-events.js','designer.js','form-layout.js','studio-project.js',
  'window-compiled.js','native-gui-ir.js','sealed-native-gui.js','sealed-native-package.js','prebuilt-native.js','prebuilt-window.js','local-native-kit.js',
  'concrete-call-witness.js','concrete-call-certificate.js','concrete-call-body.js','concrete-call-body-certificate.js'
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of ['index.html', 'style.css', 'designer-inspector.css', 'forms-designer.css', 'manifest.webmanifest', 'icon.svg']) {
  fs.copyFileSync(path.join(sourceWeb, name), path.join(out, name));
}

for (const name of ['playground.js', 'forms-designer.js', 'native-build.js', 'sw.js']) {
  const content = fs.readFileSync(path.join(sourceWeb, name), 'utf8')
    .replaceAll("'../src/", "'./src/")
    .replaceAll('"../src/', '"./src/');
  fs.writeFileSync(path.join(out, name), content);
}

const siteSrc = path.join(out, 'src');
fs.mkdirSync(siteSrc, { recursive: true });
for (const name of SITE_SRC_FILES) {
  const source = path.join(sourceSrc, name);
  if (!fs.existsSync(source)) throw new Error(`Missing Patch Studio browser dependency: src/${name}`);
  fs.copyFileSync(source, path.join(siteSrc, name));
}

console.log(`built _site/ for Patch Studio with ${SITE_SRC_FILES.length} browser source modules`);
