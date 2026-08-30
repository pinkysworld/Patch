import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentDesignerSelection,
  rememberDesignerSelection,
  restoreDesignerAdapterSelection
} from '../web/designer-selection.js';

function fakeCanvas(materializedForm = '0') {
  return {
    dataset: { patchDesignerMaterializedForm: materializedForm },
    querySelectorAll() { return []; },
    dispatchEvent() {}
  };
}

test('adapter selection survives while its source Form is intentionally a lightweight shell', () => {
  const canvas = fakeCanvas('1');
  const selection = { windowIndex: 0, controlIndex: 4, adapter: 'table', id: 'board' };
  rememberDesignerSelection(canvas, selection, { emit: false });

  assert.equal(restoreDesignerAdapterSelection(canvas, 'table', () => null), null);
  assert.deepEqual(currentDesignerSelection(canvas), selection);

  canvas.dataset.patchDesignerMaterializedForm = '0';
  const restoredElement = {
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} }
  };
  assert.equal(restoreDesignerAdapterSelection(canvas, 'table', () => restoredElement), restoredElement);
  assert.deepEqual(currentDesignerSelection(canvas), selection);
});

test('adapter selection still clears when the selected control is missing from its active materialized Form', () => {
  const canvas = fakeCanvas('0');
  rememberDesignerSelection(canvas, { windowIndex: 0, controlIndex: 4, adapter: 'table', id: 'board' }, { emit: false });

  assert.equal(restoreDesignerAdapterSelection(canvas, 'table', () => null), null);
  assert.equal(currentDesignerSelection(canvas), null);
});

test('inactive Form preservation is adapter-specific and cannot retain a different active adapter accidentally', () => {
  const canvas = fakeCanvas('1');
  const tree = { windowIndex: 0, controlIndex: 5, adapter: 'tree', id: 'parts' };
  rememberDesignerSelection(canvas, tree, { emit: false });

  assert.equal(restoreDesignerAdapterSelection(canvas, 'table', () => null), null);
  assert.deepEqual(currentDesignerSelection(canvas), tree);
});
