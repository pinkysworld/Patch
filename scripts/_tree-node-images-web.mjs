import fs from 'node:fs';

function once(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`Expected one anchor for ${label}, found ${count}`);
  return source.replace(needle, replacement);
}

const path = 'src/webapp.js';
let source = fs.readFileSync(path, 'utf8');
source = once(source,
`  const pictures = hasPicture(ast);
  const buttonImages = hasButtonImage(ast);
  const windowIcons = collectWindowIcons(ast);
  const paintImages = hasPaintImage(ast);
  if (!pictures && !buttonImages && !windowIcons.length && !paintImages) return built;`,
`  const pictures = hasPicture(ast);
  const buttonImages = hasButtonImage(ast);
  const treeNodeImages = hasTreeNodeImage(ast);
  const windowIcons = collectWindowIcons(ast);
  const paintImages = hasPaintImage(ast);
  if (!pictures && !buttonImages && !treeNodeImages && !windowIcons.length && !paintImages) return built;`,
  'web tree image detection');
source = once(source,
`  if (pictures) validateStaticPictureReferences(ast, normalized);
  if (buttonImages) validateStaticButtonImageReferences(ast, normalized);
  if (windowIcons.length) validateStaticWindowIconReferences(ast, normalized);`,
`  if (pictures) validateStaticPictureReferences(ast, normalized);
  if (buttonImages) validateStaticButtonImageReferences(ast, normalized);
  if (treeNodeImages) validateStaticTreeNodeImageReferences(ast, normalized);
  if (windowIcons.length) validateStaticWindowIconReferences(ast, normalized);`,
  'web tree image validation');
source = once(source,
`      ...(buttonImages ? {
        buttonImageStage: 1,
        buttonImageResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source',
        buttonImageResourceCount: collectButtonImageResourceIds(ast).length
      } : {}),
      ...(windowIcons.length ? {`,
`      ...(buttonImages ? {
        buttonImageStage: 1,
        buttonImageResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source',
        buttonImageResourceCount: collectButtonImageResourceIds(ast).length
      } : {}),
      ...(treeNodeImages ? {
        treeNodePresentationStage: 1,
        treeNodePresentationVersion: '0.1',
        treeNodePresentationMode: 'source-backed-imagelist-binding',
        treeNodeImageResourceCount: collectTreeNodeImageResourceIds(ast).length
      } : {}),
      ...(windowIcons.length ? {`,
  'web tree image metadata');
source = once(source,
`function hasButtonImage(nodes) {
  let found = false;
  walkPictureNodes(nodes, node => {
    if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) found = true;
  });
  return found;
}

function collectButtonImageResourceIds(ast) {`,
`function hasButtonImage(nodes) {
  let found = false;
  walkPictureNodes(nodes, node => {
    if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) found = true;
  });
  return found;
}

function hasTreeNodeImage(nodes) {
  let found = false;
  walkPictureNodes(nodes, node => {
    if (node.kind !== 'uiControl' || node.control !== 'tree') return;
    walkTreeNodeImages(node.treeNodes, () => { found = true; });
  });
  return found;
}

function collectTreeNodeImageResourceIds(ast) {
  const ids = [];
  const windows = (ast ?? []).filter(node => node.kind === 'window');
  for (const windowNode of windows) {
    const lists = new Map();
    for (const child of windowNode.body ?? []) {
      if (child.kind === 'uiControl' && child.control === 'imagelist' && child.id) lists.set(child.id, child);
    }
    walkPictureNodes([windowNode], node => {
      if (node.kind !== 'uiControl' || node.control !== 'tree') return;
      walkTreeNodeImages(node.treeNodes, treeNode => {
        const item = (lists.get(treeNode.imageListId)?.items ?? []).find(entry => entry.name === treeNode.imageItem);
        if (item?.resourceId) ids.push(item.resourceId);
      });
    });
  }
  return ids;
}

function collectButtonImageResourceIds(ast) {`,
  'web tree image helpers');
