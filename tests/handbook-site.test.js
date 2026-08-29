import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tutorials = fs.readFileSync('web/tutorials.html', 'utf8');
const examples = fs.readFileSync('web/examples.html', 'utf8');
const handbookCss = fs.readFileSync('web/docs-handbook.css', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const license = fs.readFileSync('LICENSE', 'utf8');

test('Patch handbook exposes dedicated tutorial and example pages', () => {
  for (const html of [tutorials, examples]) {
    assert.match(html, /class="handbook-tabs"/);
    assert.match(html, /href="\.\/docs\.html"/);
    assert.match(html, /href="\.\/tutorials\.html"/);
    assert.match(html, /href="\.\/examples\.html"/);
    assert.match(html, /href="\.\/language\.html"/);
    assert.match(html, /href="\.\/downloads\.html"/);
  }
  assert.match(tutorials, /Your first Patch program/);
  assert.match(tutorials, /Build a Counter window/);
  assert.match(tutorials, /Use Patch Studio like a RAD IDE/);
  assert.match(tutorials, /Recipes and bounded Change Contracts/);
  assert.match(tutorials, /Check, run and build your software/);
  assert.match(examples, /Starter examples/);
  assert.match(examples, /GUI component examples/);
  assert.match(examples, /Formal-assurance examples/);
  assert.match(examples, /Showcase: Workshop Desk/);
});

test('handbook is part of the generated and offline site closure', () => {
  for (const name of ['tutorials.html', 'examples.html']) {
    assert.ok(buildSite.includes(`'${name}'`), `site build must include ${name}`);
    assert.ok(serviceWorker.includes(`'./${name}'`), `offline cache must include ${name}`);
  }
  assert.ok(buildSite.includes("'docs-handbook.css'"));
  assert.ok(serviceWorker.includes("'./docs-handbook.css'"));
  assert.match(handbookCss, /\.handbook-tabs/);
  assert.match(handbookCss, /\.example-matrix/);
});

test('public handbook points to tested beginner and showcase programs', () => {
  for (const name of ['hello-world.patch', 'hello-window.patch', 'counter-window.patch', 'checkbox-window.patch', 'combo-window.patch', 'workshop-desk.patch', 'change-capabilities.patch']) {
    assert.ok(tutorials.includes(name) || examples.includes(name), `${name} should be discoverable from the handbook`);
  }
});

test('MIT copyright holder is Michel Nguyen', () => {
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Michel Nguyen/);
  assert.doesNotMatch(license, /Minh Nguyen/);
});
