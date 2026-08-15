#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
const version = pkg.version;
const match = /^0\.2\.0-beta\.(\d+)$/.exec(version);
if (!match) throw new Error(`Unexpected Patch beta version format: ${version}`);
const beta = match[1];
const studioVersion = `0.2 beta.${beta}`;

const files = {
  readme: read('README.md'), website: read('web/index.html'), languagePage: read('web/language.html'), docsPage: read('web/docs.html'), downloadsPage: read('web/downloads.html'), helpPage: read('web/help.html'), studio: read('docs/PATCH_STUDIO.md'), beta34: read('docs/BETA34.md'),
  native: read('docs/NATIVE_APPS.md'), roadmap: read('docs/ROADMAP.md'), compiler: read('docs/COMPILER.md'),
  formal: read('docs/FORMAL_MODEL.md'), novelty: read('docs/NOVELTY.md'), paper: read('paper/README.md'),
  evaluation: read('docs/EVALUATION.md'), controlledEvaluation: read('docs/CONTROLLED_EVALUATION.md'), securityCasesDoc: read('docs/SECURITY_CASE_STUDIES.md'),
  runtime: read('docs/RUNTIME_CORRESPONDENCE.md'), serviceWorker: read('web/sw.js'), runtimeIntegrity: read('web/runtime-integrity.js'), studioDomSync: read('web/studio-dom-sync.js'),
  compilerJs: read('src/compiler.js'), formalCalls: read('src/formal-calls.js'),
  directTrace: read('src/direct-trace-validator.js'), directEffect: read('src/direct-effect-validator.js'),
  transitiveBody: read('src/transitive-call-body.js'), transitiveCertificate: read('src/transitive-call-body-certificate.js'),
  runtimeCorrespondence: read('src/transitive-runtime-correspondence.js'),
  runtimeCertificate: read('src/transitive-runtime-certificate.js'),
  runtimeGenerator: read('scripts/generate-transitive-runtime-certificate.js'),
  evaluationCorpus: read('src/evaluation-corpus.js'), evaluationBenchmark: read('scripts/benchmark-assurance.js'), controlledEvaluationRunner: read('scripts/run-controlled-assurance.js'),
  securityEvaluator: read('src/security-case-study.js'), securityScript: read('scripts/evaluate-security-cases.js'),
  securityManifest: read('case-studies/security/cases.json'),
  repeatedExample: read('examples/formal-transitive-calls-repeated.patch'),
  callTree: read('formal/PatchCallTree.lean'), callRuntime: read('formal/PatchCallRuntime.lean'), lakefile: read('formal/lakefile.lean'),
  formalWorkflow: read('.github/workflows/formal.yml'), ciWorkflow: read('.github/workflows/ci.yml'), pagesWorkflow: read('.github/workflows/pages.yml'),
  beta32Workflow: read('.github/workflows/beta32-invocation-frames.yml'),
  evaluationWorkflow: read('.github/workflows/assurance-evaluation.yml')
};

if (pkg.scripts?.['transitive-runtime-certify:example'] !==
    'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls.patch --out formal/GeneratedTransitiveRuntimeCertificate.lean') {
  throw new Error('package.json is missing the canonical beta.32 single-call runtime certificate command.');
}
if (pkg.scripts?.['transitive-runtime-certify:repeated'] !==
    'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls-repeated.patch --out formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean') {
  throw new Error('package.json is missing the canonical beta.32 repeated-call runtime certificate command.');
}
if (pkg.scripts?.['evaluate:assurance'] !== 'node scripts/benchmark-assurance.js') throw new Error('package.json is missing the canonical assurance evaluation command.');
if (pkg.scripts?.['evaluate:assurance:controlled'] !== 'node scripts/run-controlled-assurance.js --measurement-class controlled') {
  throw new Error('package.json is missing the canonical process-isolated controlled assurance command.');
}
if (pkg.scripts?.['evaluate:security'] !== 'node scripts/evaluate-security-cases.js') throw new Error('package.json is missing the canonical semantic-authority security evaluation command.');

