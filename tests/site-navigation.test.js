import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const beta = /^0\.2\.0-beta\.(\d+)$/.exec(pkg.version)?.[1];
if (!beta) throw new Error(`Unexpected Patch version ${pkg.version}`);
const pages = new Map([
  ['Studio', fs.readFileSync('web/index.html', 'utf8')],
  ['Language', fs.readFileSync('web/language.html', 'utf8')],
  ['Documentation', fs.readFileSync('web/docs.html', 'utf8')],
  ['Downloads', fs.readFileSync('web/downloads.html', 'utf8')],
  ['Help', fs.readFileSync('web/help.html', 'utf8')]
]);
const navigationCss = fs.readFileSync('web/site-navigation.css', 'utf8');
const pageCss = fs.readFileSync('web/site-pages.css', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');

test('public Patch Studio keeps five primary product pages and packages handbook subpages', () => {
  const markers = [
    'href="./index.html"',
    'href="./language.html"',
    'href="./docs.html"',
    'href="./downloads.html"',
    'href="./help.html"'
  ];
  for (const [name, html] of pages) {
    assert.match(html, /class="site-tabs"/);
    for (const marker of markers) assert.ok(html.includes(marker), `${name}: ${marker}`);
  }
  assert.match(buildSite, /const SITE_HTML_FILES = \['index\.html','language\.html','docs\.html','tutorials\.html','examples\.html','help\.html'\]/);
  assert.match(buildSite, /href="\\\.\\\/paper\\\.html"/);
  assert.match(buildSite, /validatePaperPrivacyBoundary/);
  assert.equal(fs.existsSync('web/paper.html'), false);
});

test('Studio stays focused on the IDE instead of duplicating the language landing page', () => {
  const studio = pages.get('Studio');
  assert.ok(studio.includes(`Patch Studio <span>0.2 beta.${beta}`));
  assert.doesNotMatch(studio, /Small syntax\. Visible changes\./);
  assert.doesNotMatch(studio, /class="site-info"/);
});

test('language documentation downloads and help content live on dedicated pages', () => {
  assert.match(pages.get('Language'), /Small syntax\. Visible changes\./);
  assert.match(pages.get('Documentation'), /Patch documentation/);
  assert.match(pages.get('Downloads'), /Patch Studio Offline IDE \+ compiler/);
  assert.match(pages.get('Downloads'), /offline-studio-v0\.2/);
  assert.match(pages.get('Downloads'), /PatchStudio-windows-x64\.exe/);
  assert.match(pages.get('Downloads'), /patch-windows-x64\.exe/);
  assert.match(pages.get('Downloads'), /patch-freebsd-x64\.tar\.gz/);
  assert.match(pages.get('Help'), /Design a Window app/);
  assert.match(pages.get('Help'), /Designer scrollbars/);
});

test('site navigation and content pages are responsive and keyboard visible', () => {
  assert.match(navigationCss, /overflow-x: auto/);
  assert.match(navigationCss, /focus-visible/);
  assert.match(pageCss, /@media \(max-width: \d+px\)[\s\S]*?\.page-hero \{ grid-template-columns: 1fr;[^}]*\}/);
  assert.match(pageCss, /@media \(max-width: \d+px\)[\s\S]*?\.doc-links \{ grid-template-columns: 1fr;[^}]*\}/);
  assert.match(pageCss, /\.content-page \{[\s\S]*?width: calc\(100% - 20px\);/);
  assert.match(pageCss, /grid-template-columns: 1fr/);
});

test('site builder and validators remain syntactically valid', () => {
  execFileSync(process.execPath, ['--check', 'scripts/build-site.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/check-site.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/check-site-v10.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/check-site-v12.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/check-site-beta35.js'], { stdio: 'pipe' });
});
