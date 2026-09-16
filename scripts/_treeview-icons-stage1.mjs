import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
}
function once(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`Expected one anchor for ${label}, found ${count}`);
  return source.replace(from, to);
}

edit('src/parser.js', source => {
  let s = once(source,
    "import { parsePatchButtonDeclaration } from './button-image.js';",
    "import { parsePatchButtonDeclaration } from './button-image.js';\nimport { parsePatchTreeNodeDeclaration } from './tree-node-image.js';",
    'parser tree image import');
  s = once(s,
`      const match = child.text.match(/^node\\s+(.+)$/);
      if (!match) throw new PatchSyntaxError('A tree can only contain nodes like node "src".', child.line);
      i += 1;
      const children = i < lines.length && lines[i].indent > nodeIndent ? treeNodesAt(lines[i].indent) : [];
      nodes.push({ labelExpr:match[1], children, line:child.line });`,
`      let parsed;
      try {
        parsed = parsePatchTreeNodeDeclaration(child.text);
      } catch (error) {
        throw new PatchSyntaxError(error?.message ?? String(error), child.line);
      }
      i += 1;
      const children = i < lines.length && lines[i].indent > nodeIndent ? treeNodesAt(lines[i].indent) : [];
      nodes.push({
        labelExpr: parsed.labelExpr,
        imageListId: parsed.imageListId,
        imageItem: parsed.imageItem,
        children,
        line: child.line
      });`,
    'parser tree node declaration');
  return s;
});

edit('src/designer-data.js', source => {
  let s = once(source,
    "import { listDesignerControls } from './designer.js';",
    "import { listDesignerControls } from './designer.js';\nimport { formatPatchTreeNodeDeclaration } from './tree-node-image.js';",
    'designer tree image import');
  s = once(s,
    "    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr });",
    "    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr, imageListId: node.imageListId ?? null, imageItem: node.imageItem ?? null });",
    'flatten tree image metadata');
  s = once(s,
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      children: normalizeTreeNodes(node.children ?? [])
    };`,
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      imageListId: node.imageListId ? String(node.imageListId).trim() : null,
      imageItem: node.imageItem ? String(node.imageItem).trim() : null,
      children: normalizeTreeNodes(node.children ?? [])
    };`,
    'normalize tree image metadata');
  s = once(s,
    "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), children: [] };",
    "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), imageListId: null, imageItem: null, children: [] };",
    'new tree node defaults');
  s = once(s,
    "    out.push(`${indent}${'  '.repeat(depth)}node ${node.labelExpr}`);",
    "    out.push(`${indent}${'  '.repeat(depth)}${formatPatchTreeNodeDeclaration(node)}`);",
    'render tree image metadata');
  return s;
});

for (const path of ['src/designer.js', 'src/designer-tabs-nested.js']) {
  edit(path, source => {
    const needle = `    labelExpr: node.labelExpr,\n    children: cloneTreeNodes(node.children`;
    const replacement = `    labelExpr: node.labelExpr,\n    imageListId: node.imageListId ?? null,\n    imageItem: node.imageItem ?? null,\n    children: cloneTreeNodes(node.children`;
    return once(source, needle, replacement, `${path} clone tree image metadata`);
  });
}

edit('src/interpreter.js', source => {
  let s = once(source,
    "          nodes:node.control==='tree'?this.uiTreeNodes(node.treeNodes):[],",
    "          nodes:node.control==='tree'?this.uiTreeNodes(node.treeNodes,lists):[],",
    'interpreter tree lists');
  s = once(s,
    "  uiTreeNodes(nodes){ return (nodes??[]).map(node=>({text:this.uiText(node.labelExpr),children:this.uiTreeNodes(node.children)})); }",
    "  uiTreeNodes(nodes,lists=new Map()){ return (nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;return {text:this.uiText(node.labelExpr),imageSource:image?this.uiText(image.sourceExpr):'',imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children:this.uiTreeNodes(node.children,lists)};}); }",
    'interpreter tree image model');
  return s;
});

edit('web/studio-window-renderer.js', source => {
  return once(source,
`      button.type = 'button';
      button.className = 'patch-tree-node';
      button.textContent = node.text;
      button.dataset.patchTreePath = JSON.stringify(selectedPath);`,
`      button.type = 'button';
      button.className = 'patch-tree-node';
      if (node.imageSource) {
        const image = document.createElement('img');
        image.className = 'patch-tree-node-icon';
        image.alt = '';
        image.width = node.imageWidth || 16;
        image.height = node.imageHeight || 16;
        image.style.objectFit = 'contain';
        image.style.flex = '0 0 auto';
        try { image.src = pictureResourceDataUri(node.imageSource, getStudioProjectResources()); }
        catch { image.src = node.imageSource; }
        button.appendChild(image);
      }
      const label = document.createElement('span');
      label.textContent = node.text;
      button.appendChild(label);
      button.dataset.patchTreePath = JSON.stringify(selectedPath);`,
    'Studio tree node image renderer');
});

