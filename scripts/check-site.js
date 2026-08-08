#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const beta = /^0\.2\.0-beta\.(\d+)$/.exec(pkg.version)?.[1];
if (!beta) throw new Error(`Unexpected project version ${pkg.version}`);

const required = [
  '_site/index.html','_site/style.css','_site/playground.js','_site/native-build.js','_site/sw.js','_site/manifest.webmanifest','_site/icon.svg',
  '_site/src/interpreter.js','_site/src/parser.js','_site/src/expression.js','_site/src/change.js','_site/src/change-analysis.js','_site/src/range-analysis.js',
  '_site/src/formal-range.js','_site/src/formal-bridge.js','_site/src/formal-source.js','_site/src/source-validation.js','_site/src/compiler.js','_site/src/bundle.js',
  '_site/src/wasm.js','_site/src/wasm-direct.js','_site/src/c99.js','_site/src/webapp.js','_site/src/window-webapp.js','_site/src/window-build.js','_site/src/designer.js'
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing generated site file: ${rel}`);

const html = read('_site/index.html');
for (const needle of ['./style.css','./manifest.webmanifest','./native-build.js','./playground.js','./icon.svg']) requireText('index', html, needle);
for (const id of ['code','run','build','buildTarget','output','changes','ir','app','designer','designerCanvas','addText','addButton','addInput','projectName','projectKind','nativeBuildPanel','nativeBuildToken','nativeBuildStatus']) requireText('index', html, `id="${id}"`);
for (const phrase of [
  `0.2 beta.${beta}`, `Beta ${pkg.version}`, 'Change IR 0.8', 'Change Contract', 'Standalone Window Web App',
  'Independent raw-source validation', 'Concrete runtime capability containment', 'RuntimePath', 'SourceExecutes',
  'checkedConcreteRuntimeCannotEscape', 'State-Change Factorization', 'Windows App', 'macOS App', 'Linux App',
  'FreeBSD Console', 'portable C99', 'FreeBSD 15.1', 'Project Type', 'Roadmap'
]) requireText('public site', html, phrase);
for (const option of ['value="web"','value="native-windows"','value="native-macos"','value="native-linux"','value="native-freebsd"','value="wasm-direct"','value="wasm-bootstrap"']) requireText('build selector', html, option);

const playground = read('_site/playground.js');
if (playground.includes("'../src/")) throw new Error('Generated playground still points outside the deployed site.');
for (const mod of ['./src/interpreter.js','./src/compiler.js','./src/bundle.js','./src/wasm.js','./src/wasm-direct.js','./src/webapp.js','./src/designer.js']) requireText('playground', playground, mod);
for (const phrase of ['Standalone single-file Patch Window Web App','Direct WebAssembly currently supports Console projects only']) requireText('playground Window routing', playground, phrase);

const nativeBuild = read('_site/native-build.js');
if (nativeBuild.includes("'../src/")) throw new Error('Generated native builder still points outside the deployed site.');
for (const phrase of ['./src/compiler.js','./src/wasm-direct.js','./src/c99.js','./src/window-build.js','validateWindowRuntimeSupport','native-windows','native-macos','native-linux','native-freebsd','freebsd-c99.yml','compileToC99','workflow_dispatch','source_b64','Window / GUI','downloadArtifact']) requireText('native builder', nativeBuild, phrase);

const compiler = read('_site/src/compiler.js');
for (const mod of ["'./formal-bridge.js'","'./formal-source.js'","'./source-validation.js'"]) requireText('compiler', compiler, mod);
requireText('compiler', compiler, "PATCH_IR_VERSION = '0.8'");
requireText('compiler', compiler, 'sourceValidation');

const sourceValidation = read('_site/src/source-validation.js');
for (const phrase of ['validateFormalSourceExtraction','buildRawSourceWitness','raw-source-independent-parser','does not import parser.js']) requireText('source validation', sourceValidation, phrase);

for (const [file, phrases] of [
  ['_site/src/formal-bridge.js',['patch-formal-bridge','signatureMatchesProduction','buildFormalBridge']],
  ['_site/src/formal-source.js',['patch-formal-source','buildFormalSource','rangeClaims']],
  ['_site/src/formal-range.js',['buildFormalRangeExpression','inferFormalRange','division']],
  ['_site/src/wasm-direct.js',['compileToDirectWasm']],
  ['_site/src/c99.js',['compileToC99','PATCH_C99_VERSION','portable C99']],
  ['_site/src/webapp.js',['buildStandaloneWebApp','buildStandaloneWindowWebApp','WASM_BASE64']],
  ['_site/src/window-webapp.js',['buildStandaloneWindowWebApp','generated-browser-window-runtime',"PATCH_WINDOW_WEB_VERSION = '0.2'",'stateView']],
  ['_site/src/window-build.js',['countWindowInstructions','validateWindowBuild','validateWindowRuntimeSupport',"code === 'WINDOW'",'Control ids must be unique']]
]) { const content=read(file); for (const phrase of phrases) requireText(file,content,phrase); }

const sw = read('_site/sw.js');
if (sw.includes("'../src/")) throw new Error('Generated service worker still points outside the deployed site.');
requireText('service worker', sw, `patch-studio-0.2-beta.${beta}`);
for (const cached of ["'./native-build.js'","'./src/compiler.js'","'./src/formal-source.js'","'./src/source-validation.js'","'./src/wasm-direct.js'","'./src/c99.js'","'./src/webapp.js'","'./src/window-webapp.js'","'./src/window-build.js'"]) requireText('service worker',sw,cached);
requireText('service worker', sw, 'freshFirst');

const manifest = JSON.parse(read('_site/manifest.webmanifest'));
if (manifest.name !== 'Patch Studio' || manifest.display !== 'standalone' || !manifest.icons?.some(icon => icon.src === './icon.svg')) throw new Error('PWA manifest integrity check failed.');
console.log(`ok generated Patch Studio site for ${pkg.version}`);

function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function requireText(where,content,text){if(!content.includes(text))throw new Error(`${where} is missing ${text}`);}
