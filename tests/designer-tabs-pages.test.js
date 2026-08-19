import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { listDesignerControls } from '../src/designer.js';
import {
  addDesignerTabPage,
  listDesignerTabPages,
  moveDesignerTabPage,
  removeDesignerTabPage,
  renameDesignerTabPage
} from '../src/designer-data.js';

const source = `create text name = "Mia"
create boolean enabled = false
window "Settings" as main size 680, 440:
  tabs as settings at 24, 24 size 520, 300:
    tab "General":
      text "Name"
      input name
    tab "Advanced":
      checkbox "Enabled" as enabled
    tab "Actions":
      button "Reset" as reset_name

when name changed:
  change name:
    set = value

when enabled changed:
  change enabled:
    set = value

when reset_name clicked:
  change name:
    set = "Mia"
`;

test('Tabs data helper lists source-backed pages and nested control ids', () => {
  const tabs = listDesignerControls(source).find(control => control.type === 'tabs');
  const pages = listDesignerTabPages(source, tabs);
  assert.deepEqual(pages.map(page => page.titleExpr), ['"General"', '"Advanced"', '"Actions"']);
  assert.deepEqual(pages.map(page => page.controlIds), [['name'], ['enabled'], ['reset_name']]);
});

test('Tabs page rename preserves page body geometry and external event handlers', () => {
  const tabs = listDesignerControls(source).find(control => control.type === 'tabs');
  const next = renameDesignerTabPage(source, tabs, 1, '"Preferences"');
  assert.match(next, /tab "Preferences":\n      checkbox "Enabled" as enabled/);
  assert.match(next, /tabs as settings at 24, 24 size 520, 300:/);
  assert.match(next, /when enabled changed:/);
});

test('Tabs page add creates a valid flow-layout page without widening runtime contracts', () => {
  const tabs = listDesignerControls(source).find(control => control.type === 'tabs');
  const next = addDesignerTabPage(source, tabs);
  const pages = listDesignerTabPages(next, tabs);
  assert.equal(pages.length, 4);
  assert.equal(pages[3].titleExpr, '"Page 4"');
  assert.match(next, /tab "Page 4":\n      text "Page 4"/);
});

test('Tabs page reorder moves complete page bodies and keeps handlers intact', () => {
  const tabs = listDesignerControls(source).find(control => control.type === 'tabs');
  const next = moveDesignerTabPage(source, tabs, 2, 'up');
  const actions = next.indexOf('tab "Actions":');
  const advanced = next.indexOf('tab "Advanced":');
  assert.ok(actions >= 0 && advanced >= 0 && actions < advanced);
  assert.match(next, /tab "Actions":\n      button "Reset" as reset_name/);
  assert.match(next, /when reset_name clicked:/);
});

test('Tabs page delete removes orphan handlers and preserves remaining page bodies', () => {
  const tabs = listDesignerControls(source).find(control => control.type === 'tabs');
  const next = removeDesignerTabPage(source, tabs, 1);
  const pages = listDesignerTabPages(next, tabs);
  assert.deepEqual(pages.map(page => page.titleExpr), ['"General"', '"Actions"']);
  assert.doesNotMatch(next, /checkbox "Enabled" as enabled/);
  assert.doesNotMatch(next, /when enabled changed:/);
  assert.match(next, /when name changed:/);
  assert.match(next, /when reset_name clicked:/);
});

test('Tabs page delete fails closed at the Stage 1 two-page minimum', () => {
  const twoPages = `window "Demo":
  tabs as settings:
    tab "One":
      text "One"
    tab "Two":
      text "Two"
`;
  assert.throws(() => removeDesignerTabPage(twoPages, { windowIndex: 0, controlIndex: 0 }, 0), /at least two tab pages/);
});

test('Patch Studio exposes Tabs page editing through the shared Properties data editor', () => {
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const css = fs.readFileSync('web/designer-data-editor.css', 'utf8');
  for (const marker of ['Tab pages', '+ Page', 'data-tabs-action="rename"', 'data-tabs-action="up"', 'data-tabs-action="down"', 'Delete page']) {
    assert.ok(editor.includes(marker), marker);
  }
  assert.match(editor, /listDesignerTabPages/);
  assert.match(editor, /removeDesignerTabPage/);
  assert.match(css, /designer-tabs-page-list/);
  assert.match(css, /designer-tabs-page\.active/);
  execFileSync(process.execPath, ['--check', 'src/designer-data.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-data-editor.js'], { stdio: 'pipe' });
});
