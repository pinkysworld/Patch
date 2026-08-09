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
  compilerJs: read('src/compiler.js'), formalCalls: read('src/formal-calls.js'),
  concreteWitness: read('src/concrete-call-witness.js'), concreteCertificate: read('src/concrete-call-certificate.js'),
  concreteGenerator: read('scripts/generate-concrete-call-certificate.js'), arithmeticExample: read('examples/formal-calls-arithmetic.patch'),
  concreteBody: read('src/concrete-call-body.js'), concreteBodyCertificate: read('src/concrete-call-body-certificate.js'),
  concreteBodyGenerator: read('scripts/generate-concrete-call-body-certificate.js'), calleeTraceExample: read('examples/formal-callee-trace.patch'),
  windowEvents: read('src/window-events.js'), windowBuild: read('src/window-build.js'), windowWeb: read('src/window-webapp.js'),
  playground: read('web/playground.js'), desktopBuilder: read('scripts/build-native-window.js'),
  patchCalls: read('formal/PatchCalls.lean'), substitution: read('formal/PatchCallSubstitution.lean'),
  refinement: read('formal/PatchCallRefinement.lean'), callEffect: read('formal/PatchCallEffect.lean'),
  callBody: read('formal/PatchCallBody.lean'), callBodyImport: read('formal/PatchCallBodyImport.lean'),
  formalWorkflow: read('.github/workflows/formal.yml'), ciWorkflow: read('.github/workflows/ci.yml'),
  beta28Workflow: read('.github/workflows/beta28-callee-traces.yml'), beta27Workflow: read('.github/workflows/beta27-arithmetic-calls.yml'),
  beta26Workflow: read('.github/workflows/beta26-concrete-calls.yml')
};

mustInclude('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`', 'Beta.28: exact structured callee traces',
  'GeneratedConcreteCallBodyCertificate.lean', 'PatchCallBody.lean', 'PatchCallBodyImport.lean',
  'evalBoundStmtEqBool_sound', 'checkedConcreteCallBodyRefinesCallerSignature', 'whole concrete callee trace',
  'branches and guard choices', 'nested recipe calls', 'production JavaScript/direct-Wasm call equivalence',
  'npm run callee-trace-certify:example', 'input `changed`', 'Standalone Window Web App',
  'FreeBSD Console', 'portable C99', 'FreeBSD 15.1', 'not yet a standalone WASI command module'
]);

mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.10',
  'Beta.28 exact structured callee traces', 'GeneratedConcreteCallBodyCertificate.lean',
  'PatchCallBody.lean', 'PatchCallBodyImport.lean', 'checkedConcreteCallBodyRefinesCallerSignature',
  'production JavaScript/direct-Wasm call equivalence', 'Semantic input events', 'Window preflight',
  'Windows App (.exe)', 'macOS App (.app)', 'Linux App', 'FreeBSD Console', 'portable C99', 'FreeBSD 15.1'
]);

mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.10**', 'npm run callee-trace-certify:example',
  'GeneratedConcreteCallBodyCertificate.lean', 'PatchCallBody.lean', 'PatchCallBodyImport.lean',
  'production JavaScript/direct-Wasm call equivalence', cacheVersion,
  'FreeBSD Console builds through the portable C99 backend'
]);

mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.10**', 'npm run callee-trace-certify:example',
  'GeneratedConcreteCallBodyCertificate.lean', 'sequence/static-repeat', 'production-Wasm call equivalence',
  'Window preflight', 'Portable C99', 'FreeBSD 15.1'
]);

mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.28: exact structured callee traces',
  'PatchCallBody.lean', 'PatchCallBodyImport.lean', 'evalBoundStmtEqBool_sound',
  'checkedConcreteCallBodyRefinesCallerSignature', 'GeneratedConcreteCallBodyCertificate.lean',
  'branch/guard-aware exact callee traces', 'nested-call and complete transitive concrete call-trace semantics'
]);

mustInclude('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.10**', 'Structured callee traces: beta.28',
  'evalBoundStmt', 'evalBoundStmtEqBool_sound', 'PatchCallBodyImport.lean',
  'GeneratedConcreteCallBodyCertificate.lean', 'checkedConcreteCallBodyRefinesCallerSignature',
  'production JavaScript/direct-Wasm call equivalence'
]);

mustInclude('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.28', 'Beta.28 exact structured callee traces', 'BoundStmt', 'evalBoundStmt_sound',
  'effectListEqBool_sound', 'evalBoundStmtEqBool_sound', 'boundExecRefinesSignature',
  'checkedConcreteCallBodyRefinesCallerSignature', 'production JavaScript/direct-Wasm call execution'
]);

mustInclude('docs/NOVELTY.md', files.novelty, [
  'Beta.28', 'structured execution traces', 'whole concrete callee trace refines caller semantic signature',
  'GeneratedConcreteCallBodyCertificate.lean', 'not a new novelty headline', 'production JavaScript/direct-Wasm call equivalence'
]);

mustInclude('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.10`, 'Beta.28 exact structured callee-trace milestone',
  'GeneratedConcreteCallBodyCertificate.lean', 'PatchCallBody.lean', 'PatchCallBodyImport.lean',
  'TraceRefinesSignature exactTrace callerSignature', 'production JavaScript/direct-Wasm call equivalence',
  'full compiler verification'
]);

