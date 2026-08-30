import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentDesignerSelection,
  rememberDesignerSelection,
  restoreDesignerAdapterSelection
} from '../web/designer-selection.js';

function fakeCanvas() {
  return {
    querySelectorAll() { return []; },
    dispatchEvent() { return true; }
  };
}

test('adapter selection can survive temporary DOM unmaterialization while its source control remains live', () => {
  const canvas = fakeCanvas();
  const selection = { windowIndex: 0, controlIndex: 3, adapter: 'table', id: 'board' };
  rememberDesignerSelection(canvas, selection, { emit: false });

  const restored = restoreDesignerAdapterSelection(canvas, 'table', () => null, {
    isLive: candidate => candidate.windowIndex === 0 && candidate.controlIndex === 3
  });

  assert.equal(restored, null);
  assert.deepEqual(currentDesignerSelection(canvas), selection);
});

test('adapter selection still clears when both the DOM element and source control are gone', () => {
  const canvas = fakeCanvas();
  rememberDesignerSelection(canvas, { windowIndex: 1, controlIndex: 2, adapter: 'tree', id: 'parts' }, { emit: false });

  restoreDesignerAdapterSelection(canvas, 'tree', () => null, { isLive: () => false });

  assert.equal(currentDesignerSelection(canvas), null);
});
