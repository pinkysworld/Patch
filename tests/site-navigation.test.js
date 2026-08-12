import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const pages = new Map([
  ['Studio', fs.readFileSync('web/index.html', 'utf8')],
  ['Language', fs.readFileSync('web/language.html', 'utf8')],
  ['Documentation', fs.readFileSync('web/docs.html', 'utf8')],
  ['Help', fs.readFileSync('web/help.html', 'utf8')]
]);
const navCss = fs.readFileSync('web/site-navigation.css', 'utf8');
const pageCss = fs.readFileSync('web/site-pages.css', 'utf8');

test('every public page exposes the same four top-level navigation tabs', () => {
  for (const [label, html] of pages) {
    for (const marker of ['./index.html','./language.html','./docs.html','./help.html']) assert.ok(html.includes(marker), `${label}: ${marker}`);
    assert.match(html, /class="site-tabs"/);
    assert.match(html, new RegExp(`aria-current="page">${label}<\\/a>`));
  }
});

test('Studio stays focused on the IDE instead of duplicating the language landing page', () => {
  const studio = pages.get('Studio');
  assert.doesNotMatch(studio, /class="site-info"/);
  assert.doesNotMatch(studio, /Small syntax\. Visible changes\. One Studio\./);
  assert.doesNotMatch(studio, /Beta\.32 invocation-frame direct-Wasm correspondence<\/strong>/);
  assert.match(studio, /Patch Studio <span>0\.2 beta\.33<\/span>/);
});

test('language documentation and help content live on dedicated pages', () => {
  assert.match(pages.get('Language'), /Small syntax\. Visible changes\./);
  assert.match(pages.get('Language'), /Change Contracts/);
  assert.match(pages.get('Documentation'), /Patch documentation/);
  assert.match(pages.get('Documentation'), /docs\/FORMAL_MODEL\.md/);
  assert.match(pages.get('Help'), /Design a Window app/);
  assert.match(pages.get('Help'), /lower-right corner/);
});

test('site navigation and content pages are responsive and keyboard visible', () => {
  for (const marker of ['.site-tabs','overflow-x: auto','a[aria-current="page"]',':focus-visible']) assert.ok(navCss.includes(marker), marker);
  for (const marker of ['.content-page','.page-hero','.doc-links','.help-step','@media (max-width: 600px)']) assert.ok(pageCss.includes(marker), marker);
});

test('site builder and validator remain syntactically valid', () => {
  execFileSync(process.execPath, ['--check', 'scripts/build-site.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'scripts/check-site.js'], { stdio: 'pipe' });
});
