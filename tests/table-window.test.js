import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';

const source = `window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"
  button "Close" as close at 24, 264 size 100, 36
`;

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

test('Standalone Window Web renders a real read-only HTML table and preserves later control ordering', () => {
  const built = buildStandaloneWebApp(source, { kind: 'window', name: 'PeopleTable' });
  assert.equal(built.metadata.tableStage, 1);
  assert.equal(built.metadata.tableMode, 'read-only-source-backed');
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

test('Table exposes no selection event in Stage 1 and native lowering fails closed', () => {
  const withEvent = `${source}\nwhen people changed:\n  show value\n`;
  assert.throws(() => buildStandaloneWebApp(withEvent, { kind: 'window' }), /table.*does not expose|does not expose.*table/i);
  const compiled = compile(source, { kind: 'window', name: 'PeopleTable' });
  assert.throws(() => buildNativeGuiIR(compiled), /unsupported native GUI control 'table'/i);
});
