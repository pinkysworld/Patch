import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_STUDIO_TABLE_RUNTIME_ADAPTER_CONTRACT_VERSION,
  isTableRuntimeAdapterControl,
  tableRuntimeAdapterModelFingerprint
} from '../web/table-stage1.js';

test('Table runtime adapter contract is narrow and stable', () => {
  assert.equal(PATCH_STUDIO_TABLE_RUNTIME_ADAPTER_CONTRACT_VERSION, '0.1');
  assert.equal(isTableRuntimeAdapterControl({ type: 'table', id: 'board' }), true);
  assert.equal(isTableRuntimeAdapterControl({ kind: 'uiControl', control: 'table', id: 'board' }), true);
  assert.equal(isTableRuntimeAdapterControl({ type: 'statusbar', id: 'status' }), false);
  assert.equal(tableRuntimeAdapterModelFingerprint({ type: 'statusbar' }), null);
  assert.equal(
    tableRuntimeAdapterModelFingerprint({ type: 'table', id: 'board', value: ['A'] }),
    tableRuntimeAdapterModelFingerprint({ type: 'table', id: 'board', value: ['A'] })
  );
  assert.notEqual(
    tableRuntimeAdapterModelFingerprint({ type: 'table', id: 'board', value: ['A'] }),
    tableRuntimeAdapterModelFingerprint({ type: 'table', id: 'board', value: ['B'] })
  );
});
