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
  'patch runtime-certify', 'Lean-checked runtime correspondence', 'SourceExecutes',
  'Windows Window/GUI', 'macOS Window/GUI', 'Linux Window/GUI', 'FreeBSD Console', '--target c99', 'FreeBSD 15.1',
  'not yet a standalone WASI command module', 'translation validation', 'docs/RUNTIME_CORRESPONDENCE.md', 'docs/ROADMAP.md'
]);
mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.8', 'Independent raw-source validation',
  'Runtime → Lean correspondence', 'SourceExecutes', 'Windows App (.exe)', 'macOS App (.app)', 'Linux App', 'FreeBSD Console',
  'Project Type', 'portable C99', 'FreeBSD 15.1', 'not yet a standalone WASI command', 'State-Change Factorization', 'Roadmap'
]);
mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'FreeBSD Console builds through the portable C99 backend', 'patch runtime-certify'
]);
mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Portable C99', 'FreeBSD 15.1', 'not yet native-widget lowering', 'runtime-certify'
]);
mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, `### beta.${beta}: direct runtime → Lean source-execution correspondence`,
  'FreeBSD Console package through portable C99', 'checkSourceRuntimeEvidence_sound', 'native AppKit Window backend'
]);
mustInclude('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.8**', 'sourceValidation', 'runtime Lean certificate', 'PatchRuntime.lean', 'checkSourceRuntimeEvidence_sound'
]);
mustInclude('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.20', 'PatchRuntime.lean', 'EffectRefines', 'checkSourceRuntimeEvidence_sound', 'SourceExecutes source formalTrace'
]);
mustInclude('docs/NOVELTY.md', files.novelty, [
  'Beta.20', 'runtime correspondence', 'checkSourceRuntimeEvidence_sound', 'not** end-to-end compiler verification'
]);
mustInclude('paper/README.md', files.paper, [
  `Patch ${version} / Change IR 0.8`, 'Beta.20 runtime-correspondence milestone', 'PatchRuntime.lean', 'GeneratedRuntimeCertificate.lean'
]);
mustInclude('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, [
  `Status: **${version}**`, 'EffectRefines', 'checkSourceRuntimeEvidence_sound', 'SourceExecutes source formalTrace'
]);
mustInclude('web/sw.js', files.serviceWorker, [cacheVersion, "'../src/c99.js'", "'../src/source-validation.js'"]);

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
