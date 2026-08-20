import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import { updateDesignerTableData } from '../src/designer-data.js';
import { listDesignerTabPageControls, updateDesignerTabPageTableData } from '../src/designer-tabs-nested.js';
import {
  duplicateTableColumn,
  duplicateTableRow,
  moveTableColumn,
  moveTableRow,
  tableActionAvailability
} from '../web/designer-table-model.js';

const tableData = {
  columns: ['"Name"', '"Role"', '"Team"'],
  rows: [
    ['"Ada"', '"Engineer"', '"Core"'],
    ['"Grace"', '"Scientist"', '"Research"'],
    ['"Linus"', '"Maintainer"', '"Kernel"']
  ]
};

test('Table row duplicate and reorder preserve complete independent rows', () => {
  const duplicated = duplicateTableRow(tableData, 1);
  assert.equal(duplicated.rowIndex, 2);
  assert.deepEqual(duplicated.rows[1], tableData.rows[1]);
  assert.deepEqual(duplicated.rows[2], tableData.rows[1]);
  duplicated.rows[2][0] = '"Changed"';
  assert.equal(duplicated.rows[1][0], '"Grace"');
  assert.equal(tableData.rows[1][0], '"Grace"');

  const moved = moveTableRow(tableData, 2, 'up');
  assert.equal(moved.rowIndex, 1);
  assert.deepEqual(moved.rows.map(row => row[0]), ['"Ada"', '"Linus"', '"Grace"']);
  assert.deepEqual(tableData.rows.map(row => row[0]), ['"Ada"', '"Grace"', '"Linus"']);
});

test('Table column duplicate and reorder move every corresponding cell with its header', () => {
  const duplicated = duplicateTableColumn(tableData, 1);
  assert.equal(duplicated.columnIndex, 2);
  assert.deepEqual(duplicated.columns, ['"Name"', '"Role"', '"Role"', '"Team"']);
  assert.deepEqual(duplicated.rows[0], ['"Ada"', '"Engineer"', '"Engineer"', '"Core"']);

  const moved = moveTableColumn(tableData, 2, 'left');
  assert.equal(moved.columnIndex, 1);
  assert.deepEqual(moved.columns, ['"Name"', '"Team"', '"Role"']);
  assert.deepEqual(moved.rows[0], ['"Ada"', '"Core"', '"Engineer"']);
  assert.deepEqual(moved.rows[1], ['"Grace"', '"Research"', '"Scientist"']);
});

test('Table boundary moves are deterministic no-ops and availability matches them', () => {
  assert.deepEqual(moveTableRow(tableData, 0, 'up').rows, tableData.rows);
  assert.deepEqual(moveTableColumn(tableData, 0, 'left').columns, tableData.columns);
  assert.deepEqual(tableActionAvailability(tableData, 0, 0), {
    row: { duplicate: true, up: false, down: true },
    column: { duplicate: true, left: false, right: true }
  });
  assert.deepEqual(tableActionAvailability({ columns: ['"Only"'], rows: [] }, 0, 0), {
    row: { duplicate: false, up: false, down: false },
    column: { duplicate: true, left: false, right: false }
  });
});

test('Table actions fail closed for malformed data, invalid selection and invalid directions', () => {
  assert.throws(() => duplicateTableRow({ columns: ['"A"'], rows: [['"x"', '"y"']] }, 0), /exactly 1 cells/);
  assert.throws(() => duplicateTableRow(tableData, 99), /selection is invalid/);
  assert.throws(() => duplicateTableColumn(tableData, -1), /selection is invalid/);
  assert.throws(() => moveTableRow(tableData, 0, 'left'), /direction must be 'up' or 'down'/);
  assert.throws(() => moveTableColumn(tableData, 0, 'up'), /direction must be 'left' or 'right'/);
});

test('top-level Table duplicate/reorder results remain ordinary parseable Patch source', () => {
  const source = `window "People" as main size 640, 420:\n  table "Name", "Role" as people at 24, 64 size 400, 180:\n    row "Ada", "Engineer"\n    row "Grace", "Scientist"\n`;
  const table = listDesignerControls(source).find(control => control.type === 'table');
  const moved = moveTableColumn({ columns: table.columns, rows: table.rows }, 1, 'left');
  const duplicated = duplicateTableRow(moved, 0);
  const next = updateDesignerTableData(source, table, duplicated);
  assert.doesNotThrow(() => parse(next));
  assert.match(next, /table "Role", "Name" as people at 24, 64 size 400, 180:/);
  assert.match(next, /row "Engineer", "Ada"\n    row "Engineer", "Ada"\n    row "Scientist", "Grace"/);
});

test('nested Table uses the same row/column operation semantics and stays parseable', () => {
  const source = `window "Settings" as main size 640, 420:\n  tabs as settings at 24, 64 size 500, 280:\n    tab "General":\n      table "Key", "Value" as prefs:\n        row "Theme", "System"\n        row "Scale", "125%"\n    tab "Advanced":\n      text "Advanced"\n`;
  const tabs = listDesignerControls(source).find(control => control.type === 'tabs');
  const table = listDesignerTabPageControls(source, tabs, 0).find(control => control.type === 'table');
  const duplicated = duplicateTableColumn({ columns: table.columns, rows: table.rows }, 0);
  const moved = moveTableRow(duplicated, 1, 'up');
  const next = updateDesignerTabPageTableData(source, tabs, 0, table.controlIndex, moved);
  assert.doesNotThrow(() => parse(next));
  assert.match(next, /table "Key", "Key", "Value" as prefs:/);
  assert.match(next, /row "Scale", "Scale", "125%"\n        row "Theme", "Theme", "System"/);
  assert.match(next, /tab "Advanced":\n      text "Advanced"/);
});

test('shared Table action UI is idempotent, source-backed and packaged for top-level and nested editors', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const web = fs.readFileSync('web/designer-table-actions.js', 'utf8');
  const model = fs.readFileSync('web/designer-table-model.js', 'utf8');
  const css = fs.readFileSync('web/designer-table-actions.css', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');

  assert.match(workspace, /import '\.\/designer-table-actions\.js'/);
  assert.match(web, /from '\.\/designer-table-model\.js'/);
  assert.match(web, /updateDesignerTableData/);
  assert.match(web, /updateDesignerTabPageTableData/);
  assert.match(web, /data-table-advanced-action="row-duplicate"/);
  assert.match(web, /data-table-advanced-action="column-duplicate"/);
  assert.match(web, /toolbar\.dataset\.signature === signature/);
  assert.doesNotMatch(web, /localStorage|sessionStorage|Change History/);
  assert.match(model, /duplicateTableRow/);
  assert.match(model, /moveTableColumn/);
  assert.match(css, /designer-table-advanced-actions/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(build, /designer-table-model\.js/);
  assert.match(build, /designer-table-actions\.js/);
  assert.match(build, /designer-table-actions\.css/);
  assert.match(sw, /'\.\/designer-table-model\.js'/);
  assert.match(sw, /'\.\/designer-table-actions\.js'/);
  assert.match(sw, /'\.\/designer-table-actions\.css'/);
  assert.doesNotMatch(build, /SITE_SRC_FILES\.splice\([^\n]*designer-table-actions/);
  assert.doesNotMatch(sw, /\.\.\/src\/designer-table-actions\.js/);

  execFileSync(process.execPath, ['--check', 'web/designer-table-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-table-actions.js'], { stdio: 'pipe' });
});
