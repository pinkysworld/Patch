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
  assert.match(tutorials, /The current native Ready line is Native GUI IR 1\.9 \/ payload v19 \/ runtime v1\.10/);
  assert.match(tutorials, /Stage 2 R0\.2 host-native Window Build inside the IDE is available for Windows x64, macOS Apple Silicon and Linux x64/);
  assert.match(tutorials, /seven-Form/);
  assert.doesNotMatch(tutorials, /The current native Ready line is Native GUI IR 1\.7/);
  assert.doesNotMatch(tutorials, /Host-native Build inside the IDE is still the Stage 2 gap/);
  assert.doesNotMatch(tutorials, /six-Form/);
  assert.match(examples, /Starter examples/);
  assert.match(examples, /GUI component examples/);
  assert.match(examples, /Formal-assurance examples/);
  assert.match(examples, /Showcases: exhaustive Studio, working app and native boundary/);
  assert.match(examples, /Patch Studio Showcase/);
  assert.match(examples, /Workshop Desk/);
  assert.match(examples, /Calendar Window/);
  assert.match(examples, /# @slider-mode progress/);
});

test('handbook is part of the generated and offline site closure', () => {
  for (const name of ['tutorials.html', 'examples.html']) {
    assert.ok(buildSite.includes(`'${name}'`), `site build must include ${name}`);
    assert.ok(serviceWorker.includes(`'./${name}'`), `offline cache must include ${name}`);
  }
  assert.ok(buildSite.includes("'docs-handbook.css'"));
  assert.ok(serviceWorker.includes("'./docs-handbook.css'"));
  assert.match(handbookCss, /\.handbook-tabs/);
  assert.doesNotMatch(handbookCss, /#1b1e24|--panel/);
  assert.match(handbookCss, /\.learning-step[\s\S]*background:\s*var\(--surface-subtle\)/);
  assert.doesNotMatch(fs.readFileSync('web/docs.html', 'utf8'), /#1b1e24|--panel/);
  assert.match(handbookCss, /\.example-matrix/);
});

test('public handbook points to tested beginner and showcase programs', () => {
  for (const name of ['hello-world.patch', 'hello-window.patch', 'counter-window.patch', 'checkbox-window.patch', 'combo-window.patch', 'calendar-window.patch', 'workshop-desk.patch', 'patch-studio-showcase.patchproject', 'change-capabilities.patch']) {
    assert.ok(tutorials.includes(name) || examples.includes(name), `${name} should be discoverable from the handbook`);
  }
});

test('MIT copyright holder is Michel Nguyen', () => {
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Michel Nguyen/);
  assert.doesNotMatch(license, /Minh Nguyen/);
});
