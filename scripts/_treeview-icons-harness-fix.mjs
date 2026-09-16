import fs from 'node:fs';

const path = 'scripts/_treeview-icons-stage1.mjs';
let source = fs.readFileSync(path, 'utf8');
const from = "          if (!ids.has(id)) throw new Error(`line ${node.line ?? '?'}: TreeView node image ${node.imageListId}.${node.imageItem} references missing project resource '${id}'.`);";
const to = "          if (!ids.has(id)) throw new Error('line '+(node.line ?? '?')+': TreeView node image '+node.imageListId+'.'+node.imageItem+\" references missing project resource '\"+id+\"'.\");";
const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`Expected one nested template literal to stabilize, found ${count}.`);
source = source.replace(from, to);
fs.writeFileSync(path, source);
console.log('TreeView icons helper quoting stabilized.');
