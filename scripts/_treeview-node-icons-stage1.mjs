import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
}
function once(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Ambiguous anchor: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

edit('src/parser.js', s => {
  s = once(s,
    "import { parsePatchButtonDeclaration } from './button-image.js';",
    "import { parsePatchButtonDeclaration } from './button-image.js';\nimport { parsePatchTreeNodeDeclaration } from './tree-node-image.js';",
    'parser Tree node import');
  return once(s,
    "      const match = child.text.match(/^node\\s+(.+)$/);\n      if (!match) throw new PatchSyntaxError('A tree can only contain nodes like node \"src\".', child.line);\n      i += 1;\n      const children = i < lines.length && lines[i].indent > nodeIndent ? treeNodesAt(lines[i].indent) : [];\n      nodes.push({ labelExpr:match[1], children, line:child.line });",
    "      let parsed;\n      try {\n        parsed = parsePatchTreeNodeDeclaration(child.text);\n      } catch (error) {\n        throw new PatchSyntaxError(error?.message ?? String(error), child.line);\n      }\n      i += 1;\n      const children = i < lines.length && lines[i].indent > nodeIndent ? treeNodesAt(lines[i].indent) : [];\n      nodes.push({ labelExpr:parsed.labelExpr, imageListId:parsed.imageListId, imageItem:parsed.imageItem, children, line:child.line });",
    'parser Tree node declaration');
});

edit('src/compiler.js', s => {
  s = once(s,
    "    labelExpr: node.labelExpr,\n    line: node.line ?? null,\n    children: lowerTreeNodes(node.children)",
    "    labelExpr: node.labelExpr,\n    imageListId: node.imageListId ?? null,\n    imageItem: node.imageItem ?? null,\n    line: node.line ?? null,\n    children: lowerTreeNodes(node.children)",
    'compiler Tree node lowering');
  return once(s,
    "    if (node.kind === 'uiControl' && node.control === 'tree') caps.add('ui.tree');",
    "    if (node.kind === 'uiControl' && node.control === 'tree') { caps.add('ui.tree'); if (hasTreeNodeImages(node.treeNodes)) caps.add('ui.tree-node-image'); }",
    'compiler Tree node capability');
});

edit('src/compiler.js', s => once(s,
  "function op(code, node, fields = {}) { return { code, line: node.line ?? null, ...fields }; }",
  "function hasTreeNodeImages(nodes) { return (nodes ?? []).some(node => (node.imageListId && node.imageItem) || hasTreeNodeImages(node.children)); }\n\nfunction op(code, node, fields = {}) { return { code, line: node.line ?? null, ...fields }; }",
  'compiler Tree icon helper'));

edit('src/designer-data.js', s => {
  s = once(s,
    "import { listDesignerControls } from './designer.js';",
    "import { listDesignerControls } from './designer.js';\nimport { formatPatchTreeNodeDeclaration, normalizeTreeNodeImageBinding, parseTreeNodeImageBinding } from './tree-node-image.js';",
    'designer data Tree image import');
  s = once(s,
    "export function renameTreeNode(nodes, path, labelExpr) {\n  const next = normalizeTreeNodes(nodes);\n  treeNodeAt(next, path).labelExpr = normalizeExpression(labelExpr, 'Tree node label');\n  return { nodes: next, path: [...path] };\n}",
    "export function renameTreeNode(nodes, path, labelExpr) {\n  const next = normalizeTreeNodes(nodes);\n  treeNodeAt(next, path).labelExpr = normalizeExpression(labelExpr, 'Tree node label');\n  return { nodes: next, path: [...path] };\n}\n\nexport function setTreeNodeImage(nodes, path, value) {\n  const next = normalizeTreeNodes(nodes);\n  const target = treeNodeAt(next, path);\n  const binding = parseTreeNodeImageBinding(value);\n  target.imageListId = binding?.imageListId ?? null;\n  target.imageItem = binding?.imageItem ?? null;\n  return { nodes: next, path: [...path] };\n}",
    'designer set Tree node image');
  s = once(s,
    "    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr });",
    "    out.push({ path: nextPath, depth: nextPath.length - 1, labelExpr: node.labelExpr, imageListId: node.imageListId ?? null, imageItem: node.imageItem ?? null });",
    'designer flatten Tree image');
  s = once(s,
    "    return {\n      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),\n      children: normalizeTreeNodes(node.children ?? [])\n    };",
    "    const binding = normalizeTreeNodeImageBinding(node);\n    return {\n      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),\n      imageListId: binding.imageListId,\n      imageItem: binding.imageItem,\n      children: normalizeTreeNodes(node.children ?? [])\n    };",
    'designer normalize Tree image');
  s = once(s,
    "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), children: [] };",
    "  return { labelExpr: normalizeExpression(labelExpr, 'Tree node label'), imageListId: null, imageItem: null, children: [] };",
    'designer new Tree node image defaults');
  return once(s,
    "    out.push(`${indent}${'  '.repeat(depth)}node ${node.labelExpr}`);",
    "    out.push(`${indent}${'  '.repeat(depth)}${formatPatchTreeNodeDeclaration(node)}`);",
    'designer render Tree image');
});

edit('src/designer-tabs-nested.js', s => {
  s = once(s,
    "import { parse } from './parser.js';",
    "import { parse } from './parser.js';\nimport { formatPatchTreeNodeDeclaration, normalizeTreeNodeImageBinding } from './tree-node-image.js';",
    'nested designer Tree image import');
  s = once(s,
    "  return (nodes ?? []).map(node => ({\n    labelExpr: node.labelExpr,\n    children: cloneTreeNodes(node.children ?? [])\n  }));",
    "  return (nodes ?? []).map(node => ({\n    labelExpr: node.labelExpr,\n    imageListId: node.imageListId ?? null,\n    imageItem: node.imageItem ?? null,\n    children: cloneTreeNodes(node.children ?? [])\n  }));",
    'nested clone Tree image');
  s = once(s,
    "    return {\n      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),\n      children: normalizeTreeNodes(node.children ?? [])\n    };",
    "    const binding = normalizeTreeNodeImageBinding(node);\n    return {\n      labelExpr: normalizeExpression(node.labelExpr, 'Tree node label'),\n      imageListId: binding.imageListId,\n      imageItem: binding.imageItem,\n      children: normalizeTreeNodes(node.children ?? [])\n    };",
    'nested normalize Tree image');
  return once(s,
    "    out.push(`${indent}${'  '.repeat(depth)}node ${node.labelExpr}`);",
    "    out.push(`${indent}${'  '.repeat(depth)}${formatPatchTreeNodeDeclaration(node)}`);",
    'nested render Tree image');
});

edit('src/designer.js', s => once(s,
  "  return (nodes ?? []).map(node => ({\n    labelExpr: node.labelExpr,\n    children: cloneTreeNodes(node.children)\n  }));",
  "  return (nodes ?? []).map(node => ({\n    labelExpr: node.labelExpr,\n    imageListId: node.imageListId ?? null,\n    imageItem: node.imageItem ?? null,\n    children: cloneTreeNodes(node.children)\n  }));",
  'designer clone Tree image'));

edit('src/interpreter.js', s => {
  s = once(s,
    "nodes:node.control==='tree'?this.uiTreeNodes(node.treeNodes):[],",
    "nodes:node.control==='tree'?this.uiTreeNodes(node.treeNodes,lists):[],",
    'interpreter Tree nodes model');
  return once(s,
    "  uiTreeNodes(nodes){ return (nodes??[]).map(node=>({text:this.uiText(node.labelExpr),children:this.uiTreeNodes(node.children)})); }",
    "  uiTreeNodes(nodes,lists=new Map()){ return (nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const resolved=node.imageListId&&node.imageItem?(list?.items??[]).find(image=>image.name===node.imageItem):null;const icon=resolved?.resourceId?`patch-resource:${resolved.resourceId}`:(resolved?.sourceExpr?this.uiText(resolved.sourceExpr):'');return {text:this.uiText(node.labelExpr),imageListId:node.imageListId??null,imageItem:node.imageItem??null,icon,iconWidth:Number(list?.logicalWidth)||16,iconHeight:Number(list?.logicalHeight)||16,children:this.uiTreeNodes(node.children,lists)};}); }",
    'interpreter Tree icon UI model');
});

edit('src/window-build.js', s => {
  s = once(s,
    "import { resolveButtonImageBinding } from './button-image.js';",
    "import { resolveButtonImageBinding } from './button-image.js';\nimport { countTreeNodeImageBindings, resolveTreeNodeImageBinding } from './tree-node-image.js';",
    'window build Tree icon import');
  s = once(s,
    "  let treeViews = 0;",
    "  let treeViews = 0;\n  let treeNodeImages = 0;",
    'window build Tree icon counter');
  s = once(s,
    "    if (child.control === 'tree') treeViews += 1;",
    "    if (child.control === 'tree') { treeViews += 1; treeNodeImages += countTreeNodeImageBindings(child.treeNodes); }",
    'window build Tree icon count');
  s = once(s,
    "  for (const event of events) {",
    "  for (const control of controls.values()) {\n    if (control.type !== 'tree') continue;\n    const lists = imageListsByForm.get(control.formId) ?? new Map();\n    const visitTree = nodes => {\n      for (const node of nodes ?? []) {\n        if (node.imageListId && node.imageItem) {\n          try { resolveTreeNodeImageBinding(lists, node, node.line); }\n          catch (error) { throw new WindowBuildError(error?.message ?? String(error)); }\n        }\n        visitTree(node.children);\n      }\n    };\n    visitTree(control.node?.treeNodes);\n  }\n\n  for (const event of events) {",
    'window build Tree icon validation');
  s = once(s,
    "  if (sliders && !options.allowSlider) {",
    "  if (treeNodeImages && !options.allowTreeNodeImages) {\n    throw new WindowBuildError(\n      'TreeView node icons Stage 1 are Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not transport ImageList-backed TreeView node icons; validation fails closed rather than silently dropping node imagery.'\n    );\n  }\n\n  if (sliders && !options.allowSlider) {",
    'window build Tree icon fail closed');
  return once(s,
    "    treeViews,\n    sliders,",
    "    treeViews,\n    treeNodeImages,\n    sliders,",
    'window build Tree icon report');
});

for (const path of ['src/window-webapp.js', 'src/window-compiled.js']) {
  edit(path, s => once(s,
    'allowTree: true,',
    'allowTree: true, allowTreeNodeImages: true,',
    `${path} allow Tree node icons`));
}

edit('src/window-webapp.js', s => {
  s = once(s,
    "function uiTreeNodes(nodes){return(nodes??[]).map(node=>({text:uiText(node.labelExpr),children:uiTreeNodes(node.children)}));}",
    "function uiTreeNodes(nodes,lists){return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;return{text:uiText(node.labelExpr),imageListId:node.imageListId||null,imageItem:node.imageItem||null,imageSource:image?uiText(image.sourceExpr):'',imageWidth:Number(list?.logicalWidth)||16,imageHeight:Number(list?.logicalHeight)||16,children:uiTreeNodes(node.children,lists)};});}",
    'window web Tree icon UI model');
  s = once(s,
    "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],",
    "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes,lists):[],",
    'window web Tree icon model call');
  s = once(s,
    "const button=document.createElement('button');button.type='button';button.className='patch-tree-node';button.textContent=node.text;button.setAttribute('aria-label',selectedPath.join(' / '));",
    "const button=document.createElement('button');button.type='button';button.className='patch-tree-node';if(node.imageSource){const img=document.createElement('img');img.className='patch-tree-node-icon';img.alt='';img.width=node.imageWidth||16;img.height=node.imageHeight||16;img.src=typeof patchPictureSource==='function'?patchPictureSource(node.imageSource):node.imageSource;button.appendChild(img);}const label=document.createElement('span');label.className='patch-tree-node-label';label.textContent=node.text;button.appendChild(label);button.setAttribute('aria-label',selectedPath.join(' / '));",
    'window web Tree icon renderer');
  s = once(s,
    ".body .patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:#18181b;font-weight:650;text-align:left}",
    ".body .patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:#18181b;font-weight:650;text-align:left;display:inline-flex;align-items:center;gap:6px}.patch-tree-node-icon{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}",
    'window web Tree icon CSS');
  return s;
});

edit('src/webapp.js', s => {
  s = once(s,
    "  const buttonImages = hasButtonImage(ast);\n  const windowIcons = collectWindowIcons(ast);",
    "  const buttonImages = hasButtonImage(ast);\n  const treeNodeImages = hasTreeNodeImage(ast);\n  const windowIcons = collectWindowIcons(ast);",
    'webapp Tree icon detection');
  s = once(s,
    "  if (!pictures && !buttonImages && !windowIcons.length && !paintImages) return built;",
    "  if (!pictures && !buttonImages && !treeNodeImages && !windowIcons.length && !paintImages) return built;",
    'webapp Tree icon resource activation');
  s = once(s,
    "  if (buttonImages) validateStaticButtonImageReferences(ast, normalized);",
    "  if (buttonImages) validateStaticButtonImageReferences(ast, normalized);\n  if (treeNodeImages) validateStaticTreeNodeImageReferences(ast, normalized);",
    'webapp Tree icon static validation');
  s = once(s,
    "      ...(windowIcons.length ? {",
    "      ...(treeNodeImages ? {\n        treeNodeImageStage: 1,\n        treeNodeImageVersion: '0.1',\n        treeNodeImageMode: 'source-backed-imagelist-binding',\n        treeNodeImageResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source'\n      } : {}),\n      ...(windowIcons.length ? {",
    'webapp Tree icon metadata');
  s = once(s,
    "function collectButtonImageResourceIds(ast) {",
    "function hasTreeNodeImage(nodes) {\n  const inspect = treeNodes => (treeNodes ?? []).some(node => (node.imageListId && node.imageItem) || inspect(node.children));\n  let found = false;\n  walkPictureNodes(nodes, node => { if (node.kind === 'uiControl' && node.control === 'tree' && inspect(node.treeNodes)) found = true; });\n  return found;\n}\n\nfunction validateStaticTreeNodeImageReferences(ast, resources) {\n  const ids = new Set(resources.map(resource => resource.id));\n  const visit = (nodes, lists) => {\n    for (const node of nodes ?? []) {\n      if (node.imageListId && node.imageItem) {\n        const list = lists.get(node.imageListId);\n        const item = (list?.items ?? []).find(entry => entry.name === node.imageItem);\n        const source = quotedPictureValue(item?.sourceExpr);\n        if (source?.startsWith(PICTURE_RESOURCE_PREFIX)) {\n          const id = source.slice(PICTURE_RESOURCE_PREFIX.length);\n          if (!ids.has(id)) throw new Error(`line ${node.line ?? '?'}: TreeView node image ${node.imageListId}.${node.imageItem} references missing project resource '${id}'.`);\n        }\n      }\n      visit(node.children, lists);\n    }\n  };\n  for (const windowNode of (ast ?? []).filter(node => node.kind === 'window')) {\n    const lists = new Map((windowNode.body ?? []).filter(node => node.kind === 'uiControl' && node.control === 'imagelist' && node.id).map(node => [node.id, node]));\n    walkPictureNodes([windowNode], node => { if (node.kind === 'uiControl' && node.control === 'tree') visit(node.treeNodes, lists); });\n  }\n}\n\nfunction collectButtonImageResourceIds(ast) {",
    'webapp Tree icon validation helpers');
  return s;
});

edit('web/studio-window-renderer.js', s => once(s,
  "      button.className = 'patch-tree-node';\n      button.textContent = node.text;",
  "      button.className = 'patch-tree-node';\n      if (node.icon) {\n        const img = document.createElement('img');\n        img.className = 'patch-tree-node-icon';\n        img.alt = '';\n        img.width = node.iconWidth || 16;\n        img.height = node.iconHeight || 16;\n        try { img.src = pictureResourceDataUri(node.icon, getStudioProjectResources()); } catch { img.src = node.icon; }\n        button.appendChild(img);\n      }\n      const label = document.createElement('span');\n      label.className = 'patch-tree-node-label';\n      label.textContent = node.text;\n      button.appendChild(label);",
  'Studio Tree icon renderer'));

edit('web/style.css', s => once(s,
  ".patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left}",
  ".patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left;display:inline-flex;align-items:center;gap:6px}\n.patch-tree-node-icon{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}",
  'Studio Tree icon CSS'));

edit('web/designer-data-editor.js', s => {
  s = once(s,
    "  renameTreeNode,\n  treeNodeAt,",
    "  renameTreeNode,\n  setTreeNodeImage,\n  treeNodeAt,",
    'Tree editor set image import');
  s = once(s,
    "    <label class=\"inspector-field\">Node label expression <input id=\"designerTreeNodeLabel\" spellcheck=\"false\" value=\"${escapeAttr(selected?.labelExpr ?? '')}\"></label>",
    "    <label class=\"inspector-field\">Node label expression <input id=\"designerTreeNodeLabel\" spellcheck=\"false\" value=\"${escapeAttr(selected?.labelExpr ?? '')}\"></label>\n    <label class=\"inspector-field\">Node image <input id=\"designerTreeNodeImage\" spellcheck=\"false\" placeholder=\"ImageList.item\" value=\"${escapeAttr(selected?.imageListId && selected?.imageItem ? `${selected.imageListId}.${selected.imageItem}` : '')}\"></label>",
    'Tree editor image input');
  s = once(s,
    "    else if (action === 'rename') result = renameTreeNode(control.treeNodes, path, panel.querySelector('#designerTreeNodeLabel')?.value ?? '');",
    "    else if (action === 'rename') {\n      result = renameTreeNode(control.treeNodes, path, panel.querySelector('#designerTreeNodeLabel')?.value ?? '');\n      result = setTreeNodeImage(result.nodes, result.path, panel.querySelector('#designerTreeNodeImage')?.value ?? '');\n    }",
    'Tree editor image apply');
  return s;
});

edit('web/designer-tabs-nested.js', s => {
  s = once(s,
    "  renameTreeNode,\n  treeNodeAt",
    "  renameTreeNode,\n  setTreeNodeImage,\n  treeNodeAt",
    'nested Tree editor set image import');
  s = once(s,
    "    <label class=\"inspector-field\">Node label expression <input data-tabs-tree-label spellcheck=\"false\" value=\"${escapeAttr(selected?.labelExpr ?? '')}\"></label>",
    "    <label class=\"inspector-field\">Node label expression <input data-tabs-tree-label spellcheck=\"false\" value=\"${escapeAttr(selected?.labelExpr ?? '')}\"></label>\n    <label class=\"inspector-field\">Node image <input data-tabs-tree-image spellcheck=\"false\" placeholder=\"ImageList.item\" value=\"${escapeAttr(selected?.imageListId && selected?.imageItem ? `${selected.imageListId}.${selected.imageItem}` : '')}\"></label>",
    'nested Tree image input');
  s = once(s,
    "    else if (action === 'rename') result = renameTreeNode(structure.control.treeNodes, path, panel.querySelector('[data-tabs-tree-label]')?.value ?? '');",
    "    else if (action === 'rename') {\n      result = renameTreeNode(structure.control.treeNodes, path, panel.querySelector('[data-tabs-tree-label]')?.value ?? '');\n      result = setTreeNodeImage(result.nodes, result.path, panel.querySelector('[data-tabs-tree-image]')?.value ?? '');\n    }",
    'nested Tree image apply');
  return s;
});

console.log('TreeView node icons Stage 1 product patch applied.');
