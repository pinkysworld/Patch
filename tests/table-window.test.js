import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';

const source = `window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"
  button "Close" as close at 24, 264 size 100, 36
`;

const studioIndex = fs.readFileSync('web/index.html', 'utf8');
const studioTable = fs.readFileSync('web/table-stage1.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');

test('parser keeps Table columns rows id and source-backed geometry', () => {
  const ast = parse(source);
  const table = ast[0].body[0];
  assert.equal(table.kind, 'uiControl');
  assert.equal(table.control, 'table');
  assert.equal(table.id, 'people');
  assert.deepEqual(table.columns, ['"Name"', '"Role"']);
  assert.deepEqual(table.rows, [['"Ada"', '"Engineer"'], ['"Grace"', '"Scientist"']]);
  assert.deepEqual(table.layout, { x: 24, y: 64, width: 440, height: 180 });
});

test('Table Stage 1 validates row width and requires source-backed rows', () => {
  assert.throws(() => parse('window "Bad":\n  table "A", "B" as grid:\n    row "one"\n'), /exactly 2 values/i);
  assert.throws(() => parse('window "Bad":\n  table "A" as grid:\n  button "Next" as next\n'), /needs at least one indented row/i);
  assert.throws(() => parse('window "Bad":\n  table "A" as grid:\n    button "No" as nope\n'), /can only contain rows/i);
});

test('compiler accepts Table as explicit UI capability without changing Change IR version', () => {
  const compiled = compile(source, { kind: 'window', name: 'PeopleTable' });
  assert.equal(compiled.ir.version, '0.10');
  assert.ok(compiled.ir.capabilities.includes('ui.table'));
  const table = compiled.ast[0].body[0];
  assert.deepEqual(table.rows[1], ['"Grace"', '"Scientist"']);
});

test('Designer adds moves renames and removes a Table block without rewriting row data', () => {
  let edited = addDesignerControl('window "Demo" as main size 560, 360:\n', 'table');
  let table = listDesignerControls(edited)[0];
  assert.equal(table.type, 'table');
  assert.deepEqual(table.columns, ['"Column 1"', '"Column 2"']);
  assert.deepEqual(table.rows, [['"Value 1"', '"Value 2"'], ['"Value 3"', '"Value 4"']]);
  assert.match(edited, /table "Column 1", "Column 2" as table_1 at 24, 24 size 400, 180:/);

  edited = updateDesignerControl(edited, table, { id: 'people', x: 48, y: 72, width: 460, height: 196 });
  assert.match(edited, /table "Column 1", "Column 2" as people at 48, 72 size 460, 196:/);
  assert.equal((edited.match(/row "Value 1", "Value 2"/g) ?? []).length, 1);
  assert.equal((edited.match(/row "Value 3", "Value 4"/g) ?? []).length, 1);

  table = listDesignerControls(edited)[0];
  edited = addDesignerControl(edited, 'button');
  edited = removeDesignerControl(edited, table);
  assert.doesNotMatch(edited, /\btable\b/);
  assert.doesNotMatch(edited, /^\s+row\s/m);
  assert.match(edited, /button "Button" as button_1/);
});

test('Patch Studio exposes Table in Designer and App preview through an offline-shipped module', () => {
  const checked = spawnSync(process.execPath, ['--check', 'web/table-stage1.js'], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(studioIndex, /id="addTable"/);
  assert.match(studioIndex, /src="\.\/table-stage1\.js"/);
  assert.match(studioTable, /addDesignerControl\(code\.value, 'table'/);
  assert.match(studioTable, /document\.createElement\('table'\)/);
  assert.match(studioTable, /patch-table-stage1-control/);
  assert.match(studioTable, /updateDesignerControl\(code\.value, selection/);
  assert.match(studioTable, /removeDesignerControl\(code\.value, selection\)/);
  assert.match(siteBuilder, /'table-stage1\.js'/);
  assert.match(serviceWorker, /'\.\/table-stage1\.js'/);
});

test('Standalone Window Web renders a real Table and preserves later control ordering', () => {
  const built = buildStandaloneWebApp(source, { kind: 'window', name: 'PeopleTable' });
  assert.equal(built.metadata.tableStage, 2);
  assert.equal(built.metadata.tableMode, 'transient-row-selection');
  assert.match(built.html, /function renderTable\(control\)/);
  assert.match(built.html, /document\.createElement\('table'\)/);
  assert.match(built.html, /document\.createElement\('thead'\)/);
  assert.match(built.html, /document\.createElement\('tbody'\)/);
  assert.match(built.html, /columns:Array\.isArray\(node\.columns\)/);
  assert.match(built.html, /rows:Array\.isArray\(node\.rows\)/);
  assert.match(built.html, /patch-table-wrap/);
  assert.match(built.html, /if\(control\.type==='table'\)return renderTable\(control\)/);
  assert.match(built.html, /data-patch-form-layout/);
});

test('Table changed is supported in Web while native Table lowering remains fail closed until Stage 2b', () => {
  const withEvent = `${source}\nwhen people changed:\n  show value\n`;
  const built = buildStandaloneWebApp(withEvent, { kind: 'window' });
  assert.equal(built.metadata.tableMode, 'transient-row-selection');
  const compiled = compile(source, { kind: 'window', name: 'PeopleTable' });
  assert.throws(() => buildNativeGuiIR(compiled), /does not support 'table' controls yet/i);
});