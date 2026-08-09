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
  concreteWitness: read('src/concrete-call-witness.js'), concreteCertificate: read('src/concrete-call-certificate.js'),
  concreteGenerator: read('scripts/generate-concrete-call-certificate.js'),
  cliEntry: read('src/cli-entry.js'), windowEvents: read('src/window-events.js'), windowBuild: read('src/window-build.js'),
  windowWeb: read('src/window-webapp.js'), playground: read('web/playground.js'), desktopBuilder: read('scripts/build-native-window.js'),
  patchCalls: read('formal/PatchCalls.lean'), substitution: read('formal/PatchCallSubstitution.lean'),
  refinement: read('formal/PatchCallRefinement.lean'), callEffect: read('formal/PatchCallEffect.lean'),
  formalWorkflow: read('.github/workflows/formal.yml'), ciWorkflow: read('.github/workflows/ci.yml')
};

mustInclude('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`', 'Beta.26: concrete recipe binding and direct effect refinement',
  'PatchCallSubstitution.lean', 'PatchCallRefinement.lean', 'PatchCallEffect.lean',
  'checkedConcreteBoundEffectRefinesCallerSignature', 'GeneratedConcreteCallCertificate.lean',
  'variable pass-through', 'production JavaScript/direct-Wasm', 'input `changed`', 'Standalone Window Web App',
  'FreeBSD Console', 'portable C99', 'FreeBSD 15.1', 'not yet a standalone WASI command module'
]);

mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.10',
  'Concrete recipe calls', 'PatchCallSubstitution.lean', 'PatchCallRefinement.lean', 'PatchCallEffect.lean',
  'GeneratedConcreteCallCertificate.lean', 'checkedConcreteBoundEffectRefinesCallerSignature',
  'variable pass-through', 'production JavaScript/direct-Wasm call equivalence',
  'Semantic input events', 'Window preflight', 'Windows App (.exe)', 'macOS App (.app)', 'Linux App',
  'FreeBSD Console', 'portable C99', 'FreeBSD 15.1'
]);

mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.10**', 'formalCalls', 'npm run concrete-call-certify:example',
  'PatchCallSubstitution.lean', 'PatchCallRefinement.lean', 'PatchCallEffect.lean',
  'variable pass-through', cacheVersion, 'FreeBSD Console builds through the portable C99 backend'
]);

mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.10**', 'npm run concrete-call-certify:example',
  'PatchCallSubstitution.lean', 'PatchCallRefinement.lean', 'PatchCallEffect.lean',
  'production-Wasm call equivalence', 'Window preflight', 'Portable C99', 'FreeBSD 15.1'
]);

mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.26: concrete safe-integer call binding + direct leaf-effect refinement',
  'PatchCallSubstitution.lean', 'PatchCallRefinement.lean', 'PatchCallEffect.lean',
  'concreteCallBinding_sound', 'checkedConcreteBoundEffectRefinesCallerSignature',
  'GeneratedConcreteCallCertificate.lean', 'production direct-Wasm call execution equivalence'
]);

mustInclude('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.10**', '`formalCalls`', '`PatchCalls.lean`',
  '`src/concrete-call-witness.js`', '`src/concrete-call-certificate.js`',
  '`formal/PatchCallSubstitution.lean`', '`formal/PatchCallRefinement.lean`', '`formal/PatchCallEffect.lean`',
  'concreteCallBinding_sound', 'checkedConcreteBoundEffectRefinesCallerSignature', 'GeneratedConcreteCallCertificate.lean'
]);

mustInclude('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.26', 'PatchCallSubstitution.lean', 'PatchCallRefinement.lean', 'PatchCallEffect.lean',
  'concreteCallBinding_sound', 'concreteArgsFitThroughAbstract', 'evalBoundQuantitativeEffectEqBool_sound',
  'evalBoundQuantitativeEffect_sound', 'checkedConcreteBoundEffectRefinesCallerSignature',
  'GeneratedConcreteCallCertificate.lean', 'production JavaScript/direct-Wasm call execution'
]);

mustInclude('docs/NOVELTY.md', files.novelty, [
  'Beta.26', 'parameter substitution', 'effect refinement', 'checkedConcreteBoundEffectRefinesCallerSignature',
  'not a new novelty headline', 'production-Wasm call equivalence'
]);

