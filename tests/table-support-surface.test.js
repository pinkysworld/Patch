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
  assert.match(studio, /Table `changed` exposes a transient row list/);
  assert.match(nativeApps, /Table `changed` exposes the selected row as transient list-valued `value`/);
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

test('Ready and offline surfaces consistently claim only explicit payload v9 runtime v1.0 Table support', () => {
  for (const text of [readme, help, downloads, language, studio, nativeApps, offline, targets, roadmap]) {
    assert.match(text, /payload \*\*?v9\*\*?|payload v9/i);
    assert.match(text, /runtime \*\*?v1\.0\*\*?|runtime v1\.0/i);
  }
  assert.match(roadmap, /\[x\] sealed Ready\/offline Table payload \*\*v9\*\* \/ runtime \*\*v1\.0\*\* contract/);
  assert.match(nativeApps, /payload \*\*v8\*\* \/ runtime \*\*v0\.9\*\*[^\n]*(?:frozen|compatibility)/i);
  assert.match(offline, /payload \*\*v8\*\* \/ runtime \*\*v0\.9\*\*[^\n]*(?:older|frozen|compatibility)/i);
  assert.doesNotMatch(help, /Table is not yet claimed on those paths/);
  assert.doesNotMatch(downloads, /does not yet claim Table support/);
  assert.doesNotMatch(offline, /current offline `patch link`: \*\*Table is not yet supported\*\*/);
  assert.doesNotMatch(targets, /Table is not yet part of sealed payload v8\/runtime v0\.9 or offline `patch link`/);
});

test('sealed Table v1.0 has real Windows macOS Linux seal run and offline-link evidence', () => {
  assert.match(sealedWorkflow, /contract:/);
  assert.match(sealedWorkflow, /Test baseline sealed payload contract/);
  assert.match(sealedWorkflow, /Test responsive sealed payload contract/);
  assert.match(sealedWorkflow, /Test Table payload v9 contract/);
  assert.match(sealedWorkflow, /Test offline-link payload contract/);
  assert.match(sealedWorkflow, /windows-latest/);
  assert.match(sealedWorkflow, /macos-latest/);
  assert.match(sealedWorkflow, /ubuntu-latest/);
  assert.match(sealedWorkflow, /PATCH_SEALED_GUI_VERSION: 9/);
  assert.match(sealedWorkflow, /examples\/table-native-v09\.patch/);
  assert.match(sealedWorkflow, /src\/cli-entry\.js link examples\/table-native-v09\.patch/);
  assert.match(sealedWorkflow, /--patch-smoke/);
  assert.match(sealedWorkflow, /native-win32-runtime-v1\.0/);
  assert.match(sealedWorkflow, /native-macos-runtime-v1\.0/);
  assert.match(sealedWorkflow, /native-linux-runtime-v1\.0/);
});

test('downloadable offline compiler exercises Table linking on every supported desktop Window host', () => {
  assert.match(offlineWorkflow, /windows-latest/);
  assert.match(offlineWorkflow, /ubuntu-latest/);
  assert.match(offlineWorkflow, /macos-15/);
  assert.match(offlineWorkflow, /macos-15-intel/);
  assert.match(offlineWorkflow, /link examples\/table-native-v09\.patch/);
  assert.match(offlineWorkflow, /OfflineTable/);
  assert.match(offlineWorkflow, /payload v9\/runtime v1\.0/);
});

test('Studio App preview Table event dispatch is implemented through the shared semantic adapter', () => {
  assert.match(help, /Studio App preview and Standalone Web support row selection/);
  assert.match(studio, /Studio App preview: real Table plus mouse\/keyboard row selection routed through the same shared semantic Window event adapter/);
  assert.match(nativeApps, /Studio App preview \| yes \| transient row list through shared Window event adapter \| implemented/);
  assert.match(targets, /Patch Studio App Preview exposes the same transient selected-row list through the shared semantic Window event adapter/);
  assert.match(roadmap, /\[x\] Studio App-preview dispatch parity for Table row selection through the shared semantic Window event adapter/);
  assert.match(playground, /appView\.addEventListener\('patch-studio-table-changed'/);
  assert.match(playground, /trigger\(detail\.control, 'changed', \{ value: \[\.\.\.detail\.value\] \}\)/);
  assert.match(studioTable, /new CustomEvent\('patch-studio-table-changed'/);
  assert.match(studioTable, /detail: \{ control: node\.id, value: \[\.\.\.row\] \}/);
});
