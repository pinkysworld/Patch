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
const directWorkflow = read('.github/workflows/native-table-v09.yml');
const sealedWorkflow = read('.github/workflows/native-sealed-table-runtime.yml');
const sealedListWorkflow = read('.github/workflows/native-sealed-list-runtime.yml');
const offlineWorkflow = read('.github/workflows/offline-compiler.yml');
const playground = read('web/playground.js');
const studioTable = read('web/table-stage1.js');

test('repository and product surfaces expose one development version', () => {
  const version = packageJson.version;
  assert.match(readme, new RegExp(version.replaceAll('.', '\\.')));
  assert.match(studio, new RegExp(version.replaceAll('.', '\\.')));
  assert.match(roadmap, new RegExp(version.replaceAll('.', '\\.')));
});

test('public Table surfaces agree on transient selected-row list semantics', () => {
  assert.match(readme, /Table[^\n]*selected row[^\n]*transient list-valued `value`/i);
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
  assert.match(roadmap, /direct AOT backend \*\*1\.2\*\* implements native multi-select|direct AOT backend/i);
  assert.match(nativeApps, /WC_LISTVIEWW/);
  assert.match(nativeApps, /NSTableView/);
  assert.match(nativeApps, /GtkTreeView/);
  assert.match(directWorkflow, /windows-latest/);
  assert.match(directWorkflow, /macos-15/);
  assert.match(directWorkflow, /ubuntu-latest/);
  assert.match(directWorkflow, /--table-v09 --smoke/);
});

test('authoritative compatibility docs preserve the frozen payload v9 runtime v1.0 Table line', () => {
  for (const text of [nativeGui, offline, roadmap]) {
    assert.match(text, /payload \*\*?v9\*\*?|payload v9/i);
    assert.match(text, /runtime \*\*?v1\.0\*\*?|runtime v1\.0/i);
  }
  assert.match(roadmap, /frozen sealed native GUI payload \*\*v9\*\* \/ runtime \*\*v1\.0\*\* Table compatibility line/i);
  assert.match(nativeGui, /sealed payload v9 \/ runtime v1\.0[^\n]*frozen Table compatibility/i);
  assert.match(offline, /payload \*\*v9\*\* \/ runtime \*\*v1\.0\*\*[^\n]*frozen Table/i);
});

test('sealed Table v1.0 remains a frozen Windows macOS Linux v9 compatibility gate', () => {
  assert.match(sealedWorkflow, /contract:/);
  assert.match(sealedWorkflow, /Test baseline sealed payload contract/);
  assert.match(sealedWorkflow, /Test responsive sealed payload contract/);
  assert.match(sealedWorkflow, /Test Table payload v9 contract/);
  assert.doesNotMatch(sealedWorkflow, /src\/cli-entry\.js link examples\/table-native-v09\.patch/);
  assert.match(sealedWorkflow, /windows-latest/);
  assert.match(sealedWorkflow, /macos-latest/);
  assert.match(sealedWorkflow, /ubuntu-latest/);
  assert.match(sealedWorkflow, /PATCH_SEALED_GUI_VERSION: 9/);
  assert.match(sealedWorkflow, /examples\/table-native-v09\.patch/);
  assert.match(sealedWorkflow, /--patch-smoke/);
  assert.match(sealedWorkflow, /native-win32-runtime-v1\.0/);
  assert.match(sealedWorkflow, /native-macos-runtime-v1\.0/);
  assert.match(sealedWorkflow, /native-linux-runtime-v1\.0/);
  assert.match(sealedWorkflow, /Frozen .* compatibility runtime/i);
});

test('sealed runtime v1.1 remains the frozen payload v10 list compatibility line on all desktop hosts', () => {
  assert.match(sealedListWorkflow, /PATCH_SEALED_GUI_VERSION: 10/);
  assert.match(sealedListWorkflow, /Test payload v10 list contract/);
  assert.match(sealedListWorkflow, /Test baseline sealed compatibility/);
  assert.match(sealedListWorkflow, /Test offline-link contract/);
  assert.match(sealedListWorkflow, /windows-latest/);
  assert.match(sealedListWorkflow, /macos-latest/);
  assert.match(sealedListWorkflow, /ubuntu-latest/);
  assert.match(sealedListWorkflow, /Seal and smoke Table compatibility/);
  assert.match(sealedListWorkflow, /Offline-link multi-select and smoke/);
  assert.match(sealedListWorkflow, /src\/cli-entry\.js link examples\/listbox-multiselect-native\.patch/);
  assert.match(sealedListWorkflow, /native-win32-runtime-v1\.1/);
  assert.match(sealedListWorkflow, /native-macos-runtime-v1\.1/);
  assert.match(sealedListWorkflow, /native-linux-runtime-v1\.1/);
});

test('downloadable offline compiler embeds runtime v1.4 and proves payload v13 Table ListBox Menu Tree and Slider linking', () => {
  assert.match(offlineWorkflow, /windows-latest/);
  assert.match(offlineWorkflow, /ubuntu-latest/);
  assert.match(offlineWorkflow, /macos-15/);
  assert.match(offlineWorkflow, /macos-15-intel/);
  assert.match(offlineWorkflow, /win32-sealed-gui-v14\.cpp/);
  assert.match(offlineWorkflow, /appkit-sealed-gui-v14\.mm/);
  assert.match(offlineWorkflow, /gtk-sealed-gui-v14\.cpp/);
  assert.match(offlineWorkflow, /link examples\/table-native-v09\.patch/);
  assert.match(offlineWorkflow, /link examples\/listbox-multiselect-native\.patch/);
  assert.match(offlineWorkflow, /link examples\/menu-state-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/treeview-window\.patch/);
  assert.match(offlineWorkflow, /link examples\/slider-window\.patch/);
  assert.match(offlineWorkflow, /OfflineTable/);
  assert.match(offlineWorkflow, /OfflineMulti/);
  assert.match(offlineWorkflow, /OfflineMenu/);
  assert.match(offlineWorkflow, /OfflineTree/);
  assert.match(offlineWorkflow, /OfflineSlider/);
  assert.match(offlineWorkflow, /payload v13/i);
  assert.match(offlineWorkflow, /runtime v1\.4/i);
  assert.match(offlineWorkflow, /not sealed payload v13|payload v13/i);
});

test('Studio App preview Table dispatch uses the shared semantic event adapter', () => {
  assert.match(help, /Table[^\n]*selected row[^\n]*transient list-valued/i);
  assert.match(studio, /Table: text-list for the selected row/);
  assert.match(nativeApps, /Studio App Preview.*transient row list|Standalone Web and Studio App Preview.*transient/i);
  assert.match(targets, /Patch Studio App Preview exposes the same transient selected-row list through the shared semantic Window event adapter/);
  assert.match(roadmap, /\[x\] Studio App-preview dispatch parity for Table row selection through the shared semantic Window event adapter/);
  assert.match(playground, /appView\.addEventListener\('patch-studio-table-changed'/);
  assert.match(playground, /trigger\(detail\.control, 'changed', \{ value: \[\.\.\.detail\.value\] \}\)/);
  assert.match(studioTable, /new CustomEvent\('patch-studio-table-changed'/);
  assert.match(studioTable, /detail: \{ control: node\.id, value: \[\.\.\.row\] \}/);
});