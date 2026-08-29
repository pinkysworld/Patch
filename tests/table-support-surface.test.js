import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const readme = read('README.md');
const packageJson = JSON.parse(read('package.json'));
const help = read('web/help.html');
const downloads = read('web/downloads.html');
const language = read('web/language.html');
const studio = read('docs/PATCH_STUDIO.md');
const nativeGui = read('docs/NATIVE_GUI.md');
const nativeApps = read('docs/NATIVE_APPS.md');
const offline = read('docs/OFFLINE_COMPILER.md');
const targets = read('docs/TARGETS.md');
const roadmap = read('docs/ROADMAP.md');
const offlineWorkflow = read('.github/workflows/offline-compiler.yml');
const playground = read('web/playground.js');
const studioTable = read('web/table-stage1.js');

test('current release surfaces expose one development version', () => {
  const version = packageJson.version;
  for (const text of [readme, downloads, offline]) {
    assert.match(text, new RegExp(version.replaceAll('.', '\\.')));
  }
});

test('public Table surfaces agree on transient selected-row list semantics', () => {
  assert.match(readme, /Table exposes the selected row as a transient text-list/i);
  assert.match(help, /Table[^\n]*selected row[^\n]*transient (?:text-)?list/i);
  assert.match(language, /selected row as a list of display strings/i);
  assert.match(studio, /Table: text-list for the selected row/i);
  assert.match(nativeGui, /Table[^\n]*text-list containing the selected row/i);
  assert.match(nativeApps, /Table `changed` exposes the selected row as transient list-valued `value`|Table .*transient row list/i);
});

test('direct native Table support preserves the frozen IR 0.8 backend 0.9 compatibility evidence', () => {
  for (const text of [nativeGui, nativeApps, targets, roadmap]) {
    assert.match(text, /Native GUI IR \*\*?0\.8\*\*?|Native GUI IR 0\.8/);
  }
  assert.match(roadmap, /Native GUI IR 0\.8 \/ payload v9 \/ runtime v1\.0 Table line/i);
  assert.match(nativeApps, /WC_LISTVIEWW/);
  assert.match(nativeApps, /NSTableView/);
  assert.match(nativeApps, /GtkTreeView/);
});

test('authoritative compatibility docs preserve the frozen payload v9 runtime v1.0 Table line', () => {
  for (const text of [nativeGui, offline, roadmap]) {
    assert.match(text, /payload \*\*?v9\*\*?|payload v9/i);
    assert.match(text, /runtime \*\*?v1\.0\*\*?|runtime v1\.0/i);
  }
  assert.match(roadmap, /Native GUI IR 0\.8 \/ payload v9 \/ runtime v1\.0 Table line/i);
  assert.match(nativeGui, /sealed payload v9 \/ runtime v1\.0[^\n]*frozen Table compatibility/i);
  assert.match(offline, /payload \*\*v9\*\* \/ runtime \*\*v1\.0\*\*[^\n]*frozen Table/i);
});

test('retired v07-v11 Table and list sealed workflows are no longer active', () => {
  assert.equal(fs.existsSync(new URL('../.github/workflows/native-table-v09.yml', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../.github/workflows/native-sealed-table-runtime.yml', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../.github/workflows/native-sealed-list-runtime.yml', import.meta.url)), false);
});

test('downloadable offline compiler embeds runtime v1.9 and proves payload v18 current Window linking', () => {
  assert.match(offlineWorkflow, /windows-latest/);
  assert.match(offlineWorkflow, /ubuntu-latest/);
  assert.match(offlineWorkflow, /macos-15/);
  assert.match(offlineWorkflow, /macos-15-intel/);
  assert.match(offlineWorkflow, /win32-sealed-gui-v19\.cpp/);
  assert.match(offlineWorkflow, /appkit-sealed-gui-v19\.mm/);
  assert.match(offlineWorkflow, /gtk-sealed-gui-v19\.cpp/);
  assert.match(offlineWorkflow, /link examples\/table-native-v09\.patch/);
  assert.match(offlineWorkflow, /link examples\/listbox-multiselect-native\.patch/);
  assert.match(offlineWorkflow, /link examples\/menu-state-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/treeview-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/slider-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/chrome-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/shape-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/paintbox-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/paintbox-image-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/workshop-desk\.patch/);
  assert.match(offlineWorkflow, /OfflineTable/);
  assert.match(offlineWorkflow, /OfflineMulti/);
  assert.match(offlineWorkflow, /OfflineMenu/);
  assert.match(offlineWorkflow, /OfflineTree/);
  assert.match(offlineWorkflow, /OfflineSlider/);
  assert.match(offlineWorkflow, /OfflineChrome/);
  assert.match(offlineWorkflow, /OfflineShape/);
  assert.match(offlineWorkflow, /OfflineWorkshop/);
  assert.match(offlineWorkflow, /payload v18/i);
  assert.match(offlineWorkflow, /runtime v1\.9/i);
  assert.match(offlineWorkflow, /not sealed payload v18|payload v18/i);
});

test('Studio App preview Table dispatch uses the shared semantic event adapter', () => {
  assert.match(help, /Table[^\n]*selected row[^\n]*transient list-valued/i);
  assert.match(studio, /Table: text-list for the selected row/);
  assert.match(nativeApps, /Studio App Preview.*transient row list|Standalone Web and Studio App Preview.*transient/i);
  assert.match(targets, /Patch Studio App Preview exposes the same transient selected-row list through the shared semantic Window event adapter/);
  assert.match(playground, /appView\.addEventListener\('patch-studio-table-changed'/);
  assert.match(playground, /trigger\(detail\.control, 'changed', \{ value: \[\.\.\.detail\.value\] \}\)/);
  assert.match(studioTable, /new CustomEvent\('patch-studio-table-changed'/);
  assert.match(studioTable, /detail: \{ control: node\.id, value: \[\.\.\.row\] \}/);
});