source = once(source,
`function validateStaticButtonImageReferences(ast, resources) {
  const ids = new Set(resources.map(resource => resource.id));
  const windows = (ast ?? []).filter(node => node.kind === 'window');
  for (const windowNode of windows) {
    const lists = new Map();
    for (const child of windowNode.body ?? []) {
      if (child.kind === 'uiControl' && child.control === 'imagelist' && child.id) lists.set(child.id, child);
    }
    walkPictureNodes([windowNode], node => {
      if (node.kind !== 'uiControl' || node.control !== 'button' || !node.imageListId || !node.imageItem) return;
      const list = lists.get(node.imageListId);
      const item = (list?.items ?? []).find(entry => entry.name === node.imageItem);
      const source = quotedPictureValue(item?.sourceExpr);
      if (!source?.startsWith(PICTURE_RESOURCE_PREFIX)) return;
      const id = source.slice(PICTURE_RESOURCE_PREFIX.length);
      if (!ids.has(id)) {
        throw new Error(\`line \${node.line ?? '?'}: Button '\${node.id ?? 'unnamed'}' image \${node.imageListId}.\${node.imageItem} references missing project resource '\${id}'.\`);
      }
    });
  }
}

function validateStaticWindowIconReferences`,
`function validateStaticButtonImageReferences(ast, resources) {
  const ids = new Set(resources.map(resource => resource.id));
  const windows = (ast ?? []).filter(node => node.kind === 'window');
  for (const windowNode of windows) {
    const lists = new Map();
    for (const child of windowNode.body ?? []) {
      if (child.kind === 'uiControl' && child.control === 'imagelist' && child.id) lists.set(child.id, child);
    }
    walkPictureNodes([windowNode], node => {
      if (node.kind !== 'uiControl' || node.control !== 'button' || !node.imageListId || !node.imageItem) return;
      const list = lists.get(node.imageListId);
      const item = (list?.items ?? []).find(entry => entry.name === node.imageItem);
      const source = quotedPictureValue(item?.sourceExpr);
      if (!source?.startsWith(PICTURE_RESOURCE_PREFIX)) return;
      const id = source.slice(PICTURE_RESOURCE_PREFIX.length);
      if (!ids.has(id)) {
        throw new Error(\`line \${node.line ?? '?'}: Button '\${node.id ?? 'unnamed'}' image \${node.imageListId}.\${node.imageItem} references missing project resource '\${id}'.\`);
      }
    });
  }
}

function validateStaticTreeNodeImageReferences(ast, resources) {
  const ids = new Set(resources.map(resource => resource.id));
  const windows = (ast ?? []).filter(node => node.kind === 'window');
  for (const windowNode of windows) {
    const lists = new Map();
    for (const child of windowNode.body ?? []) {
      if (child.kind === 'uiControl' && child.control === 'imagelist' && child.id) lists.set(child.id, child);
    }
    walkPictureNodes([windowNode], node => {
      if (node.kind !== 'uiControl' || node.control !== 'tree') return;
      walkTreeNodeImages(node.treeNodes, treeNode => {
        const item = (lists.get(treeNode.imageListId)?.items ?? []).find(entry => entry.name === treeNode.imageItem);
        const source = quotedPictureValue(item?.sourceExpr);
        if (!source?.startsWith(PICTURE_RESOURCE_PREFIX)) return;
        const id = source.slice(PICTURE_RESOURCE_PREFIX.length);
        if (!ids.has(id)) {
          throw new Error(\`line \${treeNode.line ?? '?'}: TreeView node image \${treeNode.imageListId}.\${treeNode.imageItem} references missing project resource '\${id}'.\`);
        }
      });
    });
  }
}

function walkTreeNodeImages(nodes, visit) {
  for (const node of nodes ?? []) {
    if (node?.imageListId && node?.imageItem) visit(node);
    walkTreeNodeImages(node?.children, visit);
  }
}

function validateStaticWindowIconReferences`,
  'web tree image resource validation');
fs.writeFileSync(path, source);
console.log('TreeView node images standalone Web patch applied.');
