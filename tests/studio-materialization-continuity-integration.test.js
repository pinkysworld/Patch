import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function source(path) {
  return fs.readFileSync(path, 'utf8');
}

test('Designer materialization continuity is source-backed and avoids resize-handle mutation churn', () => {
  const selection = source('web/designer-selection.js');
  const table = source('web/table-stage1.js');
  const tree = source('web/tree-designer.js');
  const dataEditor = source('web/designer-data-editor.js');
  const forms = source('web/forms-designer.js');

  assert.match(selection, /restoreDesignerAdapterSelection\(canvas, adapter, findElement, options = \{\}\)/);
  assert.match(selection, /sourceStillLive/);
  assert.match(table, /restoreDesignerAdapterSelection\(designerCanvas, 'table', tableElement, \{/);
  assert.match(table, /isLive: selection => listDesignerControls\(code\.value\)/);
  assert.match(tree, /restoreDesignerAdapterSelection\(canvas, 'tree', treeElement, \{/);
  assert.match(tree, /isLive: selection => controls\.some/);

  assert.match(dataEditor, /currentDesignerSelection\(canvas\)/);
  assert.doesNotMatch(dataEditor, /querySelector\('\.designer-control\.designer-selected\[data-window-index\]\[data-control-index\]'\)/);

  assert.match(forms, /waitingForRequestedForm/);
  assert.match(forms, /selectedLayoutControl/);
  assert.match(forms, /if \(designer && !selectedLayoutControl\)/);
  assert.doesNotMatch(forms, /if \(designer\) \{\s*for \(const handle of body\.querySelectorAll\(':scope > \.patch-form-resize-handle'\)\) handle\.remove\(\);\s*\}\s*\n\s*const sourceHasLayout/);
});
