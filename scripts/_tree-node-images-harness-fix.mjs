import fs from 'node:fs';

const path = 'scripts/_tree-node-images-stage1.mjs';
let source = fs.readFileSync(path, 'utf8');

function replaceExact(needle, replacement, expected, label) {
  const count = source.split(needle).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} ${label} occurrence(s), found ${count}`);
  source = source.split(needle).join(replacement);
}

replaceExact(
  "parseTreeNodeImageBinding(value?.imageListId || value?.imageItem ? `${value?.imageListId ?? ''}.${value?.imageItem ?? ''}` : '')",
  "parseTreeNodeImageBinding(value?.imageListId || value?.imageItem ? String(value?.imageListId ?? '') + '.' + String(value?.imageItem ?? '') : '')",
  1,
  'value binding template'
);

replaceExact(
  "parseTreeNodeImageBinding(node.imageListId || node.imageItem ? `${node.imageListId ?? ''}.${node.imageItem ?? ''}` : '')",
  "parseTreeNodeImageBinding(node.imageListId || node.imageItem ? String(node.imageListId ?? '') + '.' + String(node.imageItem ?? '') : '')",
  2,
  'node binding template'
);

fs.writeFileSync(path, source);
console.log('TreeView node image helper template literals stabilized.');
