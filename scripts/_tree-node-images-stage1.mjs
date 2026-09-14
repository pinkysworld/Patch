import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
}

function once(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`Expected one anchor for ${label}, found ${count}`);
  return source.replace(needle, replacement);
}

edit('src/parser.js', source => {
  let s = once(source,
    "import { parsePatchPaintCommand } from './paintbox-control.js';",
    "import { parsePatchPaintCommand } from './paintbox-control.js';\nimport { parsePatchTreeNodeDeclaration } from './tree-node-presentation.js';",
    'parser tree presentation import');
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

edit('src/compiler.js', source => once(source,
`function lowerTreeNodes(nodes) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    line: node.line ?? null,
    children: lowerTreeNodes(node.children)
  }));
}`,
`function lowerTreeNodes(nodes) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    imageListId: node.imageListId ?? null,
    imageItem: node.imageItem ?? null,
    line: node.line ?? null,
    children: lowerTreeNodes(node.children)
  }));
}`,
  'compiler TreeView node image lowering'));

edit('src/interpreter.js', source => {
  let s = once(source,
    "nodes:node.control==='tree'?this.uiTreeNodes(node.treeNodes):[],",
    "nodes:node.control==='tree'?this.uiTreeNodes(node.treeNodes,lists):[],",
    'interpreter tree lists');
  s = once(s,
    "  uiTreeNodes(nodes){ return (nodes??[]).map(node=>({text:this.uiText(node.labelExpr),children:this.uiTreeNodes(node.children)})); }",
`  uiTreeNodes(nodes,lists=new Map()){
    return (nodes??[]).map(node=>{
      const list=node.imageListId?lists.get(node.imageListId):null;
      const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;
      return {
        text:this.uiText(node.labelExpr),
        imageListId:node.imageListId??null,
        imageItem:node.imageItem??null,
        imageSource:image?this.uiText(image.sourceExpr):'',
        imageWidth:Number(list?.logicalWidth)||16,
        imageHeight:Number(list?.logicalHeight)||16,
        children:this.uiTreeNodes(node.children,lists)
      };
    });
  }`,
    'interpreter tree model');
  return s;
});

edit('src/designer.js', source => once(source,
`function cloneTreeNodes(nodes = []) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    children: cloneTreeNodes(node.children)
  }));
}`,
`function cloneTreeNodes(nodes = []) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    imageListId: node.imageListId ?? null,
    imageItem: node.imageItem ?? null,
    children: cloneTreeNodes(node.children)
  }));
}`,
  'designer tree clone'));

edit('src/designer-data.js', source => {
  let s = once(source,
    "import { listDesignerControls } from './designer.js';",
    "import { listDesignerControls } from './designer.js';\nimport { formatPatchTreeNodeDeclaration, parseTreeNodeImageBinding } from './tree-node-presentation.js';",
    'designer data TreeView presentation import');
  s = once(s,
`export function renameTreeNode(nodes, path, labelExpr) {
  const next = normalizeTreeNodes(nodes);
  treeNodeAt(next, path).labelExpr = normalizeExpression(labelExpr, 'Tree node label');
  return { nodes: next, path: [...path] };
}`,
`export function renameTreeNode(nodes, path, labelExpr) {
  const next = normalizeTreeNodes(nodes);
  treeNodeAt(next, path).labelExpr = normalizeExpression(labelExpr, 'Tree node label');
  return { nodes: next, path: [...path] };
}

export function setTreeNodeImage(nodes, path, value) {
  const next = normalizeTreeNodes(nodes);
  const target = treeNodeAt(next, path);
  const binding = typeof value === 'string'
    ? parseTreeNodeImageBinding(value)
    : parseTreeNodeImageBinding(value?.imageListId || value?.imageItem ? `${value?.imageListId ?? ''}.${value?.imageItem ?? ''}` : '');
  target.imageListId = binding?.imageListId ?? null;
  target.imageItem = binding?.imageItem ?? null;
  return { nodes: next, path: [...path] };
}`,
    'designer set node image');
  s = once(s,
    "    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr });",
    "    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr, imageListId: node.imageListId ?? null, imageItem: node.imageItem ?? null });",
    'flatten tree image');
  s = once(s,
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      children: normalizeTreeNodes(node.children ?? [])
    };`,
`    const binding = parseTreeNodeImageBinding(node.imageListId || node.imageItem ? `${node.imageListId ?? ''}.${node.imageItem ?? ''}` : '');
    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      imageListId: binding?.imageListId ?? null,
      imageItem: binding?.imageItem ?? null,
      children: normalizeTreeNodes(node.children ?? [])
    };`,
    'normalize tree images');
  s = once(s,
    "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), children: [] };",
    "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), imageListId: null, imageItem: null, children: [] };",
    'new tree node image defaults');
  s = once(s,
    "    out.push(`${indent}${'  '.repeat(depth)}node ${node.labelExpr}`);",
    "    out.push(`${indent}${'  '.repeat(depth)}${formatPatchTreeNodeDeclaration(node)}`);",
    'render tree image source');
  return s;
});

edit('src/designer-tabs-nested.js', source => {
  let s = once(source,
    "import { listDesignerControls } from './designer.js';",
    "import { listDesignerControls } from './designer.js';\nimport { formatPatchTreeNodeDeclaration, parseTreeNodeImageBinding } from './tree-node-presentation.js';",
    'nested tree presentation import');
  s = once(s,
`    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      children: normalizeTreeNodes(node.children ?? [])
    };`,
`    const binding = parseTreeNodeImageBinding(node.imageListId || node.imageItem ? `${node.imageListId ?? ''}.${node.imageItem ?? ''}` : '');
    return {
      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),
      imageListId: binding?.imageListId ?? null,
      imageItem: binding?.imageItem ?? null,
      children: normalizeTreeNodes(node.children ?? [])
    };`,
    'nested normalize tree images');
  s = once(s,
    "    out.push(`${indent}${'  '.repeat(depth)}node ${node.labelExpr}`);",
    "    out.push(`${indent}${'  '.repeat(depth)}${formatPatchTreeNodeDeclaration(node)}`);",
    'nested render tree images');
  s = once(s,
`  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    children: cloneTreeNodes(node.children ?? [])
  }));`,
`  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    imageListId: node.imageListId ?? null,
    imageItem: node.imageItem ?? null,
    children: cloneTreeNodes(node.children ?? [])
  }));`,
    'nested clone tree images');
  return s;
});

edit('src/window-build.js', source => {
  let s = once(source,
    "import { resolveButtonImageBinding } from './button-image.js';",
    "import { resolveButtonImageBinding } from './button-image.js';\nimport { countTreeNodeImages, resolveTreeNodeImageBinding, visitTreeNodeImages } from './tree-node-presentation.js';",
    'window build tree image imports');
  s = once(s,
    '  let treeViews = 0;\n  let sliders = 0;',
    '  let treeViews = 0;\n  let treeNodeImages = 0;\n  let sliders = 0;',
    'tree node image counter');
  s = once(s,
    "    if (child.control === 'tree') treeViews += 1;",
    "    if (child.control === 'tree') { treeViews += 1; treeNodeImages += countTreeNodeImages(child.treeNodes); }",
    'count tree node images');
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
  }`,