requireAll('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.10`', 'Beta.34: Studio correctness and runtime integrity', 'Beta.33: Studio and production-readiness layer',
  'Beta.32', 'invocation-frame', 'PatchCallRuntime.lean', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean',
  'https://minh.systems/Patch/', 'Documentation', 'Downloads', 'Help', 'docs/BETA34.md'
]);
requireAll('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `data-patch-version="${version}"`,
  './language.html', './docs.html', './downloads.html', './help.html', './runtime-integrity.js', './studio-dom-sync.js', './form-window-resize.js'
]);
if (files.website.includes('class="site-info"') || files.website.includes('Small syntax. Visible changes. One Studio.')) {
  throw new Error('Studio page still contains the old combined language landing content.');
}
requireAll('web/language.html', files.languagePage, [
  `data-patch-version="${version}"`, studioVersion, 'Small syntax. Visible changes.', 'Beta.32 introduced invocation-frame-aware direct-Wasm correspondence'
]);
requireAll('web/docs.html', files.docsPage, [`data-patch-version="${version}"`, 'Patch documentation', 'docs/BETA34.md', 'docs/FORMAL_MODEL.md', 'docs/NATIVE_APPS.md']);
requireAll('web/downloads.html', files.downloadsPage, [`data-patch-version="${version}"`, 'SHA256SUMS', 'Get-FileHash', 'runtime-manifest.json', 'studio-runtime-v0.6', 'native-win32-runtime-v1.0']);
requireAll('web/help.html', files.helpPage, [`data-patch-version="${version}"`, 'Design a Window app', 'lower-right corner', 'Designer scrollbars', 'runtime manifest', 'canonical v2']);
requireAll('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, `Patch package **${version}**`, 'Change IR **0.10**', 'One canonical Studio state', 'project bundle that stores',
  'lower-right resize grip', 'runtime-manifest.json', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean', 'Beta.32 research boundary'
]);
requireAll('docs/BETA34.md', files.beta34, [version, 'One canonical Studio project state', 'Runtime integrity before browser packaging', 'studio-runtime-v0.6', 'runtime-manifest.json', 'fresh-first']);

