import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildStandaloneWebApp } from '../src/webapp.js';

const source = `create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value`;

test('Standalone Window Web App wires input changed with transient event value', () => {
  const built = buildStandaloneWebApp(source, { name: 'InputHello', kind: 'window' });
  assert.equal(built.metadata.projectKind, 'window');
  assert.match(built.html, /changed/);
  assert.match(built.html, /addEventListener\(['"]input['"]/);
  assert.match(built.html, /value/);
});

test('Patch Studio Window preview uses the shared semantic Window event adapter', () => {
  const playground = fs.readFileSync(new URL('../web/playground.js', import.meta.url), 'utf8');
  const runController = fs.readFileSync(new URL('../web/studio-run-controller.js', import.meta.url), 'utf8');
  const renderer = fs.readFileSync(new URL('../web/studio-window-renderer.js', import.meta.url), 'utf8');
  assert.match(runController, /window-events\.js/);
  assert.match(runController, /triggerWindowEvent/);
  assert.match(playground, /createStudioWindowRenderer\(\{ dispatch: trigger \}\)/);
  assert.match(playground, /studioRunController\.trigger/);
  assert.match(renderer, /['"]changed['"]/);
  assert.match(renderer, /addEventListener\(['"]input['"]/);
  assert.match(renderer, /context\.dispatch\(control\.id, 'changed', \{ value: el\.value \}\)/);
});

test('desktop Window player uses the shared semantic Window event adapter', () => {
  const builder = fs.readFileSync(new URL('../scripts/build-native-window.js', import.meta.url), 'utf8');
  assert.match(builder, /window-events\.js/);
  assert.match(builder, /triggerWindowEvent/);
  assert.match(builder, /['"]changed['"]/);
  assert.match(builder, /addEventListener\(['"]input['"]/);
});