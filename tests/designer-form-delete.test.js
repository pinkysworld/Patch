import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls, listDesignerWindows } from '../src/designer.js';
import { removeDesignerForm } from '../web/designer-form-delete-model.js';

const source = `window "First" as first size 640, 420:
  button "Keep" as keep at 24, 24 size 120, 36

window "Second" as second size 700, 480:
  button "Delete" as remove_me at 24, 24 size 120, 36
  tabs as settings at 24, 80 size 520, 300:
    tab "General":
      input query
      table "Name", "Value" as prefs:
        row "Theme", "System"
    tab "Advanced":
      tree as nav:
        node "Root"

window "Third" as third size 500, 320:
  button "Stay" as stay at 24, 24 size 120, 36

when keep clicked:
  show "keep"

when remove_me clicked:
  show "remove"

when query changed:
  show value

when prefs changed:
  show value

when nav changed:
  show value

when stay clicked:
  show "stay"
`;

test('Delete Form removes the selected window block and keeps later Forms ordered', () => {
  const result = removeDesignerForm(source, 1);
  assert.equal(result.windowIndex, 1);
  assert.doesNotThrow(() => parse(result.source));
  const windows = listDesignerWindows(result.source);
  assert.deepEqual(windows.map(item => item.id), ['first', 'third']);
  assert.deepEqual(windows.map(item => item.titleExpr), ['"First"', '"Third"']);
  assert.doesNotMatch(result.source, /window "Second"/);
  assert.match(result.source, /window "Third" as third/);
});

test('Delete Form removes handlers for all top-level and nested controls in that Form', () => {
  const result = removeDesignerForm(source, 1);
  assert.deepEqual(result.removedControlIds, ['remove_me', 'settings', 'query', 'prefs', 'nav']);
  for (const id of ['remove_me', 'query', 'prefs', 'nav']) {
    assert.doesNotMatch(result.source, new RegExp(`when ${id} `));
  }
  assert.match(result.source, /when keep clicked:/);
  assert.match(result.source, /when stay clicked:/);
  const controls = listDesignerControls(result.source);
  assert.deepEqual(controls.filter(item => item.windowIndex === 0).map(item => item.id), ['keep']);
  assert.deepEqual(controls.filter(item => item.windowIndex === 1).map(item => item.id), ['stay']);
});

test('Delete Form selects the previous surviving Form when deleting the final Form', () => {
  const result = removeDesignerForm(source, 2);
  assert.equal(result.windowIndex, 1);
  assert.deepEqual(listDesignerWindows(result.source).map(item => item.id), ['first', 'second']);
  assert.doesNotMatch(result.source, /when stay clicked:/);
});

test('Delete Form refuses to remove the last remaining Form', () => {
  const single = `window "Only" as only:\n  text "Only"\n`;
  assert.throws(() => removeDesignerForm(single, 0), /keeps at least one Form/);
  assert.throws(() => removeDesignerForm(source, -1), /Form selection is invalid/);
  assert.throws(() => removeDesignerForm(source, 9), /Form selection is invalid/);
});

test('Delete Form UI confirms destructive edits and reuses the existing Form selector', () => {
  const ui = fs.readFileSync('web/designer-form-delete.js', 'utf8');
  assert.match(ui, /#patchFormSelect/);
  assert.match(ui, /patchDeleteForm/);
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /removeDesignerForm\(code\.value, windowIndex\)/);
  assert.match(ui, /select\.options\.length <= 1/);
  assert.match(ui, /select\.dispatchEvent\(new Event\('change'/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|Change History/);
});

test('public Studio and offline PWA package Form deletion', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-form-delete\.js'/);
  assert.match(build, /designer-form-delete-model\.js/);
  assert.match(build, /designer-form-delete\.js/);
  assert.match(sw, /'\.\/designer-form-delete-model\.js'/);
  assert.match(sw, /'\.\/designer-form-delete\.js'/);
  execFileSync(process.execPath, ['--check', 'web/designer-form-delete-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-form-delete.js'], { stdio: 'pipe' });
});
