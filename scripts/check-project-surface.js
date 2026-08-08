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
  readme: read('README.md'),
  website: read('web/index.html'),
  studio: read('docs/PATCH_STUDIO.md'),
  native: read('docs/NATIVE_APPS.md'),
  roadmap: read('docs/ROADMAP.md'),
  serviceWorker: read('web/sw.js')
};

mustInclude('README.md', files.readme, [
  `Current development beta: \`${version}\``,
  'https://pinkysworld.github.io/Patch/',
  'Windows Console',
  'Windows Window/GUI',
  'macOS Console',
  'macOS Window/GUI',
  'Linux Console',
  'Linux Window/GUI',
  'not yet a standalone WASI command module',
  'not yet native AppKit/Win32/GTK widget code generation',
  'docs/ROADMAP.md'
]);

mustInclude('web/index.html', files.website, [
  `<h1>Patch Studio <span>${studioVersion}</span></h1>`,
  `Beta ${version}`,
  'Windows App (.exe)',
  'macOS App (.app)',
  'Linux App',
  'Project Type',
  'not yet a standalone WASI command',
  'does <strong>not</strong> claim native AppKit, Win32 or GTK widget lowering yet',
  'State-Change Factorization',
  'Roadmap'
]);

mustInclude('docs/PATCH_STUDIO.md', files.studio, [
  `What works in 0.2 beta.${beta}`,
  'Windows, macOS and Linux builds initiated directly from the Studio',
  'both Console and Window / GUI desktop package paths'
]);

mustInclude('docs/NATIVE_APPS.md', files.native, [
  `Status: **${version}**`,
  'Console and Window projects',
  'Patch Native Apps',
  'not yet native-widget lowering'
]);

mustInclude('docs/ROADMAP.md', files.roadmap, [
  `Current development beta: **${version}**`,
  `### beta.${beta}: cross-platform builds from Patch Studio`,
  'Windows/macOS/Linux Console packages',
  'Windows/macOS/Linux standalone Window packages',
  'native AppKit Window backend'
]);

mustInclude('web/sw.js', files.serviceWorker, [cacheVersion]);

for (const stale of ['0.2.0-beta.16', '0.2 beta.16', 'patch-studio-0.2-beta.16']) {
  for (const [name, content] of Object.entries({
    'README.md': files.readme,
    'web/index.html': files.website,
    'docs/PATCH_STUDIO.md': files.studio,
    'docs/NATIVE_APPS.md': files.native,
    'web/sw.js': files.serviceWorker
  })) {
    if (content.includes(stale)) throw new Error(`${name} contains stale project-surface version ${stale}`);
  }
}

console.log(`ok project surface is consistent at ${version}`);

function mustInclude(name, content, phrases) {
  for (const phrase of phrases) {
    if (!content.includes(phrase)) throw new Error(`${name} is missing required current-project text: ${phrase}`);
  }
}
