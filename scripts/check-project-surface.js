#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
const version = pkg.version;
const match = /^0\.2\.0-beta\.(\d+)$/.exec(version);
if (!match) throw new Error(`Unexpected Patch beta version format: ${version}`);
const beta = match[1];
const studioVersion = `0.2 beta.${beta}`;

if (version !== '0.2.0-beta.35') throw new Error(`Current project surface expects beta.35, got ${version}`);

const files = {
  readme: read('README.md'),
  website: read('web/index.html'),
  languagePage: read('web/language.html'),
  docsPage: read('web/docs.html'),
  downloadsPage: read('web/downloads.html'),
  helpPage: read('web/help.html'),
  studio: read('docs/PATCH_STUDIO.md'),
  beta34: read('docs/BETA34.md'),
  beta35: read('docs/BETA35.md'),
  native: read('docs/NATIVE_APPS.md'),
  offline: read('docs/OFFLINE_COMPILER.md'),
  roadmap: read('docs/ROADMAP.md'),
  compiler: read('docs/COMPILER.md'),
  formal: read('docs/FORMAL_MODEL.md'),
  novelty: read('docs/NOVELTY.md'),
  callSite: read('docs/CALL_SITE_VALIDATION.md'),
  paper: read('paper/README.md'),
  paperMain: read('paper/main.tex'),
  paperRelated: read('paper/related-work.tex'),
  evaluation: read('docs/EVALUATION.md'),
  controlledEvaluation: read('docs/CONTROLLED_EVALUATION.md'),
  securityCasesDoc: read('docs/SECURITY_CASE_STUDIES.md'),
  runtime: read('docs/RUNTIME_CORRESPONDENCE.md'),
  serviceWorker: read('web/sw.js'),
  runtimeIntegrity: read('web/runtime-integrity.js'),
  studioDomSync: read('web/studio-dom-sync.js'),
  studioListboxAdapter: read('web/table-stage1.js'),
  webapp: read('src/webapp.js'),
  windowWebapp: read('src/window-webapp.js'),
  windowEvents: read('src/window-events.js'),
  compilerJs: read('src/compiler.js'),
  formalCalls: read('src/formal-calls.js'),
  directTrace: read('src/direct-trace-validator.js'),
  directEffect: read('src/direct-effect-validator.js'),
  transitiveBody: read('src/transitive-call-body.js'),
  transitiveCertificate: read('src/transitive-call-body-certificate.js'),
  runtimeCorrespondence: read('src/transitive-runtime-correspondence.js'),
  runtimeCertificate: read('src/transitive-runtime-certificate.js'),
  runtimeGenerator: read('scripts/generate-transitive-runtime-certificate.js'),
  evaluationCorpus: read('src/evaluation-corpus.js'),
  evaluationBenchmark: read('scripts/benchmark-assurance.js'),
  controlledEvaluationRunner: read('scripts/run-controlled-assurance.js'),
  securityEvaluator: read('src/security-case-study.js'),
  securityScript: read('scripts/evaluate-security-cases.js'),
  securityManifest: read('case-studies/security/cases.json'),
  repeatedExample: read('examples/formal-transitive-calls-repeated.patch'),
  mixedGuardExample: read('examples/formal-transitive-calls-mixed-guards.patch'),
  listboxExample: read('examples/listbox-multiselect-window.patch'),
  callTree: read('formal/PatchCallTree.lean'),
  callRuntime: read('formal/PatchCallRuntime.lean'),
  lakefile: read('formal/lakefile.lean'),
  formalWorkflow: read('.github/workflows/formal.yml'),
  ciWorkflow: read('.github/workflows/ci.yml'),
  pagesWorkflow: read('.github/workflows/pages.yml'),
  beta32Workflow: read('.github/workflows/beta32-invocation-frames.yml'),
  evaluationWorkflow: read('.github/workflows/assurance-evaluation.yml'),
  siteCheck: read('scripts/check-site.js'),
  siteV10Check: read('scripts/check-site-v10.js'),
  siteV12Check: read('scripts/check-site-v12.js'),
  siteBeta34Check: read('scripts/check-site-beta34.js'),
  siteBeta35Check: read('scripts/check-site-beta35.js')
};

