import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync('web/docs.html', 'utf8');
const license = fs.readFileSync('LICENSE', 'utf8');
const helloWorld = fs.readFileSync('examples/hello-world.patch', 'utf8');
const helloWindow = fs.readFileSync('examples/hello-window.patch', 'utf8');

test('public Documentation is a beginner learning path rather than only an internal link index', () => {
  assert.match(docs, /Learn Patch by building software\./);
  assert.match(docs, /Your first Patch program/);
  assert.match(docs, /Tutorial 1: build a Counter application/);
  assert.match(docs, /Tutorial 2: conditions and repeat/);
  assert.match(docs, /Tutorial 3: Things, recipes and bounded authority/);
  assert.match(docs, /Tutorial 4: data controls and transient selection/);
  assert.match(docs, /Quick syntax reference/);
  assert.match(docs, /GUI applications and Patch Studio/);
  assert.match(docs, /Run, build and distribute/);
  assert.match(docs, /Example programs/);
});

test('learning page preserves current product and frozen native contracts', () => {
  assert.match(docs, /Change IR 0\.10/);
  assert.match(docs, /Native GUI IR 1\.7/);
  assert.match(docs, /payload v17/);
  assert.match(docs, /runtime v1\.8/);
  assert.match(docs, /two live native product contracts/);
  assert.match(docs, /IR 1\.2 \/ payload v12 \/ runtime v1\.3 frozen/);
  assert.match(docs, /beta\.32 assurance boundary/);
});

test('tutorial page points users to tested application examples', () => {
  for (const example of [
    'counter-window.patch',
    'conditions.patch',
    'change-capabilities.patch',
    'checkbox-window.patch',
    'combo-window.patch',
    'workshop-desk.patch'
  ]) assert.ok(docs.includes(`examples/${example}`), `missing tutorial link for ${example}`);
});

test('beginner examples stay intentionally tiny and source-readable', () => {
  assert.equal(helloWorld, 'create text message = "Hello, Patch!"\nshow message\n');
  assert.match(helloWindow, /^window "Hello Patch" size 420, 220:/);
  assert.match(helloWindow, /text "Hello, Patch!" at 24, 24 size 240, 32/);
});

test('public docs explain the repository MIT license without inventing a second license', () => {
  assert.match(license, /^MIT License/m);
  assert.match(docs, /Patch already uses the permissive MIT License/);
  assert.match(docs, /href="https:\/\/github\.com\/pinkysworld\/Patch\/blob\/main\/LICENSE"/);
});
