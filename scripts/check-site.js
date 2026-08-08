#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  '_site/index.html',
  '_site/style.css',
  '_site/playground.js',
  '_site/native-build.js',
  '_site/sw.js',
  '_site/manifest.webmanifest',
  '_site/icon.svg',
  '_site/src/interpreter.js',
  '_site/src/parser.js',
  '_site/src/expression.js',
  '_site/src/change.js',
  '_site/src/change-analysis.js',
  '_site/src/range-analysis.js',
  '_site/src/formal-range.js',
  '_site/src/formal-bridge.js',
  '_site/src/formal-source.js',
  '_site/src/compiler.js',
  '_site/src/bundle.js',
  '_site/src/wasm.js',
  '_site/src/wasm-direct.js',
  '_site/src/webapp.js',
  '_site/src/designer.js'
];

for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`Missing generated site file: ${rel}`);
}

const html = fs.readFileSync(path.join(root, '_site/index.html'), 'utf8');
for (const needle of ['./style.css', './manifest.webmanifest', './native-build.js', './playground.js', './icon.svg']) {
  if (!html.includes(needle)) throw new Error(`Generated index is missing ${needle}`);
}
for (const id of ['code', 'run', 'build', 'buildTarget', 'output', 'changes', 'ir', 'app', 'designer', 'designerCanvas', 'addText', 'addButton', 'addInput', 'projectName', 'projectKind', 'nativeBuildPanel', 'nativeBuildToken', 'nativeBuildStatus']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Patch Studio is missing required element #${id}`);
}
for (const phrase of ['0.2 beta.17', 'Semantic changes', 'Change Capabilities', 'Change Contract', 'Research project', 'State-Change Factorization', 'Verified checker', 'Source core', 'patch certify', 'Standalone Web App', 'Windows App', 'macOS App', 'Linux App', 'Project Type', 'Console and GUI packages', 'Roadmap']) {
  if (!html.includes(phrase)) throw new Error(`Public project information is missing: ${phrase}`);
}
for (const option of ['value="web"', 'value="native-windows"', 'value="native-macos"', 'value="native-linux"', 'value="wasm-direct"', 'value="wasm-bootstrap"']) {
  if (!html.includes(option)) throw new Error(`Build target selector is missing ${option}`);
}

const playground = fs.readFileSync(path.join(root, '_site/playground.js'), 'utf8');
if (playground.includes("'../src/")) throw new Error('Generated playground still points outside the deployed site.');
for (const mod of ['./src/interpreter.js', './src/compiler.js', './src/bundle.js', './src/wasm.js', './src/wasm-direct.js', './src/webapp.js', './src/designer.js']) {
  if (!playground.includes(mod)) throw new Error(`Generated playground does not import ${mod}`);
}
for (const phrase of ['buildStandaloneWebApp', 'compileToDirectWasm', 'wasm-direct', 'formatChangeAnalysis']) {
  if (!playground.includes(phrase)) throw new Error(`Generated Patch Studio is missing executable build support: ${phrase}`);
}

const nativeBuild = fs.readFileSync(path.join(root, '_site/native-build.js'), 'utf8');
if (nativeBuild.includes("'../src/")) throw new Error('Generated native build module still points outside the deployed site.');
for (const phrase of ['./src/compiler.js', './src/wasm-direct.js', 'native-windows', 'native-macos', 'native-linux', 'workflow_dispatch', 'source_b64', 'kind', 'projectKind', 'Window / GUI', 'actions/workflows', 'downloadArtifact', 'Actions read/write']) {
  if (!nativeBuild.includes(phrase)) throw new Error(`Generated Studio native builder is missing ${phrase}.`);
}

const compiler = fs.readFileSync(path.join(root, '_site/src/compiler.js'), 'utf8');
for (const mod of ["'./formal-bridge.js'", "'./formal-source.js'"]) {
  if (!compiler.includes(mod)) throw new Error(`Generated compiler does not include ${mod}.`);
}
if (!compiler.includes("PATCH_IR_VERSION = '0.7'")) throw new Error('Generated compiler is not on Patch IR 0.7.');

const bridge = fs.readFileSync(path.join(root, '_site/src/formal-bridge.js'), 'utf8');
for (const phrase of ['patch-formal-bridge', 'signatureMatchesProduction', 'buildFormalBridge']) {
  if (!bridge.includes(phrase)) throw new Error(`Generated formal bridge is missing ${phrase}.`);
}

const sourceCore = fs.readFileSync(path.join(root, '_site/src/formal-source.js'), 'utf8');
for (const phrase of ['patch-formal-source', 'buildFormalSource', 'formal source core', 'buildFormalRangeExpression', 'rangeClaims']) {
  if (!sourceCore.includes(phrase)) throw new Error(`Generated formal source module is missing ${phrase}.`);
}

const formalRange = fs.readFileSync(path.join(root, '_site/src/formal-range.js'), 'utf8');
for (const phrase of ['buildFormalRangeExpression', 'inferFormalRange', 'general multiplication', 'division']) {
  if (!formalRange.includes(phrase)) throw new Error(`Generated formal range module is missing ${phrase}.`);
}

const directWasm = fs.readFileSync(path.join(root, '_site/src/wasm-direct.js'), 'utf8');
if (!directWasm.includes('compileToDirectWasm')) throw new Error('Generated site is missing direct Wasm compilation.');
const webapp = fs.readFileSync(path.join(root, '_site/src/webapp.js'), 'utf8');
for (const phrase of ['buildStandaloneWebApp', 'Standalone single-file Patch Web App', 'WASM_BASE64']) {
  if (!webapp.includes(phrase)) throw new Error(`Generated standalone web builder is missing ${phrase}.`);
}

const sw = fs.readFileSync(path.join(root, '_site/sw.js'), 'utf8');
if (sw.includes("'../src/")) throw new Error('Generated service worker still points outside the deployed site.');
if (!sw.includes("patch-studio-0.2-beta.17")) throw new Error('Generated service worker cache is not on beta.17.');
for (const cached of ["'./native-build.js'", "'./src/compiler.js'", "'./src/change-analysis.js'", "'./src/range-analysis.js'", "'./src/formal-range.js'", "'./src/formal-bridge.js'", "'./src/formal-source.js'", "'./src/wasm.js'", "'./src/wasm-direct.js'", "'./src/webapp.js'", "'./src/designer.js'"]) {
  if (!sw.includes(cached)) throw new Error(`Generated service worker does not cache ${cached}.`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, '_site/manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Patch Studio') throw new Error('PWA manifest name mismatch.');
if (manifest.display !== 'standalone') throw new Error('Patch Studio must remain installable as a standalone PWA.');
if (!manifest.icons?.some(icon => icon.src === './icon.svg')) throw new Error('PWA manifest is missing the Patch Studio icon.');

console.log('ok generated Patch Studio site');
