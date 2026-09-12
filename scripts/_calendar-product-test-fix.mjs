import fs from 'node:fs';

const path = 'tests/studio-authoring-surface.test.js';
let source = fs.readFileSync(path, 'utf8');
const stale = '  assert.match(surface, /Calendar and richer date\\/time or shell controls/);';
const current = [
  '  assert.match(surface, /Calendar as ordinary Input plus `# @input-mode calendar`/);',
  '  assert.match(surface, /richer date\\/time or shell controls from the RAD master backlog/);',
  '  assert.doesNotMatch(surface, /Calendar and richer date\\/time or shell controls/);'
].join('\n');

if (source.includes(current)) {
  console.log('Calendar authoring-surface test already current.');
} else {
  if (!source.includes(stale)) throw new Error('Missing stale Calendar future-work assertion.');
  source = source.replace(stale, current);
  fs.writeFileSync(path, source);
  console.log('Calendar authoring-surface test updated.');
}