// Runtime correspondence remains the beta.23 direct-runtime layer.
mustInclude('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  'Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape'
]);

mustInclude('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", "'./formal-calls.js'", 'formalCalls']);
mustInclude('src/formal-calls.js', files.formalCalls, ['buildFormalCalls', 'patch-formal-calls', 'rank-decreasing', 'recursive/cyclic call graph']);
mustInclude('src/concrete-call-witness.js', files.concreteWitness, [
  'buildConcreteCallWitnesses', 'patch-concrete-call-witness', 'expectedCalleeEnv', 'abstractArgRanges', 'duplicate parameter names outside concrete binding certification'
]);
mustInclude('src/concrete-call-certificate.js', files.concreteCertificate, [
  'generateConcreteCallCertificate', "PATCH_CONCRETE_CALL_CERTIFICATE_VERSION = '0.3'", 'RangeExpr.add', 'RangeExpr.sub',
  'RangeExpr.neg', 'RangeExpr.scale', 'evaluateFormalRangeExprExact', 'evalBoundQuantitativeEffectEqBool',
  'checkedConcreteBoundEffectRefinesCallerSignature'
]);
mustInclude('scripts/generate-concrete-call-certificate.js', files.concreteGenerator, [
  'generateConcreteCallCertificate', 'certified concrete binding(s)', 'certified direct bound effect(s)', 'production-Wasm call equivalence'
]);
mustInclude('examples/formal-calls-arithmetic.patch', files.arithmeticExample, ['bonus + 1', 'amount * 2']);

mustInclude('src/concrete-call-body.js', files.concreteBody, [
  'buildConcreteCallBodyWitnesses', 'patch-concrete-call-body', "case 'repeat'", 'claimedTrace',
  'branches, nested calls', 'sameEffect'
]);
mustInclude('src/concrete-call-body-certificate.js', files.concreteBodyCertificate, [
  'generateConcreteCallBodyCertificate', 'GeneratedConcreteCallBodyCertificate', 'evalBoundStmtEqBool',
  'boundBodyCoveredBool', 'signatureCoversBool', 'checkedConcreteCallBodyRefinesCallerSignature'
]);
mustInclude('scripts/generate-concrete-call-body-certificate.js', files.concreteBodyGenerator, [
  'generateConcreteCallBodyCertificate', 'certified structured call(s)', 'complete supported callee semantic-effect body'
]);
mustInclude('examples/formal-callee-trace.patch', files.calleeTraceExample, ['bonus + 1', 'repeat 2', 'amount * 2']);

mustInclude('formal/PatchCalls.lean', files.patchCalls, ['theorem callSignatureSoundness', 'theorem checkedRecipeExecutionCannotEscape']);
mustInclude('formal/PatchCallSubstitution.lean', files.substitution, ['def evalCallArgs', 'def concreteCallBinding', 'theorem concreteCallBinding_sound']);
mustInclude('formal/PatchCallRefinement.lean', files.refinement, ['theorem concreteArgsFitThroughAbstract', 'theorem concreteThroughAbstractBool_sound']);
mustInclude('formal/PatchCallEffect.lean', files.callEffect, ['theorem evalBoundQuantitativeEffect_sound', 'theorem checkedConcreteBoundEffectRefinesCallerSignature']);
mustInclude('formal/PatchCallBody.lean', files.callBody, [
  'inductive BoundStmt', 'inductive BoundExec', 'def evalBoundStmt', 'theorem evalBoundStmt_sound',
  'def effectListEqBool', 'theorem evalBoundStmtEqBool_sound', 'def TraceRefinesSignature',
  'theorem boundExecRefinesSignature', 'theorem checkedEvaluatedBoundBodyRefinesSignature'
]);
mustInclude('formal/PatchCallBodyImport.lean', files.callBodyImport, [
  'theorem traceRefinesSignature_import', 'theorem checkedConcreteCallBodyRefinesCallerSignature'
]);

mustInclude('.github/workflows/formal.yml', files.formalWorkflow, [
  'callee-trace-certify:example', 'GeneratedConcreteCallBodyCertificate.lean', 'PatchCallBodyImport',
  "github.event.pull_request.draft == false", 'cancel-in-progress: true'
]);
mustInclude('.github/workflows/ci.yml', files.ciWorkflow, [
  'callee-trace-certify:example', 'src/concrete-call-body-certificate.js',
  "github.event.pull_request.draft == false", 'cancel-in-progress: true'
]);
mustInclude('.github/workflows/beta28-callee-traces.yml', files.beta28Workflow, [
  'Patch Beta28 Callee Traces', 'GeneratedConcreteCallBodyCertificate.lean', 'PatchCallBodyImport',
  "github.event.pull_request.draft == false", 'cancel-in-progress: true'
]);
mustInclude('.github/workflows/beta27-arithmetic-calls.yml', files.beta27Workflow, ['Patch Beta27 Arithmetic Calls', 'workflow_dispatch']);
mustInclude('.github/workflows/beta26-concrete-calls.yml', files.beta26Workflow, ['Patch Beta26 Concrete Calls', 'workflow_dispatch']);

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
