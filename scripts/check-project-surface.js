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
  windowEvents: read('src/window-events.js'), windowBuild: read('src/window-build.js'), windowWeb: read('src/window-webapp.js'),
  playground: read('web/playground.js'), desktopBuilder: read('scripts/build-native-window.js')
};

mustInclude('README.md', files.readme, [
  `Current development beta: \`${version}\``, 'Change IR: `0.9`', 'Beta.24: semantic Window input events',
  '`input changed`', 'event-local', '`value`', 'src/window-events.js', 'button `clicked`', 'input `changed`',
  'PatchGuarded.lean', 'GuardPathValid', 'Standalone Window Web App', 'Windows Window/GUI', 'macOS Window/GUI',
  'Linux Window/GUI', 'FreeBSD Console', 'portable C99', 'FreeBSD 15.1', 'not yet a standalone WASI command module',
  'formal recipe-call/substitution semantics', 'translation validation', 'docs/RUNTIME_CORRESPONDENCE.md'
]);

mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`, `Beta ${version}`, 'Change IR 0.9',
  'Semantic input events', 'event-local', '<code>value</code>', 'button <code>clicked</code>', 'input <code>changed</code>',
  'Standalone Window Web App', 'Window preflight', 'RuntimePath', 'GuardTree',
  'checkedGuardedConcreteRuntimeCannotEscape', 'Windows App (.exe)', 'macOS App (.app)', 'Linux App',
  'FreeBSD Console', 'Project Type', 'portable C99', 'FreeBSD 15.1', 'Roadmap'
]);

mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`, 'Change IR **0.9**', 'Semantic input events', 'event-local',
  '`window-events.js`', 'input `changed`', 'button `clicked`', cacheVersion,
  'FreeBSD Console builds through the portable C99 backend', 'patch runtime-certify'
]);

mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`, 'Change IR **0.9**', 'Window preflight', 'input `changed`', 'event-local `value`',
  '`src/window-events.js`', 'Portable C99', 'FreeBSD 15.1', 'not yet native-widget lowering'
]);

mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`, '### beta.24: semantic Window input events',
  'input `changed` exposes transient event-local `value`', '`src/window-events.js`',
  'formal recipe-call/substitution semantics', 'native AppKit Window backend'
]);

mustInclude('docs/COMPILER.md', files.compiler, [
  `Status: **${version}**`, 'Change IR **0.9**', 'Beta.24 Window event path', '`src/window-events.js`',
  'button + clicked', 'input  + changed', 'transient event payload', "PATCH_WINDOW_WEB_VERSION = '0.3'"
]);

// The formal/runtime research layer remains the beta.23 milestone in beta.24.
mustInclude('docs/FORMAL_MODEL.md', files.formal, [
  'Status: **beta.23', 'PatchGuarded.lean', 'GuardExpr', 'GuardPathValid',
  'checkGuardedSourceRuntimeEvidence_sound', 'checkedGuardedConcreteRuntimeCannotEscape'
]);
mustInclude('docs/NOVELTY.md', files.novelty, ['Beta.23', 'guard-aware', 'end-to-end compiler verification']);
mustInclude('docs/RUNTIME_CORRESPONDENCE.md', files.runtime, ['Status: **0.2.0-beta.23**', 'GuardPathValid', 'checkedGuardedConcreteRuntimeCannotEscape']);
mustInclude('paper/README.md', files.paper, ['PatchGuarded.lean', 'checkedGuardedConcreteRuntimeCannotEscape']);

mustInclude('src/window-events.js', files.windowEvents, ['triggerWindowEvent', 'event-local value', 'PATCH_WINDOW_EVENTS_VERSION']);
mustInclude('src/window-build.js', files.windowBuild, ["controlType === 'button' && event.event === 'clicked'", "controlType === 'input' && event.event === 'changed'", "'changed' on inputs"]);
mustInclude('src/window-webapp.js', files.windowWeb, ["PATCH_WINDOW_WEB_VERSION = '0.3'", "event==='changed'", "{value:el.value}"]);
mustInclude('web/playground.js', files.playground, ["'../src/window-events.js'", 'triggerWindowEvent', "addEventListener('input'", "'changed', { value: el.value }"]);
mustInclude('scripts/build-native-window.js', files.desktopBuilder, ["'./src/window-events.js'", 'triggerWindowEvent', "addEventListener('input'", "'changed',{value:el.value}"]);

mustInclude('web/sw.js', files.serviceWorker, [
  cacheVersion, "'../src/formal-guard.js'", "'../src/guard-validation.js'", "'../src/c99.js'",
  "'../src/window-webapp.js'", "'../src/window-build.js'", "'../src/window-events.js'", 'freshFirst'
]);

for (const [name, content] of Object.entries({
  'README.md': files.readme,
  'web/index.html': files.website,
  'docs/PATCH_STUDIO.md': files.studio,
  'docs/NATIVE_APPS.md': files.native,
  'docs/ROADMAP.md': files.roadmap,
  'docs/COMPILER.md': files.compiler
})) rejectOtherProductBeta(name, content, beta);

console.log(`ok project surface is consistent at ${version}`);

function mustInclude(name, content, phrases) {
  for (const phrase of phrases) if (!content.includes(phrase)) throw new Error(`${name} is missing required current-project text: ${phrase}`);
}

function rejectOtherProductBeta(name, content, expectedBeta) {
  const found = [...content.matchAll(/0\.2\.0-beta\.(\d+)|0\.2 beta\.(\d+)/g)].map(match => match[1] ?? match[2]);
  for (const value of found) if (value !== expectedBeta) throw new Error(`${name} contains stale product beta ${value}; expected ${expectedBeta}`);
}
