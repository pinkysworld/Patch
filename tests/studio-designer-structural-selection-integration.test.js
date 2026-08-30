import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dataEditor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
const tableActions = fs.readFileSync('web/designer-table-actions.js', 'utf8');

test('Designer structural editors resolve controls from the canonical source-backed selection', () => {
  for (const source of [dataEditor, tableActions]) {
    assert.match(source, /import \{ currentDesignerSelection \} from '\.\/designer-selection\.js';/);
    assert.match(source, /currentDesignerSelection\(canvas\)/);
    assert.match(source, /patch-designer-selection-change/);
  }

  const selectedControl = dataEditor.slice(
    dataEditor.indexOf('function selectedControl()'),
    dataEditor.indexOf('function renderTreeEditor', dataEditor.indexOf('function selectedControl()'))
  );
  assert.doesNotMatch(selectedControl, /designer-selected/);

  const selectedTable = tableActions.slice(
    tableActions.indexOf('function selectedTopLevelControl()'),
    tableActions.indexOf('function readTableDraft', tableActions.indexOf('function selectedTopLevelControl()'))
  );
  assert.doesNotMatch(selectedTable, /designer-selected/);
});