requireScript('transitive-runtime-certify:example', 'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls.patch --out formal/GeneratedTransitiveRuntimeCertificate.lean');
requireScript('transitive-runtime-certify:repeated', 'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls-repeated.patch --out formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean');
requireScript('transitive-runtime-certify:mixed-guards', 'node scripts/generate-transitive-runtime-certificate.js examples/formal-transitive-calls-mixed-guards.patch --out formal/GeneratedMixedGuardTransitiveRuntimeCertificate.lean');
requireScript('evaluate:assurance', 'node scripts/benchmark-assurance.js');
requireScript('evaluate:assurance:controlled', 'node scripts/run-controlled-assurance.js --measurement-class controlled');
requireScript('evaluate:security', 'node scripts/evaluate-security-cases.js');
requireScript('evaluate:checkout-extension', 'node scripts/evaluate-checkout-extension.js');
requireScript('evaluate:quota-extension', 'node scripts/evaluate-extension-case.js --case quota-extension');
requireScript('check:site', 'node scripts/check-site.js && node scripts/check-site-v10.js && node scripts/check-site-v12.js && node scripts/check-site-beta35.js');

// Current product surfaces.
requireAll('README.md', files.readme, [
  `Current development beta: \`${version}\``,
  'Beta.35: list-backed ListBox multi-select',
  'Beta.34: Studio correctness and runtime integrity',
  'Change IR: `0.10`',
  'Browser ListBox',
  'Native GUI IR 0.7 does not model persistent list state',
  'docs/BETA35.md',
  'GeneratedRepeatedTransitiveRuntimeCertificate.lean'
]);
requireAll('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`,
  `data-patch-version="${version}"`,
  'token-free Ready/offline Windows, macOS and Linux apps',
  'Native GUI IR 1.1', 'payload v11', 'Runtime v1.2',
  'Persistent selection still changes only through explicit <b>change</b>',
  './runtime-integrity.js', './studio-dom-sync.js', './table-stage1.js'
]);
requireAll('web/language.html', files.languagePage, [
  `data-patch-version="${version}"`, studioVersion,
  'ListBox selection follows the state type',
  'create list fruits',
  'Native GUI IR 0.7 does not yet model persistent list state'
]);
requireAll('web/docs.html', files.docsPage, [
  `data-patch-version="${version}"`,
  'docs/BETA35.md', 'docs/NATIVE_LIST_STATE.md', 'docs/BETA34.md', 'docs/FORMAL_MODEL.md', 'docs/CALL_SITE_VALIDATION.md'
]);
requireAll('web/downloads.html', files.downloadsPage, [
  `data-patch-version="${version}"`,
  'Beta.35 multi-select ListBox boundary',
  'Current native Ready/AOT/offline Window builds do not claim list-backed multi-select ListBox support.',
  'SHA256SUMS', 'runtime-manifest.json', 'native-win32-runtime-v1.0'
]);
requireAll('web/help.html', files.helpPage, [
  `data-patch-version="${version}"`,
  'ListBox: single or multi-select',
  'intended beta.35 fail-closed boundary',
  'runtime manifest', 'canonical v2'
]);

