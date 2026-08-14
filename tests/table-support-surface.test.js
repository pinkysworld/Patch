import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const help = read('web/help.html');
const downloads = read('web/downloads.html');
const language = read('web/language.html');
const studio = read('docs/PATCH_STUDIO.md');
const nativeApps = read('docs/NATIVE_APPS.md');
const offline = read('docs/OFFLINE_COMPILER.md');
const targets = read('docs/TARGETS.md');
const roadmap = read('docs/ROADMAP.md');
const workflow = read('.github/workflows/native-table-v09.yml');

test('public Table surfaces agree on transient row-list semantics', () => {
  assert.match(help, /selected row only as transient <code>value<\/code>/);
  assert.match(language, /<code>value<\/code> is the selected row as a list of display strings/);
  assert.match(studio, /Table `changed` exposes a transient row list/);
  assert.match(nativeApps, /Table `changed` exposes the selected row as transient list-valued `value`/);
});

test('direct native Table support is tied to IR 0.8 backend 0.9 and real platform smokes', () => {
  for (const text of [help, language, studio, nativeApps, targets, roadmap]) {
    assert.match(text, /Native GUI IR \*\*?0\.8\*\*?|Native GUI IR 0\.8/);
    assert.match(text, /backend \*\*?0\.9\*\*?|backend 0\.9/);
  }
  assert.match(nativeApps, /WC_LISTVIEWW/);
  assert.match(nativeApps, /NSTableView/);
  assert.match(nativeApps, /GtkTreeView/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-15/);
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /--table-v09 --smoke/);
});

test('Ready and offline surfaces consistently do not claim sealed Table support yet', () => {
  assert.match(help, /Table is not yet claimed on those paths/);
  assert.match(downloads, /current downloadable compiler does not yet claim Table support/);
  assert.match(language, /do not yet claim Table support/);
  assert.match(studio, /Table is not yet supported because those paths still carry the Native GUI IR \*\*0\.7\*\*/);
  assert.match(nativeApps, /Payload v8 does not encode Native GUI IR 0\.8 Table/);
  assert.match(offline, /current offline `patch link`: \*\*Table is not yet supported\*\*/);
  assert.match(targets, /Table is not yet part of sealed payload v8\/runtime v0\.9 or offline `patch link`/);
  assert.match(roadmap, /\[ \] sealed Ready\/offline Table payload\/runtime contract and consumer switch/);
});

test('Studio App preview Table event dispatch remains explicitly separate from display support', () => {
  assert.match(help, /Studio App-preview Table event dispatch remains a separate follow-up/);
  assert.match(studio, /Studio App preview: Table display is present, semantic Table row dispatch is still a follow-up/);
  assert.match(nativeApps, /Studio App preview \| yes \| not yet wired to semantic Table dispatch/);
  assert.match(roadmap, /\[ \] Studio App-preview dispatch parity for Table row selection/);
});
