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
  concreteBody: read('src/concrete-call-body.js'), concreteBodyCertificate: read('src/concrete-call-body-certificate.js'),
  concreteBodyGenerator: read('scripts/generate-concrete-call-body-certificate.js'),
  calleeTraceExample: read('examples/formal-callee-trace.patch'), guardedCalleeExample: read('examples/formal-callee-guard.patch'),
  callBody: read('formal/PatchCallBody.lean'), callBodyImport: read('formal/PatchCallBodyImport.lean'),
  formalWorkflow: read('.github/workflows/formal.yml'), ciWorkflow: read('.github/workflows/ci.yml'),
  beta29Workflow: read('.github/workflows/beta29-guarded-callee-traces.yml'), beta28Workflow: read('.github/workflows/beta28-callee-traces.yml')
};

// Current-version surfaces. Keep these checks structural so editorial prose can
// evolve without turning documentation copy into an accidental API.
requireAll('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`',
  'Beta.29: guard-aware exact structured callee traces', 'GeneratedGuardedCallBodyCertificate.lean',
  'npm run guarded-callee-trace-certify:example'
]);
requireAll('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.10',
  'Beta.29 guard-aware exact callee traces', 'GeneratedGuardedCallBodyCertificate.lean'
]);
requireAll('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.10**', 'GeneratedGuardedCallBodyCertificate.lean', cacheVersion
]);
requireAll('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.10**', 'GeneratedGuardedCallBodyCertificate.lean'
]);
requireAll('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.29: guard-aware exact structured callee traces',
  'GeneratedGuardedCallBodyCertificate.lean', 'nested-call and complete transitive concrete call-trace semantics'
]);
requireAll('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.10**', '## Guard-aware structured callee traces: beta.29',
  'GeneratedGuardedCallBodyCertificate.lean'
]);
requireAll('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.29', '## Beta.29 guard-aware exact structured callee traces',
  'GuardExpr', 'envOfBindings', 'checkedConcreteCallBodyRefinesCallerSignature'
]);
requireAll('docs/NOVELTY.md', files.novelty, [
  'Beta.29', 'guard-aware exact callee traces', 'GeneratedGuardedCallBodyCertificate.lean',
  'supporting assurance, not a new novelty headline'
]);
requireAll('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.10`, '## Beta.29 guard-aware exact callee-trace milestone',
  'GeneratedGuardedCallBodyCertificate.lean'
]);

// Historical/direct-runtime status is deliberately pinned to beta.23 and is
// not interpreted as the current product version.
requireAll('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  'Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape'
]);

// Stable production/formal contracts for beta.29.
requireAll('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", "'./formal-calls.js'", 'formalCalls']);
requireAll('src/formal-calls.js', files.formalCalls, ['buildFormalCalls', 'patch-formal-calls', 'rank-decreasing']);
requireAll('src/concrete-call-witness.js', files.concreteWitness, ['buildConcreteCallWitnesses', 'expectedCalleeEnv', 'abstractArgRanges']);
requireAll('src/concrete-call-certificate.js', files.concreteCertificate, [
  "PATCH_CONCRETE_CALL_CERTIFICATE_VERSION = '0.3'", 'RangeExpr.add', 'RangeExpr.scale',
  'checkedConcreteBoundEffectRefinesCallerSignature'
]);
requireAll('src/concrete-call-body.js', files.concreteBody, [
  "PATCH_CONCRETE_CALL_BODY_VERSION = '0.2'", 'buildFormalGuardExpression', "kind: 'branch'", 'evalGuardExact'
]);
requireAll('src/concrete-call-body-certificate.js', files.concreteBodyCertificate, [
  "PATCH_CONCRETE_CALL_BODY_CERTIFICATE_VERSION = '0.2'", 'BoundStmt.branch', 'GuardExpr.',
  'evalBoundStmtEqBool', 'boundBodyCoveredBool', 'checkedConcreteCallBodyRefinesCallerSignature'
]);
requireAll('scripts/generate-concrete-call-body-certificate.js', files.concreteBodyGenerator, [
  'generateConcreteCallBodyCertificate', 'GuardExpr branch truth', 'both branch arms'
]);
requireAll('examples/formal-callee-trace.patch', files.calleeTraceExample, ['bonus + 1', 'repeat 2', 'amount * 2']);
requireAll('examples/formal-callee-guard.patch', files.guardedCalleeExample, ['if amount >= 3:', 'caller_high', 'caller_low', 'amount * 2']);

requireAll('formal/PatchCallBody.lean', files.callBody, [
  'import PatchGuarded', '| branch (guard : GuardExpr)', 'BoundExec.branchThen', 'BoundExec.branchElse',
  'evalGuard guard (envOfBindings bindings)', 'theorem evalBoundStmt_sound',
  'theorem evalBoundStmtEqBool_sound', 'theorem boundExecRefinesSignature'
]);
requireAll('formal/PatchCallBodyImport.lean', files.callBodyImport, [
  'theorem traceRefinesSignature_import', 'theorem checkedConcreteCallBodyRefinesCallerSignature'
]);

// Reproducibility gates: beta.29 must add evidence without deleting beta.28.
requireAll('.github/workflows/formal.yml', files.formalWorkflow, [
  'callee-trace-certify:example', 'guarded-callee-trace-certify:example',
  'GeneratedConcreteCallBodyCertificate.lean', 'GeneratedGuardedCallBodyCertificate.lean'
]);
requireAll('.github/workflows/ci.yml', files.ciWorkflow, [
  'callee-trace-certify:example', 'guarded-callee-trace-certify:example'
]);
requireAll('.github/workflows/beta29-guarded-callee-traces.yml', files.beta29Workflow, [
  'Patch Beta29 Guarded Callee Traces', 'GeneratedGuardedCallBodyCertificate.lean',
  'GeneratedConcreteCallBodyCertificate.lean', 'PatchCallBodyImport', 'cancel-in-progress: true'
]);
requireAll('.github/workflows/beta28-callee-traces.yml', files.beta28Workflow, [
  'Patch Beta28 Callee Traces', 'GeneratedConcreteCallBodyCertificate.lean', 'PatchCallBodyImport'
]);
requireAll('web/sw.js', files.serviceWorker, [cacheVersion, "'../src/formal-guard.js'", "'../src/formal-calls.js'", 'freshFirst']);

// Reject stale current-product version forms while allowing historical milestone
// headings such as "Beta.28" and the intentionally pinned beta.23 runtime doc.
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
