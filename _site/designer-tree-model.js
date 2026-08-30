export function duplicateTreeSubtree(nodes, path) {
  const next = cloneTree(nodes);
  const { siblings, index } = treeLocation(next, path);
  const copy = cloneNode(siblings[index]);
  siblings.splice(index + 1, 0, copy);
  return { nodes: next, path: [...path.slice(0, -1), index + 1] };
}

function cloneTree(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) throw new Error('TreeView needs at least one node.');
  return nodes.map(cloneNode);
}

function cloneNode(node) {
  if (!node || typeof node !== 'object') throw new Error('TreeView node is invalid.');
  const labelExpr = String(node.labelExpr ?? '').trim();
  if (!labelExpr) throw new Error('TreeView node label cannot be empty.');
  const children = Array.isArray(node.children) ? node.children.map(cloneNode) : [];
  return { labelExpr, children };
}

function treeLocation(nodes, path) {
  if (!Array.isArray(path) || !path.length) throw new Error('TreeView node selection is invalid.');
  let siblings = nodes;
  for (let depth = 0; depth < path.length - 1; depth += 1) {
    const index = path[depth];
    if (!Number.isInteger(index) || index < 0 || index >= siblings.length) throw new Error('TreeView node selection is invalid.');
    siblings = siblings[index].children;
  }
  const index = path[path.length - 1];
  if (!Number.isInteger(index) || index < 0 || index >= siblings.length) throw new Error('TreeView node selection is invalid.');
  return { siblings, index };
}
