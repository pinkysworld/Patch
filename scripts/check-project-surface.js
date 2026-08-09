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
  transitiveBody: read('src/transitive-call-body.js'), transitiveCertificate: read('src/transitive-call-body-certificate.js'),
  runtimeCorrespondence: read('src/transitive-runtime-correspondence.js'),
  runtimeCertificate: read('src/transitive-runtime-certificate.js'),
  runtimeGenerator: read('scripts/generate-transitive-runtime-certificate.js'),
  callTree: read('formal/PatchCallTree.lean'), callRuntime: read('formal/PatchCallRuntime.lean'), lakefile: read('formal/lakefile.lean'),
  formalWorkflow: read('.github/workflows/formal.yml'), ciWorkflow: read('.github/workflows/ci.yml'),
  beta31Workflow: read('.github/workflows/beta31-call-aware-wasm-correspondence.yml'),
  beta30Workflow: read('.github/workflows/beta30-transitive-callee-traces.yml'),
  beta29Workflow: read('.github/workflows/beta29-guarded-callee-traces.yml'),
  beta28Workflow: read('.github/workflows/beta28-callee-traces.yml')
};

if (pkg.scripts?.['transitive-runtime-certify:example'] !==
    'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls.patch --out formal/GeneratedTransitiveRuntimeCertificate.lean') {
  throw new Error('package.json is missing the canonical beta.31 runtime certificate command.');
}

requireAll('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`',
  'Beta.31', 'call-aware direct-Wasm correspondence', 'PatchCallRuntime.lean',
  'GeneratedTransitiveRuntimeCertificate.lean', 'npm run transitive-runtime-certify:example'
]);
requireAll('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.10',
  'Beta.31', 'call-aware direct-Wasm correspondence'
]);
requireAll('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.10**', 'GeneratedTransitiveRuntimeCertificate.lean', cacheVersion
]);
requireAll('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.10**', 'GeneratedTransitiveRuntimeCertificate.lean'
]);
requireAll('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.31:', 'PatchCallRuntime.lean',
  'scoped-slice attribution'
]);
requireAll('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.10**', 'Beta.31', 'PatchCallRuntime.lean',
  'GeneratedTransitiveRuntimeCertificate.lean'
]);
requireAll('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.31', 'Beta.31', 'checkedObservedTransitiveRuntimeRefinesCallerSignature',
  'runtime capture', 'scoped-slice attribution'
]);
requireAll('docs/NOVELTY.md', files.novelty, [
  'Beta.31', 'call-aware direct-Wasm correspondence', 'supporting assurance'
]);
requireAll('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.10`, 'Beta.31', 'GeneratedTransitiveRuntimeCertificate.lean',
  'PatchCallRuntime.lean'
]);
requireAll('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  'Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape'
]);

