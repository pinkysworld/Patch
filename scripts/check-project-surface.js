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
  runtime: read('docs/RUNTIME_CORRESPONDENCE.md'), serviceWorker: read('web/sw.js')
};

mustInclude('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.9`', 'Independent raw-source parser',
  'Independent raw-source guard parser', 'guardValidation', 'PatchGuarded.lean', 'GuardPathValid',
  'checkedGuardedConcreteRuntimeCannotEscape', 'Standalone Window Web App', 'button `clicked`',
  'Windows Window/GUI', 'macOS Window/GUI', 'Linux Window/GUI', 'FreeBSD Console', '--target c99',
  'FreeBSD 15.1', 'not yet a standalone WASI command module', 'formal recipe-call/substitution semantics',
  'translation validation', 'docs/RUNTIME_CORRESPONDENCE.md'
]);
mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.9',
  'Standalone Window Web App', 'Window preflight', 'RuntimePath', 'GuardTree', 'branchThen', 'branchElse',
  'checkedGuardedConcreteRuntimeCannotEscape', 'Windows App (.exe)', 'macOS App (.app)', 'Linux App',
  'FreeBSD Console', 'Project Type', 'portable C99', 'FreeBSD 15.1', 'not yet a standalone WASI command', 'Roadmap'
]);
mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.9**', 'Standalone Window Web App', 'button `clicked`',
  'FreeBSD Console builds through the portable C99 backend', 'guard-aware Lean certificate', 'patch runtime-certify'
]);
mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.9**', 'Window preflight', 'Portable C99', 'FreeBSD 15.1',
  'not yet native-widget lowering', 'PatchGuarded.lean', 'checkedGuardedConcreteRuntimeCannotEscape'
]);
mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, `### beta.${beta}: guard-aware runtime correspondence`,
  'Change IR **0.9**', 'PatchGuarded.lean', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape',
  'formal recipe-call/substitution semantics', 'native AppKit Window backend'
]);
mustInclude('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.9**', 'sourceValidation', 'guardValidation', 'Standalone Window Web App',
  'PatchGuarded.checkGuardedSourceRuntimeEvidence', 'checkedGuardedConcreteRuntimeCannotEscape', 'raw GuardTree'
]);
mustInclude('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.23', 'PatchGuarded.lean', 'GuardExpr', 'evalGuard', 'GuardShape', 'GuardPathValid',
  'checkGuardedSourceRuntimeEvidence_sound', 'checkedGuardedConcreteRuntimeCannotEscape', 'SourceExecutes'
]);
mustInclude('docs/NOVELTY.md', files.novelty, [
  'Beta.23', 'guard-aware', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape',
  'end-to-end compiler verification', 'formal recipe-call/substitution semantics'
]);
mustInclude('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.9`, 'Beta.23 guard-aware milestone', 'PatchGuarded.lean',
  'checkGuardedSourceRuntimeEvidence', 'checkedGuardedConcreteRuntimeCannotEscape'
]);
mustInclude('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  `Status: **${version}**`, 'Change IR **0.9**', 'GuardShape', 'GuardPathValid', 'branchThen', 'branchElse',
  'checkGuardedSourceRuntimeEvidence_sound', 'checkedGuardedConcreteRuntimeCannotEscape', 'SourceExecutes'
]);
mustInclude('web/sw.js', files.serviceWorker, [
  cacheVersion, "'../src/formal-guard.js'", "'../src/guard-validation.js'", "'../src/c99.js'",
  "'../src/window-webapp.js'", "'../src/window-build.js'", 'freshFirst'
]);

for (const [name, content] of Object.entries({
  'README.md': files.readme,
  'web/index.html': files.website,
  'docs/PATCH_STUDIO.md': files.studio,
  'docs/NATIVE_APPS.md': files.native,
  'docs/COMPILER.md': files.compiler,
  'paper/README.md': files.paper
})) rejectOtherFullBeta(name, content, beta);

console.log(`ok project surface is consistent at ${version}`);

function mustInclude(name, content, phrases) {
  for (const phrase of phrases) if (!content.includes(phrase)) throw new Error(`${name} is missing required current-project text: ${phrase}`);
}

function rejectOtherFullBeta(name, content, expectedBeta) {
  const found = [...content.matchAll(/0\.2\.0-beta\.(\d+)|0\.2 beta\.(\d+)/g)].map(match => match[1] ?? match[2]);
  for (const value of found) if (value !== expectedBeta) throw new Error(`${name} contains stale public beta ${value}; expected ${expectedBeta}`);
}
