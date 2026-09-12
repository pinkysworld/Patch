import fs from 'node:fs';

const path = 'tests/studio-authoring-surface.test.js';
const before = fs.readFileSync(path, 'utf8');
const oldBlock = `  assert.match(surface, /Calendar and richer date\\/time or shell controls/);\n  assert.doesNotMatch(surface, /Number\\/SpinEdit, date\\/time controls, SplitContainer/);`;
const newBlock = `  assert.match(surface, /Calendar as ordinary Input plus \\`# @input-mode calendar\\`/);\n  assert.match(surface, /richer date\\/time or shell controls from the RAD master backlog/);\n  assert.doesNotMatch(surface, /Calendar and richer date\\/time or shell controls/);\n  assert.doesNotMatch(surface, /Number\\/SpinEdit, date\\/time controls, SplitContainer/);`;
if (before.includes(newBlock)) {
  console.log('Calendar authoring-surface test already current.');
} else {
  if (!before.includes(oldBlock)) throw new Error('Missing stale Calendar future-work assertion.');
  fs.writeFileSync(path, before.replace(oldBlock, newBlock));
  console.log('Calendar authoring-surface test updated.');
}
