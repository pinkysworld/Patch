import fs from 'node:fs';

function replaceOne(path, needle, replacement, label) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label} anchor in ${path}, found ${count}`);
  fs.writeFileSync(path, source.replace(needle, replacement));
}

replaceOne(
  'src/parser.js',
`      nodes.push({
        labelExpr: parsed.labelExpr,
        imageListId: parsed.imageListId,
        imageItem: parsed.imageItem,
        children,
        line: child.line
      });`,
`      const node = { labelExpr: parsed.labelExpr, children, line: child.line };
      if (parsed.imageListId && parsed.imageItem) {
        node.imageListId = parsed.imageListId;
        node.imageItem = parsed.imageItem;
      }
      nodes.push(node);`,
  'parser optional TreeView image fields'
);

replaceOne(
  'src/compiler.js',
`function lowerTreeNodes(nodes) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    imageListId: node.imageListId ?? null,
    imageItem: node.imageItem ?? null,
    line: node.line ?? null,
    children: lowerTreeNodes(node.children)
  }));
}`,
`function lowerTreeNodes(nodes) {
  return (nodes ?? []).map(node => {
    const lowered = {
      labelExpr: node.labelExpr,
      line: node.line ?? null,
      children: lowerTreeNodes(node.children)
    };
    if (node.imageListId && node.imageItem) {
      lowered.imageListId = node.imageListId;
      lowered.imageItem = node.imageItem;
    }
    return lowered;
  });
}`,
  'compiler optional TreeView image fields'
);

replaceOne(
  'src/designer.js',
`function cloneTreeNodes(nodes = []) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    imageListId: node.imageListId ?? null,
    imageItem: node.imageItem ?? null,
    children: cloneTreeNodes(node.children)
  }));
}`,
`function cloneTreeNodes(nodes = []) {
  return (nodes ?? []).map(node => {
    const cloned = { labelExpr: node.labelExpr, children: cloneTreeNodes(node.children) };
    if (node.imageListId && node.imageItem) {
      cloned.imageListId = node.imageListId;
      cloned.imageItem = node.imageItem;
    }
    return cloned;
  });
}`,
  'designer optional TreeView image fields'
);

replaceOne(
  'src/designer-data.js',
`  target.imageListId = binding?.imageListId ?? null;
  target.imageItem = binding?.imageItem ?? null;
  return { nodes: next, path: [...path] };`,
`  if (binding) {
    target.imageListId = binding.imageListId;
    target.imageItem = binding.imageItem;
  } else {
    delete target.imageListId;
    delete target.imageItem;
  }
  return { nodes: next, path: [...path] };`,
  'designer clear TreeView image metadata'
);

replaceOne(
  'src/designer-data.js',
`    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr, imageListId: node.imageListId ?? null, imageItem: node.imageItem ?? null });`,
`    out.push({
      path: nextPath,
      depth: nextPath.length - 1,
      labelExpr: node.labelExpr,
      ...(node.imageListId && node.imageItem ? { imageListId: node.imageListId, imageItem: node.imageItem } : {})
    });`,
  'flatten optional TreeView image fields'
);

replaceOne(
  'src/designer-data.js',
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      imageListId: binding?.imageListId ?? null,
      imageItem: binding?.imageItem ?? null,
      children: normalizeTreeNodes(node.children ?? [])
    };`,
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      ...(binding ? { imageListId: binding.imageListId, imageItem: binding.imageItem } : {}),
      children: normalizeTreeNodes(node.children ?? [])
    };`,
  'normalize optional TreeView image fields'
);

replaceOne(
  'src/designer-data.js',
  "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), imageListId: null, imageItem: null, children: [] };",
  "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), children: [] };",
  'new plain TreeView node shape'
);

replaceOne(
  'src/designer-tabs-nested.js',
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      imageListId: binding?.imageListId ?? null,
      imageItem: binding?.imageItem ?? null,
      children: normalizeTreeNodes(node.children ?? [])
    };`,
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      ...(binding ? { imageListId: binding.imageListId, imageItem: binding.imageItem } : {}),
      children: normalizeTreeNodes(node.children ?? [])
    };`,
  'nested normalize optional TreeView image fields'
);

replaceOne(
  'src/designer-tabs-nested.js',
`  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    imageListId: node.imageListId ?? null,
    imageItem: node.imageItem ?? null,
    children: cloneTreeNodes(node.children ?? [])
  }));`,
`  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    ...(node.imageListId && node.imageItem ? { imageListId: node.imageListId, imageItem: node.imageItem } : {}),
    children: cloneTreeNodes(node.children ?? [])
  }));`,
  'nested clone optional TreeView image fields'
);

console.log('Plain TreeView node object shapes preserved while retaining optional image metadata.');
