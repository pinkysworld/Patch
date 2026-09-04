import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PatchInterpreter } from '../src/interpreter.js';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
const buildController = fs.readFileSync('web/studio-build-controller.js', 'utf8');
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
  execFileSync(process.execPath, ['--check', 'web/studio-window-renderer.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/studio-build-controller.js'], { stdio: 'pipe' });
  assert.match(buildController, /import \{ buildStandaloneWebApp \} from '\.\.\/src\/webapp\.js'/);
  assert.match(playground, /createStudioWindowRenderer/);
  assert.match(renderer, /pictureResourceDataUri/);
  assert.match(renderer, /getStudioProjectResources/);
  assert.match(renderer, /control\.type === 'picture'/);
  assert.match(renderer, /pictureResourceDataUri\(control\.source, getStudioProjectResources\(\)\)/);
  assert.match(renderer, /el\.className = 'patch-picture'/);
  assert.match(renderer, /el\.addEventListener\('click', activate\)/);
  assert.match(renderer, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('Studio Web Build passes canonical v4 resources through projectOptions', () => {
  assert.match(playground, /resources: getStudioProjectResources\(\)/);
  assert.match(playground, /installStudioBuildController\(\{/);
  assert.match(playground, /projectOptions,/);
  assert.match(buildController, /buildStudioArtifact\(buildTarget\.value, code\.value, projectOptions\(\)\)/);
  assert.match(buildController, /buildStandaloneWebApp\(source, options\)/);
  assert.match(webapp, /addStandaloneWindowPictures/);
  assert.match(webapp, /validateStudioResources\(resources\)/);
  assert.match(webapp, /PATCH_IMAGE_RESOURCES/);
});