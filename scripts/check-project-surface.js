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
  transitiveBody: read('src/transitive-call-body.js'), transitiveCertificate: read('src/transitive-call-body-certificate.js'),
  transitiveGenerator: read('scripts/generate-transitive-call-body-certificate.js'),
  transitiveExample: read('examples/formal-transitive-calls.patch'),
  callBody: read('formal/PatchCallBody.lean'), callBodyImport: read('formal/PatchCallBodyImport.lean'),
  callTree: read('formal/PatchCallTree.lean'), lakefile: read('formal/lakefile.lean'),
  formalWorkflow: read('.github/workflows/formal.yml'), ciWorkflow: read('.github/workflows/ci.yml'),
  beta30Workflow: read('.github/workflows/beta30-transitive-callee-traces.yml'),
  beta29Workflow: read('.github/workflows/beta29-guarded-callee-traces.yml'),
  beta28Workflow: read('.github/workflows/beta28-callee-traces.yml')
};

// Current-version surfaces. These checks validate stable structure and claims,
// not editorial sentence wording.
requireAll('package.json', JSON.stringify(pkg), [
  `"version":"${version}"`.replace(/:/, ':')
]);
if (pkg.scripts?.['transitive-callee-trace-certify:example'] !==
    'node scripts/generate-transitive-call-body-certificate.js examples/formal-transitive-calls.patch --out formal/GeneratedTransitiveCallBodyCertificate.lean') {
  throw new Error('package.json is missing the canonical beta.30 transitive certificate command.');
}

requireAll('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`',
  'Beta.30: finite transitive exact call-tree traces', 'PatchCallTree.lean',
  'GeneratedTransitiveCallBodyCertificate.lean', 'npm run transitive-callee-trace-certify:example',
  'production JavaScript/direct-Wasm call equivalence'
]);
requireAll('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.10',
  'Beta.30 finite transitive exact call trees', 'GeneratedTransitiveCallBodyCertificate.lean',
  'production JavaScript/direct-Wasm call equivalence'
]);
requireAll('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.10**', 'GeneratedTransitiveCallBodyCertificate.lean', cacheVersion
]);
requireAll('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.10**', 'GeneratedTransitiveCallBodyCertificate.lean'
]);
requireAll('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.30: finite transitive exact call-tree traces',
  'checkedConcreteTransitiveCallTreeRefinesCallerSignature', 'observed direct-Wasm call execution'
]);
requireAll('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.10**', '### Beta.30: finite transitive exact call trees',
  'PatchCallTree.lean', 'GeneratedTransitiveCallBodyCertificate.lean'
]);
requireAll('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.30', '## Beta.30 finite transitive exact call-tree traces',
  'CallTreeStmt.call', 'callTreeCoveredBool', 'checkedConcreteTransitiveCallTreeRefinesCallerSignature'
]);
requireAll('docs/NOVELTY.md', files.novelty, [
  'Beta.30', 'finite transitive exact call-tree traces', 'checkedConcreteTransitiveCallTreeRefinesCallerSignature',
  'supporting assurance, not a new novelty headline'
]);
requireAll('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.10`, '## Beta.30 finite transitive exact call-tree milestone',
  'GeneratedTransitiveCallBodyCertificate.lean', 'PatchCallTree.lean'
]);

// Historical/direct-runtime status is intentionally pinned to beta.23.
requireAll('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  'Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape'
]);

// Stable production/formal contracts inherited through beta.29.
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
  'evalBoundStmtEqBool', 'checkedConcreteCallBodyRefinesCallerSignature'
]);
requireAll('formal/PatchCallBody.lean', files.callBody, [
  '| branch (guard : GuardExpr)', 'BoundExec.branchThen', 'BoundExec.branchElse',
  'evalGuard guard (envOfBindings bindings)', 'theorem evalBoundStmt_sound'
]);
requireAll('formal/PatchCallBodyImport.lean', files.callBodyImport, [
  'theorem traceRefinesSignature_import', 'theorem checkedConcreteCallBodyRefinesCallerSignature'
]);

// Beta.30 production witness/certificate contracts.
requireAll('src/transitive-call-body.js', files.transitiveBody, [
  "PATCH_TRANSITIVE_CALL_BODY_VERSION = '0.1'", 'buildTransitiveCallBodyWitnesses',
  'nestedCallDepth', 'buildNestedCall', 'rank'
]);
requireAll('src/transitive-call-body-certificate.js', files.transitiveCertificate, [
  "PATCH_TRANSITIVE_CALL_BODY_CERTIFICATE_VERSION = '0.1'", 'CallTreeStmt.call',
  'callerRank', 'calleeRank', 'concreteThroughAbstractBool', 'ConcreteArgsFit',
  'checkedConcreteTransitiveCallTreeRefinesCallerSignature'
]);
requireAll('scripts/generate-transitive-call-body-certificate.js', files.transitiveGenerator, [
  'generateTransitiveCallBodyCertificate', 'GeneratedTransitiveCallBodyCertificate.lean'
]);
requireAll('examples/formal-transitive-calls.patch', files.transitiveExample, [
  'make leaf', 'make middle', 'make outer', 'make caller'
]);

requireAll('formal/PatchCallTree.lean', files.callTree, [
  'inductive CallTreeStmt', 'CallTreeStmt', 'callerRank calleeRank',
  'inductive CallTreeExec : BindingList', 'inductive CallTreeCovered : List Effect',
  'concreteCallBinding', 'decide (calleeRank < callerRank)',
  'theorem evalCallTreeStmt_sound', 'theorem callTreeCoveredBool_sound',
  'theorem callTreeExecRefinesSignature', 'theorem evalCallTreeStmtEqBool_sound',
  'theorem checkedConcreteTransitiveCallTreeRefinesCallerSignature'
]);
requireAll('formal/lakefile.lean', files.lakefile, ['lean_lib PatchCallTree']);

// Reproducibility gates: beta.30 adds evidence without deleting beta.28/29.
requireAll('.github/workflows/formal.yml', files.formalWorkflow, [
  'guarded-callee-trace-certify:example', 'transitive-callee-trace-certify:example',
  'PatchCallTree', 'GeneratedTransitiveCallBodyCertificate.lean'
]);
requireAll('.github/workflows/ci.yml', files.ciWorkflow, [
  'guarded-callee-trace-certify:example', 'transitive-callee-trace-certify:example',
  'src/transitive-call-body.js', 'src/transitive-call-body-certificate.js'
]);
requireAll('.github/workflows/beta30-transitive-callee-traces.yml', files.beta30Workflow, [
  'Patch Beta30 Transitive Callee Traces', 'GeneratedTransitiveCallBodyCertificate.lean',
  'GeneratedGuardedCallBodyCertificate.lean', 'PatchCallTree', 'cancel-in-progress: true'
]);
requireAll('.github/workflows/beta29-guarded-callee-traces.yml', files.beta29Workflow, [
  'Patch Beta29 Guarded Callee Traces', 'GeneratedGuardedCallBodyCertificate.lean'
]);
requireAll('.github/workflows/beta28-callee-traces.yml', files.beta28Workflow, [
  'Patch Beta28 Callee Traces', 'GeneratedConcreteCallBodyCertificate.lean'
]);
requireAll('web/sw.js', files.serviceWorker, [cacheVersion, "'../src/formal-guard.js'", "'../src/formal-calls.js'", 'freshFirst']);

// Reject stale current-product version forms while allowing historical milestone
// headings and the intentionally pinned beta.23 runtime document.
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