edit('src/window-build.js', source => {
  let s = once(source,
    "import { resolveButtonImageBinding } from './button-image.js';",
    "import { resolveButtonImageBinding } from './button-image.js';\nimport { countTreeNodeImages, resolveTreeNodeImageBinding, walkTreeNodes } from './tree-node-image.js';",
    'window build tree image import');
  s = once(s,
    "  let treeViews = 0;\n  let sliders = 0;",
    "  let treeViews = 0;\n  let treeNodeImages = 0;\n  let sliders = 0;",
    'tree image counter');
  s = once(s,
    "    if (child.control === 'tree') treeViews += 1;",
    "    if (child.control === 'tree') { treeViews += 1; treeNodeImages += countTreeNodeImages(child.treeNodes); }",
    'register tree images');
  s = once(s,
`  for (const control of controls.values()) {
    if (control.type !== 'button' || !control.node?.imageListId || !control.node?.imageItem) continue;
    try {
      resolveButtonImageBinding(
        imageListsByForm.get(control.formId) ?? new Map(),
        { imageListId: control.node.imageListId, imageItem: control.node.imageItem },
        control.node.line
      );
    } catch (error) {
      throw new WindowBuildError(error?.message ?? String(error));
    }
  }
`,
`  for (const control of controls.values()) {
    if (control.type !== 'button' || !control.node?.imageListId || !control.node?.imageItem) continue;
    try {
      resolveButtonImageBinding(
        imageListsByForm.get(control.formId) ?? new Map(),
        { imageListId: control.node.imageListId, imageItem: control.node.imageItem },
        control.node.line
      );
    } catch (error) {
      throw new WindowBuildError(error?.message ?? String(error));
    }
  }

  for (const control of controls.values()) {
    if (control.type !== 'tree') continue;
    try {
      walkTreeNodes(control.node?.treeNodes, node => {
        if (node.imageListId && node.imageItem) resolveTreeNodeImageBinding(imageListsByForm.get(control.formId) ?? new Map(), node, node.line);
      });
    } catch (error) {
      throw new WindowBuildError(error?.message ?? String(error));
    }
  }
`,
    'validate tree image references');
  s = once(s,
`  if (treeViews && !options.allowTree) {
    throw new WindowBuildError(
      'TreeView is not enabled for this Window target. Select a TreeView-capable target or enable its versioned TreeView runtime contract; validation fails closed otherwise.'
    );
  }
`,
`  if (treeViews && !options.allowTree) {
    throw new WindowBuildError(
      'TreeView is not enabled for this Window target. Select a TreeView-capable target or enable its versioned TreeView runtime contract; validation fails closed otherwise.'
    );
  }

  if (treeNodeImages && !options.allowTreeImages) {
    throw new WindowBuildError(
      'TreeView node images Stage 1 is Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not transport per-node ImageList bindings for TreeView; validation fails closed rather than silently dropping node icons.'
    );
  }
`,
    'tree image fail closed');
  s = once(s,
    "    treeViews,\n    sliders,",
    "    treeViews,\n    treeNodeImages,\n    sliders,",
    'tree image report');
  return s;
});

for (const path of ['src/window-webapp.js', 'src/window-compiled.js']) {
  edit(path, source => once(source,
    'allowTree: true,',
    'allowTree: true, allowTreeImages: true,',
    `${path} tree image target opt-in`));
}

edit('src/window-webapp.js', source => {
  let s = source;
  s = once(s,
    "function uiTreeNodes(nodes){return(nodes??[]).map(node=>({text:uiText(node.labelExpr),children:uiTreeNodes(node.children)}));}",
    "function uiTreeNodes(nodes,lists=new Map()){return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;return{text:uiText(node.labelExpr),imageSource:image?uiText(image.sourceExpr):'',imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children:uiTreeNodes(node.children,lists)};});}",
    'Standalone tree image model function');
  s = once(s,
    "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],",
    "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[],",
    'Standalone tree lists model call');
  s = once(s,
    "button.className='patch-tree-node';button.textContent=node.text;button.setAttribute('aria-label',selectedPath.join(' / '));",
    "button.className='patch-tree-node';if(node.imageSource){const image=document.createElement('img');image.className='patch-tree-node-icon';image.alt='';image.width=node.imageWidth||16;image.height=node.imageHeight||16;image.src=typeof patchPictureSource==='function'?patchPictureSource(node.imageSource):node.imageSource;button.appendChild(image);}const label=document.createElement('span');label.textContent=node.text;button.appendChild(label);button.setAttribute('aria-label',selectedPath.join(' / '));",
    'Standalone tree icon renderer');
  s = once(s,
    ".body .patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:#18181b;font-weight:650;text-align:left}",
    ".body .patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:#18181b;font-weight:650;text-align:left;display:inline-flex;align-items:center;gap:7px}.body .patch-tree-node-icon{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}",
    'Standalone tree icon CSS');
  return s;
});

