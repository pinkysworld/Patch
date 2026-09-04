import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  PATCH_STUDIO_BUILD_CONTROLLER_VERSION,
  buildStudioArtifact
} from '../web/studio-build-controller.js';

const consoleSource = `create number score = 1
show score`;
const windowSource = `create number count = 0

window "Counter" as main:
  text "Count {count}"
  button "Add" as add_button

when add_button clicked:
  change count:
    add 1`;

const consoleOptions = Object.freeze({
  name: 'BuildProbe',
  kind: 'console',
  entry: 'main.patch',
  resources: []
});

const windowOptions = Object.freeze({
  name: 'WindowProbe',
  kind: 'window',
  entry: 'main.patch',
  resources: []
});

test('Studio build controller exposes a bounded versioned artifact surface', () => {
  assert.equal(PATCH_STUDIO_BUILD_CONTROLLER_VERSION, '0.1');
  execFileSync(process.execPath, ['--check', 'web/studio-build-controller.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/playground.js'], { stdio: 'pipe' });
});

test('Studio build controller preserves standalone Console Web App output', () => {
  const built = buildStudioArtifact('web', consoleSource, consoleOptions);
  assert.equal(built.filename, 'BuildProbe.html');
  assert.equal(built.type, 'text/html');
  assert.equal(typeof built.data, 'string');
  assert.match(built.data, /<!doctype html>/i);
  assert.match(built.data, /<title>BuildProbe<\/title>/);
  assert.match(built.data, /<script\b/);
  assert.match(built.output, /Built BuildProbe\.html/);
  assert.match(built.output, /Standalone single-file Patch Console Web App/);
  assert.ok(built.ir);
});

test('Studio build controller preserves standalone Window Web App output', () => {
  const built = buildStudioArtifact('web', windowSource, windowOptions);
  assert.equal(built.filename, 'WindowProbe.html');
  assert.equal(built.type, 'text/html');
  assert.match(built.data, /<!doctype html>/i);
  assert.match(built.data, /<title>WindowProbe<\/title>/);
  assert.match(built.data, /<script\b/);
  assert.match(built.output, /Standalone single-file Patch Window Web App/);
  assert.match(built.output, /generated browser Window runtime/);
  assert.ok(built.ir);
});

test('Studio build controller preserves Direct Wasm and fails closed for Window projects', () => {
  const built = buildStudioArtifact('wasm-direct', consoleSource, consoleOptions);
  assert.equal(built.filename, 'BuildProbe.direct.wasm');
  assert.equal(built.type, 'application/wasm');
  assert.ok(built.data instanceof Uint8Array);
  assert.match(built.output, /directly lowered Patch Console instructions/);
  assert.throws(
    () => buildStudioArtifact('wasm-direct', windowSource, windowOptions),
    /Direct WebAssembly currently supports Console projects only/
  );
});

test('Studio build controller preserves Bootstrap Wasm output', () => {
  const built = buildStudioArtifact('wasm-bootstrap', consoleSource, consoleOptions);
  assert.equal(built.filename, 'BuildProbe.bootstrap.wasm');
  assert.equal(built.type, 'application/wasm');
  assert.ok(built.data instanceof Uint8Array);
  assert.match(built.output, /Advanced compatibility artifact/);
  assert.ok(built.ir);
});

test('Studio build controller preserves portable patchapp output', () => {
  const built = buildStudioArtifact('portable', consoleSource, consoleOptions);
  assert.equal(built.filename, 'BuildProbe.patchapp');
  assert.equal(built.type, 'application/json');
  assert.equal(typeof built.data, 'string');
  assert.doesNotThrow(() => JSON.parse(built.data));
  assert.match(built.output, /Portable Patch bundle/);
  assert.ok(built.ir);
});

test('playground delegates generic Build ownership without changing native listener order', () => {
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  const controller = fs.readFileSync('web/studio-build-controller.js', 'utf8');
  const html = fs.readFileSync('web/index.html', 'utf8');

  assert.match(playground, /import \{ installStudioBuildController \} from '\.\/studio-build-controller\.js'/);
  assert.match(playground, /installStudioBuildController\(\{/);
  assert.doesNotMatch(playground, /buildPatchApp|serializePatchApp|compileToWasm|compileToDirectWasm|buildStandaloneWebApp/);
  assert.doesNotMatch(playground, /querySelector\('#build'\)\.addEventListener/);
  assert.doesNotMatch(playground, /function download\(/);
  assert.match(controller, /buildStudioArtifact\(buildTarget\.value, code\.value, projectOptions\(\)\)/);

  const nativeIndex = html.indexOf('./native-build.js');
  const playgroundIndex = html.indexOf('./playground.js');
  assert.ok(nativeIndex >= 0 && playgroundIndex > nativeIndex, 'native-build.js must initialize before playground installs the generic Build controller');
});

test('extracted Build controller ships in hosted and Offline Studio closure', () => {
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const worker = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(buildSite, /'studio-build-controller\.js'/);
  assert.match(worker, /'\.\/studio-build-controller\.js'/);
});