mustInclude('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.10`, 'Beta.26 concrete-call milestone',
  'PatchCallSubstitution.lean', 'PatchCallRefinement.lean', 'PatchCallEffect.lean',
  'checkedConcreteBoundEffectRefinesCallerSignature', 'GeneratedConcreteCallCertificate.lean',
  'production-Wasm call equivalence', 'full compiler verification'
]);

// Runtime correspondence remains the beta.23 concrete direct-runtime layer.
mustInclude('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  'Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape'
]);

mustInclude('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", "'./formal-calls.js'", 'formalCalls']);
mustInclude('src/formal-calls.js', files.formalCalls, ['buildFormalCalls', 'patch-formal-calls', 'rank-decreasing', 'recursive/cyclic call graph']);
mustInclude('src/call-certificate.js', files.callCertificate, ['generateLeanCallCertificate', 'checkRecipeEnv', 'abstract call-aware signature composition']);
mustInclude('src/concrete-call-witness.js', files.concreteWitness, ['buildConcreteCallWitnesses', 'patch-concrete-call-witness', 'expectedCalleeEnv', 'abstractArgRanges']);
mustInclude('src/concrete-call-certificate.js', files.concreteCertificate, [
  'generateConcreteCallCertificate', "PATCH_CONCRETE_CALL_CERTIFICATE_VERSION = '0.2'", 'evalBoundQuantitativeEffectEqBool',
  'checkedConcreteBoundEffectRefinesCallerSignature', 'certifiedEffects', 'variable pass-through arguments only'
]);
mustInclude('scripts/generate-concrete-call-certificate.js', files.concreteGenerator, [
  'generateConcreteCallCertificate', 'certified concrete binding(s)', 'certified direct bound effect(s)', 'production-Wasm call equivalence'
]);

mustInclude('formal/PatchCalls.lean', files.patchCalls, [
  'inductive CallStmt', 'def checkRecipeEnv', 'theorem checkRecipeEnv_sound', 'theorem callSignatureSoundness', 'theorem checkedRecipeExecutionCannotEscape'
]);
mustInclude('formal/PatchCallSubstitution.lean', files.substitution, [
  'abbrev BindingList', 'def envOfBindings', 'def evalCallArgs', 'def bindCallParams', 'def concreteCallBinding', 'theorem concreteCallBinding_sound'
]);
mustInclude('formal/PatchCallRefinement.lean', files.refinement, [
  'theorem valueFitsWithin', 'theorem concreteArgsFitThroughAbstract', 'def concreteThroughAbstractBool', 'theorem concreteThroughAbstractBool_sound'
]);
mustInclude('formal/PatchCallEffect.lean', files.callEffect, [
  'def evalBoundQuantitativeEffect', 'def evalBoundQuantitativeEffectEqBool', 'theorem evalBoundQuantitativeEffectEqBool_sound',
  'theorem evalBoundQuantitativeEffect_sound', 'def RefinesSignature', 'theorem checkedConcreteBoundEffectRefinesCallerSignature'
]);

mustInclude('.github/workflows/formal.yml', files.formalWorkflow, [
  'concrete-call-certify:example', 'PatchCallSubstitution PatchCallRefinement PatchCallEffect', 'GeneratedConcreteCallCertificate.lean'
]);
mustInclude('.github/workflows/ci.yml', files.ciWorkflow, [
  'src/concrete-call-witness.js', 'src/concrete-call-certificate.js', 'scripts/generate-concrete-call-certificate.js', 'concrete-call-certify:example'
]);

// Preserve beta.24 Window mutation-path guarantees.
mustInclude('src/window-events.js', files.windowEvents, ['triggerWindowEvent', 'event-local value', 'PATCH_WINDOW_EVENTS_VERSION']);
mustInclude('src/window-build.js', files.windowBuild, ["controlType === 'button' && event.event === 'clicked'", "controlType === 'input' && event.event === 'changed'"]);
mustInclude('src/window-webapp.js', files.windowWeb, ["PATCH_WINDOW_WEB_VERSION = '0.3'", "event==='changed'", "{value:el.value}"]);
mustInclude('web/playground.js', files.playground, ["'../src/window-events.js'", 'triggerWindowEvent', "addEventListener('input'"]);
mustInclude('scripts/build-native-window.js', files.desktopBuilder, ["'./src/window-events.js'", 'triggerWindowEvent', "addEventListener('input'"]);

mustInclude('web/sw.js', files.serviceWorker, [
  cacheVersion, "'../src/formal-calls.js'", "'../src/formal-guard.js'", "'../src/guard-validation.js'", "'../src/window-events.js'", 'freshFirst'
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
