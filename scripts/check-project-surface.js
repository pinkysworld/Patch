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
  `Current development beta: \`${version}\``, 'Change IR: `0.8`', 'Independent raw-source parser',
  'Runtime → Lean correspondence', 'RuntimePath', 'checkedConcreteRuntimeCannotEscape', 'PatchRuntimeCapability.lean',
  'Standalone Window Web App', 'button `clicked`', 'Windows Window/GUI', 'macOS Window/GUI', 'Linux Window/GUI',
  'FreeBSD Console', '--target c99', 'FreeBSD 15.1', 'not yet a standalone WASI command module',
  'typed, guard-aware execution core', 'translation validation', 'docs/RUNTIME_CORRESPONDENCE.md'
]);
mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.8',
  'Standalone Window Web App', 'Window preflight', 'RuntimePath', 'SourceExecutes',
  'checkedConcreteRuntimeCannotEscape', 'Windows App (.exe)', 'macOS App (.app)', 'Linux App', 'FreeBSD Console',
  'Project Type', 'portable C99', 'FreeBSD 15.1', 'not yet a standalone WASI command',
  'State-Change Factorization', 'Roadmap'
]);
mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Standalone Window Web App', 'button `clicked`',
  'FreeBSD Console builds through the portable C99 backend', 'patch runtime-certify'
]);
mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Window preflight', 'Portable C99', 'FreeBSD 15.1',
  'not yet native-widget lowering', 'checkedConcreteRuntimeCannotEscape'
]);
mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, `### beta.${beta}: Window runtime hardening + concrete runtime capability containment`,
  'checkedConcreteRuntimeCannotEscape', 'typed, guard-aware execution core',
  'FreeBSD Console package through portable C99', 'native AppKit Window backend'
]);
mustInclude('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.8**', 'sourceValidation', 'Standalone Window Web App',
  'PatchRuntime.lean', 'PatchRuntimeCapability.lean', 'checkedConcreteRuntimeCannotEscape', 'typed, guard-aware execution core'
]);
mustInclude('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.22', 'PatchRuntime.lean', 'PatchRuntimeCapability.lean', 'EffectRefines', 'RuntimePath',
  'checkSourceRuntimeEvidence_sound', 'checkedConcreteRuntimeCannotEscape', 'SourceExecutes source formalTrace'
]);
mustInclude('docs/NOVELTY.md', files.novelty, [
  'Beta.22', 'runtime capability', 'RuntimePath', 'checkedConcreteRuntimeCannotEscape',
  'end-to-end compiler verification', 'guard-aware execution core'
]);
mustInclude('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.8`, 'Beta.22 runtime-capability milestone',
  'PatchRuntimeCapability.lean', 'checkedConcreteRuntimeCannotEscape', 'GeneratedRuntimeCertificate.lean'
]);
mustInclude('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  `Status: **${version}**`, 'EffectRefines', 'RuntimePath', 'branchThen', 'repeatSucc',
  'checkSourceRuntimeEvidence_sound', 'checkedConcreteRuntimeCannotEscape', 'SourceExecutes source formalTrace'
]);
mustInclude('web/sw.js', files.serviceWorker, [
  cacheVersion, "'../src/c99.js'", "'../src/source-validation.js'", "'../src/window-webapp.js'", "'../src/window-build.js'", 'freshFirst'
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
