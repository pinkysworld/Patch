import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB = path.resolve('web');
const DESIGNER_MUTATION_FILE = /^(?:designer-.*|forms-designer|table-stage1|tree-designer|beta35-studio)\.js$/;

/**
 * Studio history records every untrusted Designer rewrite as one atomic
 * transaction when the source editor emits input/change. Keep this repository
 * scan as a guard against a new adapter assigning code.value directly and
 * silently bypassing Undo/Redo.
 */
test('every Designer module that assigns code.value emits the canonical input/change transaction events', () => {
  const offenders = [];
  for (const name of fs.readdirSync(WEB).filter(name => DESIGNER_MUTATION_FILE.test(name)).sort()) {
    const source = fs.readFileSync(path.join(WEB, name), 'utf8');
    if (!/\bcode\.value\s*=/.test(source)) continue;
    const hasInput = /code\.dispatchEvent\(new Event\(['"]input['"]/.test(source);
    const hasChange = /code\.dispatchEvent\(new Event\(['"]change['"]/.test(source);
    if (!hasInput || !hasChange) offenders.push({ name, hasInput, hasChange });
  }
  assert.deepEqual(offenders, []);
});

test('Studio history still treats untrusted Designer rewrites as atomic Studio transactions', () => {
  const history = fs.readFileSync('web/studio-command-palette.js', 'utf8');
  assert.match(history, /const trustedTyping = event\?\.type === 'input' && event\.isTrusted === true/);
  assert.match(history, /kind: trustedTyping \? 'typing' : 'studio'/);
  assert.match(history, /else \{\s*pushBounded\(editUndo/s);
});
