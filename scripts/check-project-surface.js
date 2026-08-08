#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = pkg.version;
const match = /^0\.2\.0-beta\.(\d+)$/.exec(version);
if (!match) throw new Error(`Unexpected Patch beta version format: ${version}`);
const beta = match[1];
const studioVersion = `0.2 beta.${beta}`;
const cacheVersion = `patch-studio-0.2-beta.${beta}`;
const files = {
  readme: read('README.md'), website: read('web/index.html'), studio: read('docs/PATCH_STUDIO.md'),
  native: read('docs/NATIVE_APPS.md'), roadmap: read('docs/ROADMAP.md'), compiler: read('docs/COMPILER.md'),
  formal: read('docs/FORMAL_MODEL.md'), novelty: read('docs/NOVELTY.md'), paper: read('paper/README.md'),
  runtime: read('docs/RUNTIME_CORRESPONDENCE.md'), serviceWorker: read('web/sw.js'),
  compilerJs: read('src/compiler.js'), formalCalls: read('src/formal-calls.js'), callCertificate: read('src/call-certificate.js'),
  cliEntry: read('src/cli-entry.js'), windowEvents: read('src/window-events.js'), windowBuild: read('src/window-build.js'),
  windowWeb: read('src/window-webapp.js'), playground: read('web/playground.js'), desktopBuilder: read('scripts/build-native-window.js'),
  patchCalls: read('formal/PatchCalls.lean')
};

mustInclude('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`', 'Beta.25: formal recipe-call composition',
  'formalCalls', 'PatchCalls.lean', 'checkRecipeEnv', 'callSignatureSoundness', 'patch call-certify',
  'abstract call composition', 'concrete caller expression', 'input `changed`', 'PatchGuarded.lean',
  'Standalone Window Web App', 'FreeBSD Console', 'portable C99', 'FreeBSD 15.1', 'not yet a standalone WASI command module'
]);

mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.10',
  'Formal recipe calls', 'formalCalls', 'PatchCalls.lean', 'checkRecipeEnv', 'callSignatureSoundness',
  'Concrete call substitution', 'Semantic input events', 'Window preflight', 'RuntimePath', 'GuardTree',
  'Windows App (.exe)', 'macOS App (.app)', 'Linux App', 'FreeBSD Console', 'portable C99', 'FreeBSD 15.1'
]);

mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.10**', 'formalCalls', 'patch call-certify',
  'concrete parameter substitution', 'Semantic input events', cacheVersion, 'FreeBSD Console builds through the portable C99 backend'
]);

mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.10**', 'patch call-certify', 'PatchCalls.lean',
  'concrete call argument substitution', 'Window preflight', 'Portable C99', 'FreeBSD 15.1'
]);

mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.25: formal acyclic recipe-call composition',
  'Change IR **0.10**', 'PatchCalls.lean', 'callSignatureSoundness', 'production-generated call environment checked by Lean',
  'concrete recipe argument evaluation / parameter binding / substitution semantics'
]);

mustInclude('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.10**', '`formalCalls`', '`PatchCalls.lean`',
  'checkRecipeEnv callEnv = true', 'concrete substitution/binding steps', 'src/cli-entry.js'
]);

mustInclude('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.25', 'PatchCalls.lean', 'ArgsFit', 'checkRecipeEnv_sound', 'CallExec',
  'callSignatureSoundness', 'checkedRecipeExecutionCannotEscape', 'GeneratedCallCertificate.lean', 'concrete value substitution'
]);
mustInclude('docs/NOVELTY.md', files.novelty, [
  'Beta.25', 'interprocedural effect composition', 'callSignatureSoundness', 'concrete parameter substitution correctness',
  'not a new novelty headline'
]);
mustInclude('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.10`, 'Beta.25 call-composition milestone', 'PatchCalls.lean',
  'GeneratedCallCertificate.lean', 'concrete argument evaluation', 'full compiler correctness'
]);
// Runtime correspondence remains the beta.23 concrete-runtime layer.
mustInclude('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, ['Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape']);

mustInclude('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", "'./formal-calls.js'", 'formalCalls']);
mustInclude('src/formal-calls.js', files.formalCalls, ['buildFormalCalls', 'patch-formal-calls', 'rank-decreasing', 'recursive/cyclic call graph']);
mustInclude('src/call-certificate.js', files.callCertificate, ['generateLeanCallCertificate', 'Generated from the production compiler', 'checkRecipeEnv', 'abstract call-aware signature composition']);
mustInclude('src/cli-entry.js', files.cliEntry, ['call-certify', 'generateLeanCallCertificate', 'abstract call composition']);
mustInclude('formal/PatchCalls.lean', files.patchCalls, ['inductive CallStmt', 'def checkRecipeEnv', 'theorem checkRecipeEnv_sound', 'theorem callSignatureSoundness', 'theorem checkedRecipeExecutionCannotEscape']);

// Preserve beta.24 Window mutation-path guarantees.
mustInclude('src/window-events.js', files.windowEvents, ['triggerWindowEvent', 'event-local value', 'PATCH_WINDOW_EVENTS_VERSION']);
mustInclude('src/window-build.js', files.windowBuild, ["controlType === 'button' && event.event === 'clicked'", "controlType === 'input' && event.event === 'changed'"]);
mustInclude('src/window-webapp.js', files.windowWeb, ["PATCH_WINDOW_WEB_VERSION = '0.3'", "event==='changed'", "{value:el.value}"]);
mustInclude('web/playground.js', files.playground, ["'../src/window-events.js'", 'triggerWindowEvent', "addEventListener('input'"]);
mustInclude('scripts/build-native-window.js', files.desktopBuilder, ["'./src/window-events.js'", 'triggerWindowEvent', "addEventListener('input'"]);

mustInclude('web/sw.js', files.serviceWorker, [
  cacheVersion, "'../src/formal-calls.js'", "'../src/formal-guard.js'", "'../src/guard-validation.js'",
  "'../src/window-events.js'", 'freshFirst'
]);

for (const [name, content] of Object.entries({
  'README.md': files.readme, 'web/index.html': files.website, 'docs/PATCH_STUDIO.md': files.studio,
  'docs/NATIVE_APPS.md': files.native, 'docs/ROADMAP.md': files.roadmap, 'docs/COMPILER.md': files.compiler,
  'docs/FORMAL_MODEL.md': files.formal, 'docs/NOVELTY.md': files.novelty, 'paper/README.md': files.paper
})) rejectOtherProductBeta(name, content, beta);

console.log(`ok project surface is consistent at ${version}`);

function mustInclude(name, content, phrases) {
  for (const phrase of phrases) if (!content.includes(phrase)) throw new Error(`${name} is missing required current-project text: ${phrase}`);
}
function rejectOtherProductBeta(name, content, expectedBeta) {
  const found = [...content.matchAll(/0\.2\.0-beta\.(\d+)|0\.2 beta\.(\d+)/g)].map(match => match[1] ?? match[2]);
  for (const value of found) if (value !== expectedBeta) throw new Error(`${name} contains stale product beta ${value}; expected ${expectedBeta}`);
}