// Current docs and historical release separation.
requireAll('docs/BETA35.md', files.beta35, [
  'Patch 0.2.0-beta.35',
  'List-backed ListBox contract',
  'Standalone Web',
  'Native GUI IR 0.7 supports number, text and boolean persistent state',
  'Window event adapter contract to **0.7**',
  'Change IR **0.10**'
]);
requireAll('docs/BETA34.md', files.beta34, [
  '0.2.0-beta.34',
  'One canonical Studio project state',
  'Runtime integrity before browser packaging',
  'runtime-manifest.json', 'fresh-first'
]);
if (files.beta34.includes('Patch 0.2.0-beta.35')) throw new Error('Historical BETA34.md was incorrectly relabelled as beta.35.');
requireAll('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`,
  `Patch package **${version}**`,
  'ListBox multi-selection',
  'list-backed ListBox',
  'Native GUI IR 0.7 currently supports number, text and boolean persistent state',
  'Change IR **0.10**',
  'Beta.32 research boundary'
]);
requireAll('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`,
  '### beta.35: browser and native ListBox multi-selection',
  'Window event adapter **0.7**',
  'versioned Native GUI IR/runtime list-state extension for native multi-select parity',
  '### beta.34:', '### beta.32:',
  'controlled paper-quality benchmark runs',
  'genuine external/third-party plugin or extension integration study',
  'main manuscript synchronized to beta.32 assurance / beta.35 artifact status'
]);
requireAll('docs/NATIVE_APPS.md', files.native, ['Change IR **0.10**', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean', 'Beta.34 runtime-template integrity']);
requireAll('docs/OFFLINE_COMPILER.md', files.offline, ['payload **v9**', 'runtime **v1.0**']);

// Browser implementation contract.
requireAll('src/window-events.js', files.windowEvents, [
  "export const PATCH_WINDOW_EVENTS_VERSION = '0.8'",
  "controlType === 'listbox'",
  "stateType === 'list'",
  'text-list event-local value'
]);
requireAll('src/window-webapp.js', files.windowWebapp, [
  "PATCH_WINDOW_WEB_VERSION = '0.9'",
  'allowTree: true',
  'function uiTreeNodes(nodes)',
  "root.setAttribute('role','tree')",
  'selected node path'
]);
requireAll('web/table-stage1.js', files.studioListboxAdapter, [
  'appListboxSelections', 'collectListInitials',
  'select.multiple = true', 'aria-multiselectable', 'selectedOptions',
  'patch-studio-table-changed'
]);
requireAll('src/webapp.js', files.webapp, [
  'addWindowListboxMultiselect', 'hasListBackedListbox',
  'listboxSelections=new Map()', 'el.multiple=true', 'selectedOptions',
  "listboxMultiSelectMode: 'list-state-text-list'"
]);
requireAll('examples/listbox-multiselect-window.patch', files.listboxExample, [
  'create list fruits',
  'listbox "Apple", "Banana", "Cherry", "Mango" as fruits',
  'change fruits:', 'set = value'
]);

// Paper/research surfaces. Product version moves, assurance milestone does not.
requireAll('paper/README.md', files.paper, [
  `product artifact: **Patch ${version}**`,
  'formal runtime-correspondence milestone: **beta.32**',
  'Beta.35 adds browser product behavior only',
  'GeneratedMixedGuardTransitiveRuntimeCertificate.lean',
  'no controlled paper-quality performance dataset has been collected yet',
  'internal ablation, not a model of a named effect or capability system'
]);
requireAll('paper/main.tex', files.paperMain, [
  'Beta 35 product artifact / Beta 32 assurance manuscript',
  'Beta 30 finite transitive exact call trees', 'Beta 31 call-aware bridge', 'Beta 32 invocation frames',
  'GeneratedMixedGuardTransitiveRuntimeCertificate.lean',
  'no controlled paper-quality timing dataset yet',
  'Patch Reproducibility Bundle', '\\input{related-work}', '\\bibliography{references}'
]);
if (files.paperMain.includes('Beta 28 research artifact manuscript')) throw new Error('paper/main.tex regressed to the old beta.28 manuscript identity.');
requireAll('paper/related-work.tex', files.paperRelated, [
  'Related Work and Claim Boundary', 'sunshine2011plaid', 'brachthaeuser2020effects',
  'orchard2019quantitative', 'nanevski2008htt', 'swamy2016fstar',
  'sole modeled persistent-mutation route', 'not claim unique expressibility'
]);

// Formal and trust-boundary invariants.
requireAll('docs/COMPILER.md', files.compiler, ['Change IR **0.10**', 'Beta.32', 'invocation-frame']);
requireAll('docs/FORMAL_MODEL.md', files.formal, [
  'Beta.32', 'checkedObservedTransitiveRuntimeRefinesCallerSignature',
  'Independent static call-site binding', 'runtime capture', 'does not prove the production parser correct'
]);
requireAll('docs/CALL_SITE_VALIDATION.md', files.callSite, [
  'patch-call-site-validation', 'caller', 'callee', 'source line', 'argument',
  'does **not** prove the Patch parser correct'
]);
requireAll('docs/NOVELTY.md', files.novelty, ['Beta.32', 'supporting assurance', 'Expressibility is not the novelty claim']);
requireAll('src/compiler.js', files.compilerJs, ["PATCH_IR_VERSION = '0.10'", 'formalCalls', 'callSiteValidation']);
requireAll('src/formal-calls.js', files.formalCalls, ['buildFormalCalls', 'patch-formal-calls', 'rank-decreasing']);
requireAll('src/direct-trace-validator.js', files.directTrace, ["PATCH_DIRECT_INVOCATION_FRAME_VERSION = '0.1'", 'invocationFrames', 'activeFrameIds', 'parentFrameId']);
requireAll('src/direct-effect-validator.js', files.directEffect, ['frameIds', 'invocationFrames', 'invocationFrameVersion']);
requireAll('src/transitive-call-body.js', files.transitiveBody, ["PATCH_TRANSITIVE_CALL_BODY_VERSION = '0.2'", 'nestedCallDepth', 'buildNestedCall']);
requireAll('src/transitive-call-body-certificate.js', files.transitiveCertificate, [
  "PATCH_TRANSITIVE_CALL_BODY_CERTIFICATE_VERSION = '0.1'", 'CallTreeStmt.call', 'checkedConcreteTransitiveCallTreeRefinesCallerSignature'
]);
requireAll('src/transitive-runtime-correspondence.js', files.runtimeCorrespondence, [
  "PATCH_TRANSITIVE_RUNTIME_CORRESPONDENCE_VERSION = '0.2'", 'compileToDirectWasm', 'runDirectWasm',
  'validateDirectSemanticEffects', 'matchingFrames', 'sameBindings', 'runtimeTraceSha256'
]);
requireAll('src/transitive-runtime-certificate.js', files.runtimeCertificate, [
  "PATCH_TRANSITIVE_RUNTIME_CERTIFICATE_VERSION = '0.2'", 'frameBindings', 'frame_binding_checked',
  'evalCallTreeStmtEqBool', 'checkedObservedTransitiveRuntimeRefinesCallerSignature'
]);
requireAll('examples/formal-transitive-calls-repeated.patch', files.repeatedExample, ['do caller(1)\ndo caller(1)']);
requireAll('examples/formal-transitive-calls-mixed-guards.patch', files.mixedGuardExample, ['do caller(1)', 'do caller(4)']);
requireAll('formal/PatchCallTree.lean', files.callTree, ['inductive CallTreeStmt', 'checkedConcreteTransitiveCallTreeRefinesCallerSignature']);
requireAll('formal/PatchCallRuntime.lean', files.callRuntime, ['import PatchCallTree', 'checkedObservedTransitiveRuntimeRefinesCallerSignature']);
requireAll('formal/lakefile.lean', files.lakefile, ['lean_lib PatchCallTree', 'lean_lib PatchCallRuntime']);

// Evaluation, security and reproducibility contracts.
requireAll('docs/EVALUATION.md', files.evaluation, [
  'Call-tree depth', 'Concrete invocation count', 'compileMs', 'executeMs', 'validateMs',
  'correspondenceMs', 'certificateGenerationMs', 'Process-isolated aggregation', 'Measurement classes', 'SHA256SUMS'
]);
requireAll('docs/CONTROLLED_EVALUATION.md', files.controlledEvaluation, [
  'Measurement classes', 'git HEAD', 'clean Git working tree',
  'median absolute deviation (MAD)', 'interquartile range (IQR)',
  'Until an actual controlled dataset is collected and reviewed'
]);
requireAll('docs/SECURITY_CASE_STUDIES.md', files.securityCasesDoc, [
  'internal ablation', '`loyalty-over-limit`', '`wallet-direction-escalation`',
  '3 cases: Patch accept / coarse accept', '4 cases: Patch reject / coarse accept',
  '1 case : Patch reject / coarse reject'
]);
requireAll('src/evaluation-corpus.js', files.evaluationCorpus, [
  "PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION = '0.1'", 'generateAssuranceScalingProgram', 'assuranceEvaluationScenarios'
]);
requireAll('scripts/benchmark-assurance.js', files.evaluationBenchmark, [
  "format: 'patch-assurance-evaluation'", 'performance.now()', 'compileToDirectWasm',
  'validateDirectSemanticEffects', 'certificateGenerationMs', 'environmentManifest'
]);
requireAll('scripts/run-controlled-assurance.js', files.controlledEvaluationRunner, [
  'scripts/benchmark-assurance.js', "format: 'patch-controlled-assurance-evaluation'",
  "'controlled', 'hosted-ci', 'development'", 'GITHUB_ACTIONS', 'clean Git working tree', 'SHA256SUMS'
]);
requireAll('src/security-case-study.js', files.securityEvaluator, [
  "PATCH_SECURITY_CASE_STUDY_VERSION = '0.1'", 'evaluateSecurityCase', 'evaluateCoarseTargetWrite'
]);
requireAll('scripts/evaluate-security-cases.js', files.securityScript, [
  "format: 'patch-security-case-study-report'", 'semanticAuthorityDifferentialRejects', 'toCsv', 'toMarkdown'
]);
requireAll('case-studies/security/cases.json', files.securityManifest, [
  'patch-security-case-study-manifest', 'loyalty-over-limit', 'wallet-direction-escalation', 'target-escape'
]);

// Runtime integrity and update behavior.
requireAll('web/runtime-integrity.js', files.runtimeIntegrity, [
  'patch-studio-runtime-integrity', 'runtime-manifest.json', "crypto.subtle.digest('SHA-256'", 'failed SHA-256 verification'
]);
requireAll('web/studio-dom-sync.js', files.studioDomSync, [
  "document.querySelector('#code')", "document.querySelector('#projectKind')", 'queueMicrotask', "new Event('input'", "new Event('change'"
]);
requireAll('web/sw.js', files.serviceWorker, [
  `const PATCH_RELEASE = '${version}'`,
  "url.pathname.includes('/runtimes/')", "cache: 'no-store'", 'ignoreSearch: true'
]);

// CI/workflow surface.
requireAll('.github/workflows/formal.yml', files.formalWorkflow, [
  'transitive-runtime-certify:example', 'transitive-runtime-certify:repeated',
  'PatchCallRuntime', 'GeneratedRepeatedTransitiveRuntimeCertificate.lean', 'src/call-site-validation.js'
]);
requireAll('.github/workflows/beta32-invocation-frames.yml', files.beta32Workflow, [
  'transitive-runtime-certify:repeated', 'transitive-runtime-certify:mixed-guards',
  'GeneratedMixedGuardTransitiveRuntimeCertificate.lean', 'src/call-site-validation.js'
]);
requireAll('.github/workflows/ci.yml', files.ciWorkflow, [
  'transitive-runtime-certify:example', 'transitive-runtime-certify:repeated',
  'src/transitive-runtime-correspondence.js', 'src/transitive-runtime-certificate.js',
  'web/runtime-integrity.js', 'web/studio-dom-sync.js'
]);
requireAll('.github/workflows/pages.yml', files.pagesWorkflow, [
  'runtime-integrity-manifest.js', 'runtime-manifest.json',
  'native-win32-runtime-v1.2', 'native-macos-runtime-v1.2', 'native-linux-runtime-v1.2',
  'Patch Native Sealed List Runtime', 'Patch Native Sealed Menu Runtime', 'Patch Native Sealed Menu Runtime v1.2 Release'
]);
requireAll('.github/workflows/assurance-evaluation.yml', files.evaluationWorkflow, [
  'run-controlled-assurance.js', 'hosted-ci', 'benchmark-assurance.js'
]);

// Site validators: historical beta/Table gates stay frozen; v1.2 owns current Ready runtime assertions.
requireAll('scripts/check-site.js', files.siteCheck, ['Patch Studio', 'check-site']);
requireAll('scripts/check-site-v10.js', files.siteV10Check, ['Table-ready Patch Studio site surface']);
requireAll('scripts/check-site-v12.js', files.siteV12Check, [
  'Studio Ready v1.2 site check failed', 'buildNativeGuiIRV11 as buildNativeGuiIR',
  'PATCH_SEALED_NATIVE_GUI_MENU_VERSION', 'docs/NATIVE_LIST_STATE.md', 'payload v11/runtime v1.2'
]);
requireAll('scripts/check-site-beta34.js', files.siteBeta34Check, ['beta.34', 'runtime-manifest.json']);
requireAll('scripts/check-site-beta35.js', files.siteBeta35Check, [
  '0.2.0-beta.35', 'Studio multi-select ListBox adapter',
  'Standalone Web multi-select ListBox contract', 'Window event adapter v0.7',
  'Beta.35 multi-select ListBox boundary'
]);

console.log(`ok Patch project surface ${version}`);

function requireScript(name, expected) {
  if (pkg.scripts?.[name] !== expected) throw new Error(`package.json script ${name} does not match the canonical project contract.`);
}
function requireAll(label, content, markers) {
  for (const marker of markers) {
    if (!content.includes(marker)) throw new Error(`${label} is missing required project surface: ${marker}`);
  }
}