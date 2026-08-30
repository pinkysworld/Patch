import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const table = fs.readFileSync('web/table-stage1.js', 'utf8');
const selectionState = fs.readFileSync('web/studio-runtime-selection-state.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

test('Table and TreeView share the bounded keyed runtime selection contract', () => {
  assert.match(selectionState, /PATCH_STUDIO_RUNTIME_SELECTION_STATE_VERSION = '0\.1'/);
  assert.match(selectionState, /PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES = 512/);
  assert.match(playground, /from '\.\/studio-runtime-selection-state\.js'/);
  assert.match(playground, /getRuntimeSelection\(context\.container, 'tree', key\)/);
  assert.match(playground, /setRuntimeSelection\(context\.container, 'tree', key, selectedPath\)/);
  assert.match(playground, /patchRuntimeSelectionKind = 'tree'/);
  assert.match(table, /from '\.\/studio-runtime-selection-state\.js'/);
  assert.match(table, /getRuntimeSelection\(options\.container, 'table', options\.key\)/);
  assert.match(table, /setRuntimeSelection\(options\.container, 'table', options\.key, rowIndex\)/);
  assert.match(table, /patchControlKey = key/);
  assert.match(table, /patchRuntimeSelectionKind = 'table'/);
  assert.doesNotMatch(table, /const appSelections = new Map\(\)/);
});

test('shared runtime selection state ships in hosted and Offline Studio closure', () => {
  assert.match(buildSite, /'studio-runtime-selection-state\.js'/);
  assert.match(serviceWorker, /'\.\/studio-runtime-selection-state\.js'/);
});
