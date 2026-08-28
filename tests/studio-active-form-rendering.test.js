import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const studio = fs.readFileSync('web/beta35-studio.js', 'utf8');

test('multi-Form Designer keeps source-backed shells but fully renders only the active Form', () => {
  execFileSync(process.execPath, ['--check', 'web/beta35-studio.js'], { stdio: 'pipe' });
  assert.match(studio, /queueMicrotask\(installActiveFormRendering\)/);
  assert.match(studio, /document\.querySelector\('#patchFormSelect'\)/);
  assert.match(studio, /canvas\.querySelectorAll\(':scope \.patch-window'\)/);
  assert.match(studio, /shell\.hidden = !isActive/);
  assert.match(studio, /patchDesignerFormDetail/);
  assert.match(studio, /isActive \? 'full' : 'deferred'/);
  assert.match(studio, /patchDesignerActiveForm/);
});

test('active-Form rendering follows canonical Form selection and source reconciliation', () => {
  assert.match(studio, /select\.addEventListener\('change', schedule\)/);
  assert.match(studio, /patch-designer-selection-change', schedule/);
  assert.match(studio, /code\?\.addEventListener\('input', schedule\)/);
  assert.match(studio, /code\?\.addEventListener\('change', schedule\)/);
  assert.match(studio, /new MutationObserver\(schedule\)\.observe\(canvas, \{ childList: true, subtree: true \}\)/);
});

test('active-Form optimization does not delete or clone Form DOM', () => {
  const implementation = studio.split('function syncActiveFormRendering')[1] ?? '';
  assert.doesNotMatch(implementation, /remove\(|replaceChildren|cloneNode|innerHTML/);
  assert.match(implementation, /shells\.forEach/);
});
