import test from 'node:test';
import assert from 'node:assert/strict';
import { collectRawCallSites } from '../src/call-site-validation.js';

test('raw call-site parser handles nested delimiters', () => {
  const sites = collectRawCallSites(`do target((1 + 2), [3, 4], other(5, 6))`);
  assert.deepEqual(sites, [
    { caller: '$program', callee: 'target', line: 1, args: ['(1 + 2)', '[3, 4]', 'other(5, 6)'] }
  ]);
});
