import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const renderer = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

test('Studio Window renderer is a bounded versioned browser module', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-window-renderer.js'], { stdio: 'pipe' });
  assert.match(renderer, /PATCH_STUDIO_WINDOW_RENDERER_VERSION = '0\.1'/);
  assert.match(renderer, /export function createStudioWindowRenderer\(\{ dispatch \} = \{\}\)/);
  assert.match(renderer, /Studio Window renderer requires a dispatch callback/);
  assert.match(renderer, /renderInitial\(container, windows\)/);
  assert.match(renderer, /renderAfterEvent\(container, windows\)/);
  assert.match(renderer, /renderDesigner\(container, windows, options = \{\}\)/);
});

test('playground is orchestration-only for Window rendering', () => {
  assert.match(playground, /from '\.\/studio-window-renderer\.js'/);
  assert.match(playground, /createStudioWindowRenderer\(\{ dispatch: trigger \}\)/);
  assert.match(playground, /studioWindowRenderer\.renderInitial\(appView, ui\)/);
  assert.match(playground, /studioWindowRenderer\.renderAfterEvent\(appView, ui\)/);
  assert.match(playground, /studioWindowRenderer\.renderDesigner\(designerCanvas, preview\.ui, \{ materialization \}\)/);
  assert.doesNotMatch(playground, /function createWindowShell\(/);
  assert.doesNotMatch(playground, /function renderWindows\(/);
  assert.doesNotMatch(playground, /function reconcileRuntimeWindows\(/);
  assert.doesNotMatch(playground, /function createControlElement\(/);
  assert.doesNotMatch(playground, /function createTreeElement\(/);
  assert.doesNotMatch(playground, /function createTabsElement\(/);
});

test('renderer owns DOM policy while semantic events stay injected', () => {
  assert.match(renderer, /function createWindowShell\(/);
  assert.match(renderer, /function renderWindows\(/);
  assert.match(renderer, /function reconcileRuntimeWindows\(/);
  assert.match(renderer, /function createControlElement\(/);
  assert.match(renderer, /function createTreeElement\(/);
  assert.match(renderer, /function createTabsElement\(/);
  assert.match(renderer, /context\.dispatch\(/);
  assert.doesNotMatch(renderer, /studioRunController/);
  assert.doesNotMatch(renderer, /PatchInterpreter/);
  assert.doesNotMatch(renderer, /triggerWindowEvent/);
});

test('Window renderer ships in hosted and Offline Studio closure', () => {
  assert.match(buildSite, /'studio-window-renderer\.js'/);
  assert.match(serviceWorker, /'\.\/studio-window-renderer\.js'/);
});