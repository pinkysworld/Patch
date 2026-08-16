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

test('public Table surfaces agree on transient row-list semantics', () => {
  assert.match(readme, /Table[^\n]*selected row[^\n]*transient list-valued `value`/i);
  assert.match(help, /selected row only as transient <code>value<\/code>/);
  assert.match(language, /<code>value<\/code> is the selected row as a list of display strings/);
  assert.match(studio, /Table `changed` exposes a transient row list|transient list-valued selected row/);
  assert.match(nativeApps, /Table `changed` exposes the selected row as transient list-valued `value`|Table .*transient row list/i);
});

test('direct native Table support stays tied to IR 0.8 backend 0.9 and real platform smokes', () => {
  for (const text of [readme, help, language, studio, nativeApps, targets, roadmap]) {
    assert.match(text, /Native GUI IR \*\*?0\.8\*\*?|Native GUI IR 0\.8/);
    assert.match(text, /backend \*\*?0\.9\*\*?|backend 0\.9/);
  }
  assert.match(nativeApps, /WC_LISTVIEWW/);
  assert.match(nativeApps, /NSTableView/);
  assert.match(nativeApps, /GtkTreeView/);
  assert.match(directWorkflow, /windows-latest/);
  assert.match(directWorkflow, /macos-15/);
  assert.match(directWorkflow, /ubuntu-latest/);
  assert.match(directWorkflow, /--table-v09 --smoke/);
});

test('published product docs preserve the frozen payload v9 runtime v1.0 Table compatibility line after v1.1 deployment', () => {
  for (const text of [readme, help, downloads, language, studio, nativeApps, offline, targets, roadmap]) {
    assert.match(text, /payload \*\*?v9\*\*?|payload v9/i);
    assert.match(text, /runtime \*\*?v1\.0\*\*?|runtime v1\.0/i);
  }
  assert.match(roadmap, /\[x\] sealed Ready\/offline Table payload \*\*v9\*\* \/ runtime \*\*v1\.0\*\* contract/);
  assert.match(nativeApps, /payload \*\*v8\*\* \/ runtime \*\*v0\.9\*\*[^\n]*(?:frozen|compatibility)/i);
  assert.match(offline, /payload \*\*v8\*\* \/ runtime \*\*v0\.9\*\*[^\n]*(?:older|frozen|compatibility)/i);
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

test('sealed runtime v1.1 carries current payload v10 Table and offline-link evidence on all desktop hosts', () => {
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

test('downloadable offline compiler embeds runtime v1.1 and proves payload v10 Table and multi-select linking', () => {
  assert.match(offlineWorkflow, /windows-latest/);
  assert.match(offlineWorkflow, /ubuntu-latest/);
  assert.match(offlineWorkflow, /macos-15/);
  assert.match(offlineWorkflow, /macos-15-intel/);
  assert.match(offlineWorkflow, /win32-sealed-gui-v11\.cpp/);
  assert.match(offlineWorkflow, /appkit-sealed-gui-v11\.mm/);
  assert.match(offlineWorkflow, /gtk-sealed-gui-v11\.cpp/);
  assert.match(offlineWorkflow, /link examples\/table-native-v09\.patch/);
  assert.match(offlineWorkflow, /link examples\/listbox-multiselect-native\.patch/);
  assert.match(offlineWorkflow, /OfflineTable/);
  assert.match(offlineWorkflow, /OfflineMulti/);
  assert.match(offlineWorkflow, /payload v10\/runtime v1\.1/);
});

test('Studio App preview Table event dispatch is implemented through the shared semantic adapter', () => {
  assert.match(help, /Studio App preview and Standalone Web support row selection/);
  assert.match(studio, /Standalone Web and Studio App Preview: transient list-valued selected row/);
  assert.match(nativeApps, /Studio App Preview.*transient row list|Standalone Web and Studio App Preview.*transient/i);
  assert.match(targets, /Patch Studio App Preview exposes the same transient selected-row list through the shared semantic Window event adapter/);
  assert.match(roadmap, /\[x\] Studio App-preview dispatch parity for Table row selection through the shared semantic Window event adapter/);
  assert.match(playground, /appView\.addEventListener\('patch-studio-table-changed'/);
  assert.match(playground, /trigger\(detail\.control, 'changed', \{ value: \[\.\.\.detail\.value\] \}\)/);
  assert.match(studioTable, /new CustomEvent\('patch-studio-table-changed'/);
  assert.match(studioTable, /detail: \{ control: node\.id, value: \[\.\.\.row\] \}/);
});