// These documents retain beta.32 as the historical/formal assurance milestone even as the product beta advances.
requireAll('docs/NATIVE_APPS.md', files.native, ['Change IR **0.10**', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean', 'Beta.34 runtime-template integrity']);
requireAll('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.34:', '### beta.32:', 'invocation frames', 'repeated identical calls', 'Assurance overhead/scaling harness',
  'fresh-process outer runner', 'controlled paper-quality benchmark runs', 'Semantic-authority security ablation', '3 both-accept / 4 Patch-only-reject / 1 both-reject'
]);
requireAll('docs/COMPILER.md', files.compiler, ['Change IR **0.10**', 'Beta.32', 'invocation-frame', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean']);
requireAll('docs/FORMAL_MODEL.md', files.formal, ['Beta.32', 'checkedObservedTransitiveRuntimeRefinesCallerSignature', 'invocation-frame', 'runtime capture']);
requireAll('docs/NOVELTY.md', files.novelty, ['Beta.32', 'invocation-frame', 'supporting assurance']);
requireAll('paper/README.md', files.paper, [
  'Beta.32', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean', 'PatchCallRuntime.lean',
  'fresh-process controlled-measurement protocol', 'No overhead, scalability or asymptotic claim is made yet',
  'Semantic-authority security ablation', '4 cases  Patch reject / coarse target-write accept', 'not a model of any named effect system'
]);
requireAll('docs/EVALUATION.md', files.evaluation, [
  'Call-tree depth', 'Concrete invocation count', 'compileMs', 'executeMs', 'validateMs', 'correspondenceMs', 'certificateGenerationMs',
  'Process-isolated aggregation', 'Measurement classes', 'Patch Assurance Evaluation', 'hosted runner', 'SHA256SUMS'
]);
requireAll('docs/CONTROLLED_EVALUATION.md', files.controlledEvaluation, [
  'Measurement classes', 'git HEAD', 'clean Git working tree', 'output path is also fail-closed', 'median absolute deviation (MAD)', 'interquartile range (IQR)',
  'Until an actual controlled dataset is collected and reviewed'
]);
requireAll('docs/SECURITY_CASE_STUDIES.md', files.securityCasesDoc, [
  'coarse target-write baseline', 'internal ablation', '`loyalty-over-limit`', '`wallet-direction-escalation`', '`campaign-transitive-escalation`',
  '`dynamic-unbounded`', '3 cases: Patch accept / coarse accept', '4 cases: Patch reject / coarse accept',
  '1 case : Patch reject / coarse reject', 'not a claim about any named prior effect or capability system'
]);
requireAll('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, ['Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape']);

requireAll('web/runtime-integrity.js', files.runtimeIntegrity, ['patch-studio-runtime-integrity', 'runtime-manifest.json', "crypto.subtle.digest('SHA-256'", 'failed SHA-256 verification']);
requireAll('web/studio-dom-sync.js', files.studioDomSync, ["document.querySelector('#code')", "document.querySelector('#projectKind')", 'queueMicrotask', "new Event('input'", "new Event('change'"]);

requireAll('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", "'./formal-calls.js'", 'formalCalls']);
requireAll('src/formal-calls.js', files.formalCalls, ['buildFormalCalls', 'patch-formal-calls', 'rank-decreasing']);
requireAll('src/direct-trace-validator.js', files.directTrace, ["PATCH_DIRECT_INVOCATION_FRAME_VERSION = '0.1'", 'invocationFrames', 'activeFrameIds', 'parentFrameId']);
requireAll('src/direct-effect-validator.js', files.directEffect, ['frameIds', 'invocationFrames', 'invocationFrameVersion']);
requireAll('src/transitive-call-body.js', files.transitiveBody, ["PATCH_TRANSITIVE_CALL_BODY_VERSION = '0.2'", 'claimedScopedTrace', 'nestedCallDepth', 'buildNestedCall']);
requireAll('src/transitive-call-body-certificate.js', files.transitiveCertificate, [
  "PATCH_TRANSITIVE_CALL_BODY_CERTIFICATE_VERSION = '0.1'", 'CallTreeStmt.call', 'checkedConcreteTransitiveCallTreeRefinesCallerSignature'
]);
requireAll('src/transitive-runtime-correspondence.js', files.runtimeCorrespondence, [
  "PATCH_TRANSITIVE_RUNTIME_CORRESPONDENCE_VERSION = '0.2'", 'compileToDirectWasm', 'runDirectWasm', 'validateDirectSemanticEffects',
  'matchingFrames', 'sameBindings', 'frameIds.includes', 'runtimeTraceSha256'
]);
requireAll('src/transitive-runtime-certificate.js', files.runtimeCertificate, [
  "PATCH_TRANSITIVE_RUNTIME_CERTIFICATE_VERSION = '0.2'", 'frameBindings', 'frame_binding_checked', 'buildTransitiveRuntimeCorrespondence',
  'evalCallTreeStmtEqBool', 'checkedObservedTransitiveRuntimeRefinesCallerSignature', 'invocationFrameVersion'
]);
requireAll('scripts/generate-transitive-runtime-certificate.js', files.runtimeGenerator, ['generateTransitiveRuntimeCertificate', 'direct-Wasm trace sha256', 'invocation frame']);
requireAll('src/evaluation-corpus.js', files.evaluationCorpus, [
  "PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION = '0.1'", 'generateAssuranceScalingProgram', 'assuranceEvaluationScenarios', "preset === 'paper'", 'nestedDepth', 'invocations'
]);
requireAll('scripts/benchmark-assurance.js', files.evaluationBenchmark, [
  "format: 'patch-assurance-evaluation'", 'performance.now()', 'compileToDirectWasm', 'runDirectWasm', 'validateDirectSemanticEffects',
  'buildTransitiveRuntimeCorrespondence', 'generateTransitiveRuntimeCertificate', 'certificateGenerationMs', 'toCsv', 'environmentManifest'
]);
requireAll('scripts/run-controlled-assurance.js', files.controlledEvaluationRunner, [
  'scripts/benchmark-assurance.js', "format: 'patch-controlled-assurance-evaluation'", "version: '0.2'", "'controlled', 'hosted-ci', 'development'",
  'GITHUB_ACTIONS', 'git HEAD exactly', 'clean Git working tree', 'resolveSafeOutDir', 'stableScenarioSourceAndArtifacts', 'environmentFingerprintSha256', 'SHA256SUMS'
]);
requireAll('src/security-case-study.js', files.securityEvaluator, [
  "PATCH_SECURITY_CASE_STUDY_VERSION = '0.1'", 'evaluateSecurityCase', 'evaluateCoarseTargetWrite',
  'target-path-only; operation/magnitude/provability intentionally ignored', 'collectReachableTargets'
]);
requireAll('scripts/evaluate-security-cases.js', files.securityScript, [
  "format: 'patch-security-case-study-report'", 'coarse target-path write authority only', 'semanticAuthorityDifferentialRejects', 'toCsv', 'toMarkdown'
]);
requireAll('case-studies/security/cases.json', files.securityManifest, [
  'patch-security-case-study-manifest', 'coarse-target-write', 'loyalty-over-limit', 'wallet-direction-escalation',
  'campaign-transitive-escalation', 'dynamic-unbounded', 'target-escape'
]);
requireAll('examples/formal-transitive-calls-repeated.patch', files.repeatedExample, ['do caller(1)\ndo caller(1)']);
requireAll('formal/PatchCallTree.lean', files.callTree, ['inductive CallTreeStmt', 'theorem checkedConcreteTransitiveCallTreeRefinesCallerSignature']);
requireAll('formal/PatchCallRuntime.lean', files.callRuntime, ['import PatchCallTree', 'theorem checkedObservedTransitiveRuntimeRefinesCallerSignature', 'evalCallTreeStmtEqBool_sound']);
requireAll('formal/lakefile.lean', files.lakefile, ['lean_lib PatchCallTree', 'lean_lib PatchCallRuntime']);

requireAll('.github/workflows/formal.yml', files.formalWorkflow, [
  'transitive-runtime-certify:example', 'transitive-runtime-certify:repeated', 'PatchCallRuntime', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean'
]);
requireAll('.github/workflows/ci.yml', files.ciWorkflow, [
  'transitive-runtime-certify:example', 'transitive-runtime-certify:repeated', 'src/transitive-runtime-correspondence.js',
  'src/transitive-runtime-certificate.js', 'web/form-window-resize.js', 'web/project-config-restore.js', 'web/runtime-integrity.js', 'web/studio-dom-sync.js'
]);
requireAll('.github/workflows/pages.yml', files.pagesWorkflow, ['studio-runtime-v0.6', 'native-win32-runtime-v1.0', 'runtime-integrity-manifest.js', 'runtime-manifest.json', "cancel-in-progress: ${{ github.event_name == 'push' }}"]);
requireAll('.github/workflows/beta32-invocation-frames.yml', files.beta32Workflow, [
  'Patch Beta32 Invocation Frames', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean', 'PatchCallRuntime', 'cancel-in-progress: true'
]);
requireAll('.github/workflows/assurance-evaluation.yml', files.evaluationWorkflow, [
  'Patch Assurance Evaluation', 'workflow_dispatch:', 'process_runs:', 'run-controlled-assurance.js', '--measurement-class hosted-ci',
  'PATCH_EVAL_COMMIT', 'Measure Lean certificate checking', 'actions/upload-artifact@v', 'retention-days: 30'
]);
if (files.evaluationWorkflow.includes('--measurement-class controlled')) {
  throw new Error('.github/workflows/assurance-evaluation.yml must not label hosted GitHub Actions timing as controlled.');
}
requireAll('web/sw.js', files.serviceWorker, [
  `const PATCH_RELEASE = '${version}'`, "const REVISION = '__PATCH_SITE_REV__'", "'./language.html'", "'./docs.html'", "'./downloads.html'", "'./help.html'",
  "'./runtime-integrity.js'", "'./studio-dom-sync.js'", "'./form-window-resize.js'", "'../src/formal-calls.js'", "url.pathname.includes('/runtimes/')", 'freshFirst'
]);

console.log(`ok project surface is consistent at ${version}; beta.32 remains the formal assurance milestone`);

function requireAll(name, content, phrases) {
  for (const phrase of phrases) if (!content.includes(phrase)) throw new Error(`${name} is missing required project contract: ${phrase}`);
}
