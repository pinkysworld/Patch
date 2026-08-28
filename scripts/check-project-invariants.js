#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing required invariant: ${marker}`);
};
const rejectAll = (label, text, markers) => {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${label} violates invariant: ${marker}`);
};

const commandPaletteDocs = read('docs/STUDIO_COMMAND_PALETTE.md');
const semantics = read('docs/SEMANTICS.md');
const compilerDocs = read('docs/COMPILER.md');
const diagnostics = read('docs/DIAGNOSTICS.md');
const studioOutline = read('docs/STUDIO_PROJECT_OUTLINE.md');
const studioProjects = read('docs/STUDIO_PROJECTS.md');
const cliContract = read('docs/CLI_CONTRACT.md');
const production = read('docs/PRODUCTION_READINESS.md');
const runtime = read('docs/RUNTIME_CORRESPONDENCE.md');
const roadmap = read('docs/ROADMAP.md');
const formal = read('docs/FORMAL_MODEL.md');
const paper = read('paper/README.md');
const compilerJs = read('src/compiler.js');
const windowEvents = read('src/window-events.js');
const windowBuild = read('src/window-build.js');
const doctor = read('src/doctor.js');
const changeAnalysis = read('src/change-analysis.js');
const bootstrap = read('web/studio-bootstrap.js');
const accessibility = read('web/studio-accessibility.js');
const playground = read('web/playground.js');
const sw = read('web/sw.js');
const buildSite = read('scripts/build-site.js');

requireAll('Command Palette docs', commandPaletteDocs, [
  'Ctrl/Cmd+K','Run project','Build selected target','transient IDE interaction state','project-file and symbol quick-open','must not introduce a second persistent project model',
  'Field','name.field','Param','name.param'
]);
requireAll('Semantics Thing and equality contract', semantics, [
  'prototype-free','JSON serialization is not the equality oracle','__proto__','constructor'
]);
requireAll('Compiler docs Thing/Wasm boundary', compilerDocs, [
  'Things (`CREATE_THING`)','fail closed rather than silently falling back','outside the beta.32 Lean runtime-correspondence claim',
  '`patch doctor` self-checks a tiny numeric program','PATCH2003','prototype-preserving semantic clone','executes host-compiled C99'
]);
requireAll('Diagnostics numeric-subset code', diagnostics, [
  'PATCH2003','target does not support this numeric/direct subset construct','file": "logic/reward.patch"','mapStudioProjectLine','owning project-relative path',
  'unknown recipe calls, classify as `PATCH2003`'
]);
requireAll('Studio outline composition mapping', studioOutline, [
  'display owning `file:line`','Generated backend/compiler locations remain separate','name.param','editor tabs'
]);
requireAll('Studio project composition diagnostics', studioProjects, ['display `file:line` without changing Patch syntax']);
requireAll('Doctor compiler self-check', doctor, [
  'compiler-backends','compileToDirectWasm','things are outside the direct numeric Wasm subset','PatchInterpreter','CREATE_THING','runHostC99','host C99 compiled and printed 2'
]);
requireAll('CLI doctor contract', cliContract, ['compiler-backends','Things fail closed','compiles and runs the numeric C99 program']);
requireAll('Change analysis semantic clone', changeAnalysis, ["import { clone } from './change.js'"]);
rejectAll('Change analysis JSON clone', changeAnalysis, ['JSON.parse(JSON.stringify(value))']);
requireAll('Compiler semantic contract', compilerJs, ["PATCH_IR_VERSION = '0.10'",'formalCalls','sourceValidation','guardValidation']);
requireAll('Window event adapter', windowEvents, ["PATCH_WINDOW_EVENTS_VERSION = '0.9'","controlType === 'slider'",'finite number',"import { clone } from './change.js'",'clone(payload.value)']);
rejectAll('Window event adapter structured clone', windowEvents, ['structuredClone(payload.value)']);
requireAll('Window target Slider gate', windowBuild, ['allowSlider','Slider is not enabled for this Window target']);
requireAll('Workspace layout accessibility', accessibility, [
  'patchStudio.workspaceSplit.v2',"role', 'separator'","aria-orientation', 'horizontal'",'max-width: 760px','--workspace-source-height','--workspace-result-height'
]);
requireAll('Site build browser graph', buildSite, [
  "'site-navigation.css','site-refresh.css','site-pages.css'",'studio-command-palette.css','studio-command-palette.js','call-site-validation.js',
  'independent-range-expression.js','independent-guard-expression.js','native-current-contract.js','native-frozen-contract.js','native-gui-ir-v13.js','native-gui-ir-v14.js','native-gui-ir-v15.js',
  'sealed-native-gui-v13.js','sealed-native-gui-v14.js','sealed-native-gui-v15.js','native-chrome-backend-adapter.js','native-shape-backend-adapter.js'
]);
requireAll('Single service-worker ownership', bootstrap, ['navigator.serviceWorker.register','patch-studio-sw-reload-guard','Date.now() + 14000']);
rejectAll('Accessibility worker ownership', accessibility, ['serviceWorker.register']);
rejectAll('Playground worker ownership', playground, ['serviceWorker.register']);
requireAll('Service worker graph and fallback', sw, [
  './studio-command-palette.css','./studio-command-palette.js','./src/call-site-validation.js','./src/independent-range-expression.js','./src/independent-guard-expression.js',
  './src/native-current-contract.js','./src/native-frozen-contract.js','./src/native-gui-ir-v13.js','./src/native-gui-ir-v14.js','./src/native-gui-ir-v15.js','./src/sealed-native-gui-v13.js','./src/sealed-native-gui-v14.js','./src/sealed-native-gui-v15.js',
  './src/native-chrome-backend-adapter.js','./src/native-shape-backend-adapter.js',"const navigation = event.request.mode === 'navigate'",'throw error'
]);
requireAll('Formal claim boundary', formal, ['beta.32']);
requireAll('Runtime correspondence boundary', runtime, ['beta.32']);
requireAll('Paper boundary', paper, ['beta.32']);
requireAll('Production external gates remain open', production, [
  'real credentialed Windows code-signing evidence','real credentialed macOS signing + notarization evidence','manual assistive-technology/browser accessibility audit'
]);
requireAll('Roadmap research gates remain open', roadmap, [
  'controlled paper-quality benchmark runs','genuine external/third-party plugin or extension integration study','expert/venue feedback'
]);

console.log('Non-versioned Patch project invariants passed.');