requireAll('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", "'./formal-calls.js'", 'formalCalls']);
requireAll('src/formal-calls.js', files.formalCalls, ['buildFormalCalls', 'patch-formal-calls', 'rank-decreasing']);
requireAll('src/transitive-call-body.js', files.transitiveBody, [
  "PATCH_TRANSITIVE_CALL_BODY_VERSION = '0.2'", 'claimedScopedTrace', 'nestedCallDepth', 'buildNestedCall'
]);
requireAll('src/transitive-call-body-certificate.js', files.transitiveCertificate, [
  "PATCH_TRANSITIVE_CALL_BODY_CERTIFICATE_VERSION = '0.1'", 'CallTreeStmt.call',
  'checkedConcreteTransitiveCallTreeRefinesCallerSignature'
]);
requireAll('src/transitive-runtime-correspondence.js', files.runtimeCorrespondence, [
  "PATCH_TRANSITIVE_RUNTIME_CORRESPONDENCE_VERSION = '0.1'", 'compileToDirectWasm', 'runDirectWasm',
  'validateDirectSemanticEffects', 'findScopedMatches', 'matches.length !== 1', 'runtimeTraceSha256'
]);
requireAll('src/transitive-runtime-certificate.js', files.runtimeCertificate, [
  "PATCH_TRANSITIVE_RUNTIME_CERTIFICATE_VERSION = '0.1'", 'generateTransitiveCallBodyCertificate',
  'buildTransitiveRuntimeCorrespondence', 'evalCallTreeStmtEqBool',
  'checkedObservedTransitiveRuntimeRefinesCallerSignature', 'directWasmTraceSha256'
]);
requireAll('scripts/generate-transitive-runtime-certificate.js', files.runtimeGenerator, [
  'generateTransitiveRuntimeCertificate', 'GeneratedTransitiveRuntimeCertificate.lean', 'direct-Wasm trace sha256'
]);
requireAll('formal/PatchCallTree.lean', files.callTree, [
  'inductive CallTreeStmt', 'theorem checkedConcreteTransitiveCallTreeRefinesCallerSignature'
]);
requireAll('formal/PatchCallRuntime.lean', files.callRuntime, [
  'import PatchCallTree', 'theorem checkedObservedTransitiveRuntimeRefinesCallerSignature',
  'evalCallTreeStmtEqBool_sound'
]);
requireAll('formal/lakefile.lean', files.lakefile, ['lean_lib PatchCallTree', 'lean_lib PatchCallRuntime']);

requireAll('.github/workflows/formal.yml', files.formalWorkflow, [
  'transitive-runtime-certify:example', 'PatchCallRuntime', 'GeneratedTransitiveRuntimeCertificate.lean'
]);
requireAll('.github/workflows/ci.yml', files.ciWorkflow, [
  'transitive-runtime-certify:example', 'src/transitive-runtime-correspondence.js',
  'src/transitive-runtime-certificate.js', 'scripts/generate-transitive-runtime-certificate.js'
]);
requireAll('.github/workflows/beta31-call-aware-wasm-correspondence.yml', files.beta31Workflow, [
  'Patch Beta31 Call-Aware Wasm Correspondence', 'GeneratedTransitiveRuntimeCertificate.lean',
  'GeneratedTransitiveCallBodyCertificate.lean', 'PatchCallRuntime', 'cancel-in-progress: true'
]);
requireAll('.github/workflows/beta30-transitive-callee-traces.yml', files.beta30Workflow, [
  'Patch Beta30 Transitive Callee Traces', 'GeneratedTransitiveCallBodyCertificate.lean'
]);
requireAll('.github/workflows/beta29-guarded-callee-traces.yml', files.beta29Workflow, [
  'Patch Beta29 Guarded Callee Traces', 'GeneratedGuardedCallBodyCertificate.lean'
]);
requireAll('.github/workflows/beta28-callee-traces.yml', files.beta28Workflow, [
  'Patch Beta28 Callee Traces', 'GeneratedConcreteCallBodyCertificate.lean'
]);
requireAll('web/sw.js', files.serviceWorker, [cacheVersion, "'../src/formal-calls.js'", 'freshFirst']);

for (const [name, content] of Object.entries({
  'README.md': files.readme, 'web/index.html': files.website, 'docs/PATCH_STUDIO.md': files.studio,
  'docs/NATIVE_APPS.md': files.native, 'docs/ROADMAP.md': files.roadmap, 'docs/COMPILER.md': files.compiler,
  'docs/FORMAL_MODEL.md': files.formal, 'docs/NOVELTY.md': files.novelty, 'paper/README.md': files.paper
})) rejectStaleCurrentVersion(name, content, beta);

console.log(`ok project surface is consistent at ${version}`);

function requireAll(name, content, phrases) {
  for (const phrase of phrases) {
    if (!content.includes(phrase)) throw new Error(`${name} is missing required project contract: ${phrase}`);
  }
}

function rejectStaleCurrentVersion(name, content, expectedBeta) {
  const found = [...content.matchAll(/0\.2\.0-beta\.(\d+)|0\.2 beta\.(\d+)/g)].map(match => match[1] ?? match[2]);
  for (const value of found) {
    if (value !== expectedBeta) throw new Error(`${name} contains stale current-product beta ${value}; expected ${expectedBeta}`);
  }
}
