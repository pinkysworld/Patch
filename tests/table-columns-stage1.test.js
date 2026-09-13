import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import {
  PATCH_TABLE_COLUMN_PRESENTATION_VERSION,
  defaultTableColumnPresentation,
  formatTableColumnPresentationDirective,
  parseTableColumnPresentationDirective,
  readWindowTableColumnPresentation,
  setWindowTableColumnPresentation
} from '../src/table-column-presentation.js';

const SOURCE = `window "Data" as main:
  # @table-columns 180:left, 120:center, 96:right
  table "Name", "State", "Score" as people at 24, 64 size 440, 180:
    row "Ada", "Ready", "98"
    row "Grace", "Review", "95"

when people changed:
  print value
`;

test('advanced Table column presentation has a small deterministic 0.1 source contract', () => {
  assert.equal(PATCH_TABLE_COLUMN_PRESENTATION_VERSION, '0.1');
  assert.deepEqual(parseTableColumnPresentationDirective('# @table-columns 180:left, auto:center, 96:right', 3), [
    { width: 180, align: 'left' },
    { width: null, align: 'center' },
    { width: 96, align: 'right' }
  ]);
  assert.equal(formatTableColumnPresentationDirective(defaultTableColumnPresentation(2), 2), null);
  assert.equal(formatTableColumnPresentationDirective([
    { width: 180, align: 'left' },
    { width: null, align: 'center' }
  ], 2), '# @table-columns 180:left, auto:center');
  assert.throws(() => parseTableColumnPresentationDirective('# @table-columns 20:left', 1), /40 to 2000/);
  assert.throws(() => parseTableColumnPresentationDirective('# @table-columns 120:justify', 1), /Invalid Table column/);
});

test('Table column metadata round-trips without changing Table syntax or Change IR', () => {
  assert.deepEqual(readWindowTableColumnPresentation(SOURCE, 3, 3), [
    { width: 180, align: 'left' },
    { width: 120, align: 'center' },
    { width: 96, align: 'right' }
  ]);
  const plain = `window "Data":\n  table "A", "B" as grid:\n    row "1", "2"\n`;
  const added = setWindowTableColumnPresentation(plain, 2, [
    { width: 160, align: 'left' },
    { width: null, align: 'right' }
  ], 2);
  assert.match(added, /# @table-columns 160:left, auto:right\n  table "A", "B" as grid:/);
  const removed = setWindowTableColumnPresentation(added, 3, defaultTableColumnPresentation(2), 2);
  assert.doesNotMatch(removed, /@table-columns/);

  const compiled = compile(SOURCE, { kind: 'window' });
  assert.equal(compiled.ir.version, '0.10');
  const table = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'table');
  assert.deepEqual(table.tableColumnPresentation, [
    { width: 180, align: 'left' },
    { width: 120, align: 'center' },
    { width: 96, align: 'right' }
  ]);
  assert.equal(compiled.windowTableColumnPresentation.version, '0.1');
});

test('advanced Table columns are Studio/Web only and Current Ready native fails closed', () => {
  const compiled = compile(SOURCE, { kind: 'window' });
  assert.doesNotThrow(() => validateWindowRuntimeSupport(compiled, { allowTables: true, allowAdvancedTableColumns: true }));
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowTables: true }),
    /Advanced Table columns Stage 1.*Studio\/Web only/i
  );

  const plain = compile(`window "Plain":\n  table "A" as grid:\n    row "1"\n`, { kind: 'window' });
  assert.doesNotThrow(() => validateWindowRuntimeSupport(plain, { allowTables: true }));
});

test('Standalone Web carries column width/alignment while preserving transient row changed(value)', () => {
  const built = buildStandaloneWebApp(SOURCE, { kind: 'window', name: 'AdvancedTable' });
  assert.equal(built.metadata.tableColumnPresentationStage, 1);
  assert.equal(built.metadata.tableColumnPresentationVersion, '0.1');
  assert.equal(built.metadata.tableColumnPresentationMode, 'source-backed-width-alignment');
  assert.match(built.html, /columnPresentation:Array\.isArray\(node\.tableColumnPresentation\)/);
  assert.match(built.html, /document\.createElement\('colgroup'\)/);
  assert.match(built.html, /style\.textAlign=spec\.align/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:\[\.\.\.row\]\}\)/);
});

test('Patch Studio Table editor exposes width and alignment without a second state model', () => {
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const table = fs.readFileSync('web/table-stage1.js', 'utf8');
  assert.match(editor, /data-table-column-width/);
  assert.match(editor, /data-table-column-align/);
  assert.match(editor, /readWindowTableColumnPresentation/);
  assert.match(editor, /setWindowTableColumnPresentation/);
  assert.match(table, /readWindowTableColumnPresentation/);
  assert.match(table, /tableColumnPresentation/);
  assert.match(table, /colgroup/);
});
