import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import { listDesignerTabPageControls } from '../src/designer-tabs-nested.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';

function selected(source, type) {
  const control = listDesignerControls(source).find(item => item.type === type);
  assert.ok(control, `missing ${type} control`);
  return control;
}

test('Duplicate selected Button creates a fresh id, copies handlers and offsets geometry', () => {
  const source = `window "Main" as main size 640, 420:\n  button "Save" as save at 40, 50 size 120, 36\n\nwhen save clicked:\n  show "saved"\n`;
  const result = duplicateDesignerControl(source, selected(source, 'button'));
  assert.doesNotThrow(() => parse(result.source));
  assert.deepEqual(result.idMap, { save: 'button_1' });
  const controls = listDesignerControls(result.source);
  assert.equal(controls.length, 2);
  assert.deepEqual(controls.map(item => item.id), ['save', 'button_1']);
  assert.equal(result.control.id, 'button_1');
  assert.deepEqual(
    { x: result.control.x, y: result.control.y, width: result.control.width, height: result.control.height },
    { x: 56, y: 66, width: 120, height: 36 }
  );
  assert.match(result.source, /when save clicked:\n  show "saved"/);
  assert.match(result.source, /when button_1 clicked:\n  show "saved"/);
});

test('Duplicate selected Table preserves complete rows and source-backed layout', () => {
  const source = `window "Data" as main size 720, 480:\n  table "Name", "Role" as people at 32, 64 size 400, 180:\n    row "Ada", "Engineer"\n    row "Grace", "Scientist"\n`;
  const result = duplicateDesignerControl(source, selected(source, 'table'));
  assert.doesNotThrow(() => parse(result.source));
  assert.deepEqual(result.idMap, { people: 'table_1' });
  const controls = listDesignerControls(result.source);
  const copy = controls[1];
  assert.equal(copy.type, 'table');
  assert.equal(copy.id, 'table_1');
  assert.deepEqual(copy.columns, ['"Name"', '"Role"']);
  assert.deepEqual(copy.rows, [['"Ada"', '"Engineer"'], ['"Grace"', '"Scientist"']]);
  assert.deepEqual({ x: copy.x, y: copy.y }, { x: 48, y: 80 });
});

test('Duplicate selected TreeView preserves its complete hierarchy', () => {
  const source = `window "Tree" as main size 640, 460:\n  tree as nav at 40, 70 size 300, 220:\n    node "src"\n      node "compiler.js"\n      node "parser.js"\n    node "docs"\n      node "README.md"\n`;
  const result = duplicateDesignerControl(source, selected(source, 'tree'));
  assert.doesNotThrow(() => parse(result.source));
  assert.deepEqual(result.idMap, { nav: 'tree_1' });
  const copy = listDesignerControls(result.source)[1];
  assert.equal(copy.id, 'tree_1');
  assert.equal(copy.treeNodes.length, 2);
  assert.equal(copy.treeNodes[0].children.length, 2);
  assert.equal(copy.treeNodes[1].children[0].labelExpr, '"README.md"');
});

test('Duplicate selected Tabs remaps outer and nested ids and copies nested handlers', () => {
  const source = `window "Settings" as main size 760, 520:\n  tabs as settings at 40, 90 size 560, 320:\n    tab "General":\n      button "Nested" as nested\n      input query\n      table "Name", "Value" as prefs:\n        row "Theme", "System"\n    tab "Advanced":\n      tree as nav:\n        node "Root"\n          node "Child"\n\nwhen nested clicked:\n  show "nested"\n\nwhen query changed:\n  show value\n`;
  const result = duplicateDesignerControl(source, selected(source, 'tabs'));
  assert.doesNotThrow(() => parse(result.source));
  assert.deepEqual(result.idMap, {
    settings: 'tabs_1',
    nested: 'button_1',
    query: 'input_1',
    prefs: 'table_1',
    nav: 'tree_1'
  });
  const tabsControls = listDesignerControls(result.source).filter(item => item.type === 'tabs');
  assert.equal(tabsControls.length, 2);
  const copy = tabsControls[1];
  assert.equal(copy.id, 'tabs_1');
  assert.deepEqual({ x: copy.x, y: copy.y }, { x: 56, y: 106 });
  const general = listDesignerTabPageControls(result.source, copy, 0);
  assert.deepEqual(general.map(item => item.id), ['button_1', 'input_1', 'table_1']);
  assert.deepEqual(general[2].rows, [['"Theme"', '"System"']]);
  const advanced = listDesignerTabPageControls(result.source, copy, 1);
  assert.equal(advanced[0].id, 'tree_1');
  assert.equal(advanced[0].treeNodes[0].children[0].labelExpr, '"Child"');
  assert.match(result.source, /when nested clicked:\n  show "nested"/);
  assert.match(result.source, /when button_1 clicked:\n  show "nested"/);
  assert.match(result.source, /when query changed:\n  show value/);
  assert.match(result.source, /when input_1 changed:\n  show value/);
});

test('Duplicate selected unnamed Text needs no id rewrite and remains parseable', () => {
  const source = `window "Text" as main size 400, 240:\n  text "Hello" at 24, 24 size 180, 30\n`;
  const result = duplicateDesignerControl(source, selected(source, 'text'));
  assert.deepEqual(result.idMap, {});
  assert.doesNotThrow(() => parse(result.source));
  const controls = listDesignerControls(result.source);
  assert.equal(controls.length, 2);
  assert.equal(controls[1].type, 'text');
  assert.deepEqual({ x: controls[1].x, y: controls[1].y }, { x: 40, y: 40 });
});

test('Duplicate geometry falls back inside the Form when positive offset would clip', () => {
  const source = `window "Small" as main size 200, 120:\n  button "Edge" as edge at 80, 84 size 120, 36\n`;
  const result = duplicateDesignerControl(source, selected(source, 'button'));
  assert.deepEqual({ x: result.control.x, y: result.control.y }, { x: 64, y: 68 });
  assert.doesNotThrow(() => parse(result.source));
});

test('Duplicate selected control fails closed for stale or malformed selection', () => {
  const source = `window "Main":\n  button "Save" as save\n`;
  assert.throws(() => duplicateDesignerControl(source, null), /selection is invalid/);
  assert.throws(() => duplicateDesignerControl(source, { windowIndex: 0, controlIndex: 99 }), /no longer exists/);
});

test('Properties Duplicate uses shared selection, disables multi-select and focuses the copy', () => {
  const ui = fs.readFileSync('web/designer-control-duplicate.js', 'utf8');
  assert.match(ui, /currentDesignerSelection\(canvas\)/);
  assert.match(ui, /designer-multi-selected/);
  assert.match(ui, /multi > 1/);
  assert.match(ui, /duplicateDesignerControl\(code\.value, selection\)/);
  assert.match(ui, /rememberDesignerSelection/);
  assert.match(ui, /selectDesignerElement/);
  assert.match(ui, /requestAnimationFrame/);
  assert.match(ui, /focus\?\.\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|Change History/);
});

test('public Studio and offline PWA package selected-control duplication', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-control-duplicate\.js'/);
  assert.match(build, /designer-control-duplicate-model\.js/);
  assert.match(build, /designer-control-duplicate\.js/);
  assert.match(sw, /'\.\/designer-control-duplicate-model\.js'/);
  assert.match(sw, /'\.\/designer-control-duplicate\.js'/);
  execFileSync(process.execPath, ['--check', 'web/designer-control-duplicate-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-control-duplicate.js'], { stdio: 'pipe' });
});
