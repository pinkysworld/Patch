import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES,
  PATCH_STUDIO_RUNTIME_SELECTION_STATE_VERSION,
  clearRuntimeSelections,
  getRuntimeSelection,
  runtimeSelectionKey,
  runtimeSelectionStats,
  setRuntimeSelection
} from '../web/studio-runtime-selection-state.js';

test('runtime selection keys match explicit ids and stable Form paths', () => {
  assert.equal(PATCH_STUDIO_RUNTIME_SELECTION_STATE_VERSION, '0.1');
  assert.equal(runtimeSelectionKey({ id: 'board' }, { windowId: 'main', controlPath: '8' }), 'id:board');
  assert.equal(runtimeSelectionKey({}, { windowId: 'settings', controlPath: '0.tab1.2' }), 'settings:path:0.tab1.2');
});

test('runtime selection namespaces are isolated and clone structured values', () => {
  const container = {};
  const path = ['Parts', 'Input', 'Keyboard'];
  setRuntimeSelection(container, 'tree', 'id:parts', path);
  setRuntimeSelection(container, 'table', 'id:board', 2);
  path.push('mutated');

  assert.deepEqual(getRuntimeSelection(container, 'tree', 'id:parts'), ['Parts', 'Input', 'Keyboard']);
  assert.equal(getRuntimeSelection(container, 'table', 'id:board'), 2);
  assert.equal(Object.isFrozen(getRuntimeSelection(container, 'tree', 'id:parts')), true);
  assert.deepEqual(runtimeSelectionStats(container), { tree: 1, table: 1 });

  clearRuntimeSelections(container, 'tree');
  assert.equal(getRuntimeSelection(container, 'tree', 'id:parts'), undefined);
  assert.equal(getRuntimeSelection(container, 'table', 'id:board'), 2);
});

test('runtime selection namespaces remain bounded with LRU-style writes', () => {
  const container = {};
  for (let index = 0; index <= PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES; index += 1) {
    setRuntimeSelection(container, 'table', `id:table-${index}`, index);
  }
  assert.equal(runtimeSelectionStats(container).table, PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES);
  assert.equal(getRuntimeSelection(container, 'table', 'id:table-0'), undefined);
  assert.equal(getRuntimeSelection(container, 'table', `id:table-${PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES}`), PATCH_STUDIO_RUNTIME_SELECTION_MAX_ENTRIES);
});