`  for (const control of controls.values()) {
    const lists = imageListsByForm.get(control.formId) ?? new Map();
    if (control.type === 'tree') {
      try {
        visitTreeNodeImages(control.node?.treeNodes, node => resolveTreeNodeImageBinding(lists, node, node.line));
      } catch (error) {
        throw new WindowBuildError(error?.message ?? String(error));
      }
    }
    if (control.type !== 'button' || !control.node?.imageListId || !control.node?.imageItem) continue;
    try {
      resolveButtonImageBinding(
        lists,
        { imageListId: control.node.imageListId, imageItem: control.node.imageItem },
        control.node.line
      );
    } catch (error) {
      throw new WindowBuildError(error?.message ?? String(error));
    }
  }`,
    'resolve tree image bindings');
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

  if (treeNodeImages && !options.allowTreeNodeImages) {
    throw new WindowBuildError(
      'TreeView node images Stage 1 are Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not transport ImageList bindings on TreeView nodes; validation fails closed rather than silently discarding node icons.'
    );
  }
`,
    'tree node image fail closed');
  s = once(s,
    '    treeViews,\n    sliders,',
    '    treeViews,\n    treeNodeImages,\n    sliders,',
    'tree node image support result');
  return s;
});

edit('src/window-compiled.js', source => once(source,
    '    allowTree: true,\n    allowSlider: true,',
    '    allowTree: true,\n    allowTreeNodeImages: true,\n    allowSlider: true,',
    'compiled target-neutral tree images'));

edit('src/window-webapp.js', source => {
  let s = once(source,
    'validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true,',
    'validateWindowRuntimeSupport(compiled, { allowTree: true, allowTreeNodeImages: true, allowSlider: true,',
    'standalone tree image support');
  s = once(s,
    "function uiTreeNodes(nodes){return(nodes??[]).map(node=>({text:uiText(node.labelExpr),children:uiTreeNodes(node.children)}));}",
    "function uiTreeNodes(nodes,lists=new Map()){return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;return{text:uiText(node.labelExpr),imageListId:node.imageListId||null,imageItem:node.imageItem||null,imageSource:image?uiText(image.sourceExpr):'',imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children:uiTreeNodes(node.children,lists)};});}",
    'standalone tree image model');
  s = once(s,
    "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],",
    "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[],",
    'standalone tree image model lists');
  s = once(s,
    "button.textContent=node.text;button.setAttribute('aria-label',selectedPath.join(' / '));",
    "if(node.imageSource){const img=document.createElement('img');img.className='patch-tree-node-image';img.alt='';img.width=node.imageWidth||16;img.height=node.imageHeight||16;img.src=typeof patchPictureSource==='function'?patchPictureSource(node.imageSource):node.imageSource;button.appendChild(img);}button.append(node.text);button.setAttribute('aria-label',selectedPath.join(' / '));",
    'standalone tree image renderer');
  s = once(s,
    '.console{padding:20px}',
    '.body .patch-tree-node-image{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}.console{padding:20px}',
    'standalone tree image CSS');
  return s;
});

edit('web/studio-window-renderer.js', source => once(source,
`      button.textContent = node.text;
      button.dataset.patchTreePath = JSON.stringify(selectedPath);`,
`      if (node.imageSource) {
        const img = document.createElement('img');
        img.className = 'patch-tree-node-image';
        img.alt = '';
        img.width = node.imageWidth || 16;
        img.height = node.imageHeight || 16;
        try {
          img.src = pictureResourceDataUri(node.imageSource, getStudioProjectResources());
        } catch {
          img.src = node.imageSource;
        }
        button.appendChild(img);
      }
      button.append(node.text);
      button.dataset.patchTreePath = JSON.stringify(selectedPath);`,
  'studio tree node image rendering'));

edit('web/style.css', source => once(source,
  '.patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left}',
  '.patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;display:inline-flex;align-items:center;gap:6px}\n.patch-tree-node-image{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}',
  'studio tree image CSS'));

edit('web/designer-data-editor.js', source => {
  let s = once(source,
    '  renameTreeNode,\n  treeNodeAt,',
    '  renameTreeNode,\n  setTreeNodeImage,\n  treeNodeAt,',
    'top-level tree image editor import');
  s = once(s,
    '    <label class="inspector-field">Node label expression <input id="designerTreeNodeLabel" spellcheck="false" value="${escapeAttr(selected?.labelExpr ?? \'\')}"></label>\n    <div class="designer-data-actions">',
    '    <label class="inspector-field">Node label expression <input id="designerTreeNodeLabel" spellcheck="false" value="${escapeAttr(selected?.labelExpr ?? \'\')}"></label>\n    <label class="inspector-field">Node image <input id="designerTreeNodeImage" spellcheck="false" placeholder="tree_icons.folder" value="${escapeAttr(selected?.imageListId && selected?.imageItem ? `${selected.imageListId}.${selected.imageItem}` : \'\')}"></label>\n    <div class="designer-data-actions">',
    'top-level tree image field');
  s = once(s,
    "    else if (action === 'rename') result = renameTreeNode(control.treeNodes, path, panel.querySelector('#designerTreeNodeLabel')?.value ?? '');",
    "    else if (action === 'rename') { result = renameTreeNode(control.treeNodes, path, panel.querySelector('#designerTreeNodeLabel')?.value ?? ''); result = setTreeNodeImage(result.nodes, result.path, panel.querySelector('#designerTreeNodeImage')?.value ?? ''); }",
    'top-level tree image apply');
  s = once(s,
    'Ctrl/Cmd+Enter in the label applies Rename.',
    'Ctrl/Cmd+Enter in the label or image field applies the selected node source metadata.',
    'top-level tree image hint');
  return s;
});

edit('web/designer-tabs-nested.js', source => {
  let s = once(source,
    '  renameTreeNode,\n  treeNodeAt',
    '  renameTreeNode,\n  setTreeNodeImage,\n  treeNodeAt',
    'nested tree image editor import');
  s = once(s,
    '    <label class="inspector-field">Node label expression <input data-tabs-tree-label spellcheck="false" value="${escapeAttr(selected?.labelExpr ?? \'\')}"></label>\n    <div class="designer-data-actions">',
    '    <label class="inspector-field">Node label expression <input data-tabs-tree-label spellcheck="false" value="${escapeAttr(selected?.labelExpr ?? \'\')}"></label>\n    <label class="inspector-field">Node image <input data-tabs-tree-image spellcheck="false" placeholder="tree_icons.folder" value="${escapeAttr(selected?.imageListId && selected?.imageItem ? `${selected.imageListId}.${selected.imageItem}` : \'\')}"></label>\n    <div class="designer-data-actions">',
    'nested tree image field');
  s = once(s,
    "    else if (action === 'rename') result = renameTreeNode(structure.control.treeNodes, path, panel.querySelector('[data-tabs-tree-label]')?.value ?? '');",
    "    else if (action === 'rename') { result = renameTreeNode(structure.control.treeNodes, path, panel.querySelector('[data-tabs-tree-label]')?.value ?? ''); result = setTreeNodeImage(result.nodes, result.path, panel.querySelector('[data-tabs-tree-image]')?.value ?? ''); }",
    'nested tree image apply');
  return s;
});

edit('web/designer-structural-keyboard.js', source => {
  let s = once(source,
    ".designer-table-editor input, #designerTreeNodeLabel, #designerTabPageTitle, [data-tabs-tree-label]",
    ".designer-table-editor input, #designerTreeNodeLabel, #designerTreeNodeImage, #designerTabPageTitle, [data-tabs-tree-label], [data-tabs-tree-image]",
    'tree image keyboard inputs');
  s = once(s,
    "  } else if (target.matches('[data-tabs-tree-label]')) {\n    action = target.closest('[data-tabs-structure-editor=\"tree\"]')?.querySelector('[data-tabs-tree-action=\"rename\"]');\n    focusSelector = '[data-tabs-tree-label]';\n  } else if (target.id === 'designerTreeNodeLabel') {",
    "  } else if (target.matches('[data-tabs-tree-label], [data-tabs-tree-image]')) {\n    action = target.closest('[data-tabs-structure-editor=\"tree\"]')?.querySelector('[data-tabs-tree-action=\"rename\"]');\n    focusSelector = target.matches('[data-tabs-tree-image]') ? '[data-tabs-tree-image]' : '[data-tabs-tree-label]';\n  } else if (target.id === 'designerTreeNodeLabel' || target.id === 'designerTreeNodeImage') {",
    'tree image keyboard commit');
  s = once(s,
    "    focusSelector = '#designerTreeNodeLabel';",
    "    focusSelector = target.id === 'designerTreeNodeImage' ? '#designerTreeNodeImage' : '#designerTreeNodeLabel';",
    'tree image keyboard refocus');
  return s;
});

console.log('TreeView node images Stage 1 product patch applied.');
