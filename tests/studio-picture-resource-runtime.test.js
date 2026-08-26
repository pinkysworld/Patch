import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PatchInterpreter } from '../src/interpreter.js';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const webapp = fs.readFileSync('src/webapp.js', 'utf8');

const SOURCE = `window "Photos" as main size 420, 260:\n  picture as logo from "patch-resource:app.logo" at 24, 24 size 180, 120\n`;

test('Interpreter carries Picture source into the shared Studio UI model', () => {
  const result = new PatchInterpreter().run(SOURCE);
  assert.equal(result.ui.length, 1);
  assert.equal(result.ui[0].controls.length, 1);
  assert.equal(result.ui[0].controls[0].type, 'picture');
  assert.equal(result.ui[0].controls[0].source, 'patch-resource:app.logo');
});

test('Studio Run and Designer use the same Picture resource resolver as standalone Web', () => {
  execFileSync(process.execPath, ['--check', 'web/playground.js'], { stdio: 'pipe' });
  assert.match(playground, /buildStandaloneWebApp, pictureResourceDataUri/);
  assert.match(playground, /getStudioProjectResources/);
  assert.match(playground, /control\.type === 'picture'/);
  assert.match(playground, /pictureResourceDataUri\(control\.source, getStudioProjectResources\(\)\)/);
  assert.match(playground, /el\.className = 'patch-picture'/);
  assert.match(playground, /el\.addEventListener\('click', activate\)/);
  assert.match(playground, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('Studio Web Build passes canonical v4 resources through projectOptions', () => {
  assert.match(playground, /resources: getStudioProjectResources\(\)/);
  assert.match(playground, /buildStandaloneWebApp\(code\.value, projectOptions\(\)\)/);
  assert.match(webapp, /addStandaloneWindowPictures/);
  assert.match(webapp, /validateStudioResources\(resources\)/);
  assert.match(webapp, /PATCH_IMAGE_RESOURCES/);
});
