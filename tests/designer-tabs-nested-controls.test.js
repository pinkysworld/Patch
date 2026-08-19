import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import {
  addDesignerTabPageControl,
  listDesignerTabPageControls,
  removeDesignerTabPageControl,
  supportedDesignerTabControlTypes
} from '../src/designer-tabs-nested.js';

const base = `window "Settings" as main size 640, 420:
  button "Outside" as button_1
  tabs as settings at 24, 72 size 500, 280:
    tab "General":
      text "General"
      button "Save" as save
    tab "Advanced":
      text "Advanced"

when save clicked:
  show 1
`;

function tabs(source = base) {
  return listDesignerControls(source).find(control => control.type === 'tabs');
}

test('Tabs nested editor lists flow-layout controls for the selected page', () => {
  const controls = listDesignerTabPageControls(base, tabs(), 0);
  assert.deepEqual(controls.map(control => control.type), ['text', 'button']);
  assert.deepEqual(controls.map(control => control.id), [null, 'save']);
});

test('Tabs nested editor adds every supported simple flow control as valid Patch source', () => {
  let source = base;
  for (const type of supportedDesignerTabControlTypes()) {
    source = addDesignerTabPageControl(source, tabs(source), 1, type);
    assert.doesNotThrow(() => parse(source), type);
  }
  const controls = listDesignerTabPageControls(source, tabs(source), 1);
  for (const type of supportedDesignerTabControlTypes()) {
    assert.ok(controls.some(control => control.type === type), type);
  }
});

test('nested control ids remain unique across top-level and Tabs page controls', () => {
  const source = addDesignerTabPageControl(base, tabs(), 0, 'button');
  const controls = listDesignerTabPageControls(source, tabs(source), 0);
  assert.equal(controls.at(-1).id, 'button_2');
  assert.match(source, /button "Button" as button_2/);
});

test('removing a named nested control also removes its orphan handler', () => {
  const next = removeDesignerTabPageControl(base, tabs(), 0, 1);
  assert.doesNotMatch(next, /button "Save" as save/);
  assert.doesNotMatch(next, /when save clicked:/);
  assert.match(next, /tab "General":\n      text "General"/);
  assert.doesNotThrow(() => parse(next));
});

test('nested editor refuses to leave a Tabs page empty', () => {
  const source = `window "Demo":
  tabs as settings:
    tab "One":
      text "One"
    tab "Two":
      text "Two"
`;
  assert.throws(() => removeDesignerTabPageControl(source, tabs(source), 0, 0), /at least one control/);
});

test('nested editor fails closed for controls outside the current simple-flow slice', () => {
  assert.throws(() => addDesignerTabPageControl(base, tabs(), 0, 'tree'), /cannot add 'tree'/);
  assert.throws(() => addDesignerTabPageControl(base, tabs(), 0, 'table'), /cannot add 'table'/);
});

test('Studio ships nested Tabs control editing through the content-addressed PWA surface', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const web = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const css = fs.readFileSync('web/designer-data-editor.css', 'utf8');

  assert.match(workspace, /import '\.\/designer-tabs-nested\.js'/);
  assert.match(web, /Page controls/);
  assert.match(web, /data-tabs-add-control/);
  assert.match(web, /data-tabs-remove-control/);
  assert.match(css, /designer-tabs-control-list/);
  assert.match(sw, /designer-tabs-nested\.js/);
  assert.match(sw, /designer-tabs-nested\.js/);
  assert.match(build, /'designer-tabs-nested\.js'/);

  execFileSync(process.execPath, ['--check', 'src/designer-tabs-nested.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-tabs-nested.js'], { stdio: 'pipe' });
});