edit('src/webapp.js', source => {
  let s = once(source,
`  const pictures = hasPicture(ast);
  const buttonImages = hasButtonImage(ast);
  const windowIcons = collectWindowIcons(ast);
  const paintImages = hasPaintImage(ast);
  if (!pictures && !buttonImages && !windowIcons.length && !paintImages) return built;`,
`  const pictures = hasPicture(ast);
  const buttonImages = hasButtonImage(ast);
  const treeImages = hasTreeNodeImage(ast);
  const windowIcons = collectWindowIcons(ast);
  const paintImages = hasPaintImage(ast);
  if (!pictures && !buttonImages && !treeImages && !windowIcons.length && !paintImages) return built;`,
    'webapp tree images trigger');
  s = once(s,
    "  if (buttonImages) validateStaticButtonImageReferences(ast, normalized);",
    "  if (buttonImages) validateStaticButtonImageReferences(ast, normalized);\n  if (treeImages) validateStaticTreeNodeImageReferences(ast, normalized);",
    'webapp tree image validation');
  s = once(s,
`      ...(buttonImages ? {
        buttonImageStage: 1,
        buttonImageResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source',
        buttonImageResourceCount: collectButtonImageResourceIds(ast).length
      } : {}),`,
`      ...(buttonImages ? {
        buttonImageStage: 1,
        buttonImageResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source',
        buttonImageResourceCount: collectButtonImageResourceIds(ast).length
      } : {}),
      ...(treeImages ? {
        treeNodeImageStage: 1,
        treeNodeImageVersion: '0.1',
        treeNodeImageMode: 'imagelist-node-binding',
        treeNodeImageResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source'
      } : {}),`,
    'webapp tree image metadata');
  s = once(s,
`function hasButtonImage(nodes) {
  let found = false;
  walkPictureNodes(nodes, node => {
    if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) found = true;
  });
  return found;
}
`,
`function hasButtonImage(nodes) {
  let found = false;
  walkPictureNodes(nodes, node => {
    if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) found = true;
  });
  return found;
}

function hasTreeNodeImage(nodes) {
  let found = false;
  const visit = treeNodes => {
    for (const node of treeNodes ?? []) {
      if (node.imageListId && node.imageItem) found = true;
      visit(node.children);
    }
  };
  walkPictureNodes(nodes, node => {
    if (node.kind === 'uiControl' && node.control === 'tree') visit(node.treeNodes);
  });
  return found;
}

function validateStaticTreeNodeImageReferences(ast, resources) {
  const ids = new Set(resources.map(resource => resource.id));
  const visitTree = (treeNodes, lists) => {
    for (const node of treeNodes ?? []) {
      if (node.imageListId && node.imageItem) {
        const list = lists.get(node.imageListId);
        const item = (list?.items ?? []).find(entry => entry.name === node.imageItem);
        const source = quotedPictureValue(item?.sourceExpr);
        if (source?.startsWith(PICTURE_RESOURCE_PREFIX)) {
          const id = source.slice(PICTURE_RESOURCE_PREFIX.length);
          if (!ids.has(id)) throw new Error(`line ${node.line ?? '?'}: TreeView node image ${node.imageListId}.${node.imageItem} references missing project resource '${id}'.`);
        }
      }
      visitTree(node.children, lists);
    }
  };
  for (const windowNode of (ast ?? []).filter(node => node.kind === 'window')) {
    const lists = new Map((windowNode.body ?? []).filter(node => node.kind === 'uiControl' && node.control === 'imagelist' && node.id).map(node => [node.id, node]));
    walkPictureNodes([windowNode], node => { if (node.kind === 'uiControl' && node.control === 'tree') visitTree(node.treeNodes, lists); });
  }
}
`,
    'webapp tree image helpers');
  return s;
});

console.log('TreeView icons Stage 1 core patch applied.');
