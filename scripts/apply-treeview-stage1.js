#!/usr/bin/env node
import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text, 'utf8'); }
function replaceOnce(path, before, after) {
  const text = read(path);
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one exact replacement target, found ${count}`);
  write(path, text.replace(before, after));
}
function insertBeforeOnce(path, marker, addition) {
  const text = read(path);
  const count = text.split(marker).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one insertion marker, found ${count}`);
  write(path, text.replace(marker, `${addition}${marker}`));
}
function appendOnce(path, marker, addition) {
  const text = read(path);
  if (text.includes(marker)) return;
  write(path, `${text.trimEnd()}\n\n${addition.trim()}\n`);
}

// Parser: one specialized hierarchical control whose children are ordinary source-backed labels.
insertBeforeOnce('src/parser.js', '  function statement(indent) {', String.raw`  function treeControlNode(row, indent, id, xText, yText, widthText, heightText) {
    if (i >= lines.length || lines[i].indent <= indent) throw new PatchSyntaxError('A tree needs at least one indented node.', row.line);
    const treeNodes = treeNodesAt(lines[i].indent);
    if (!treeNodes.length) throw new PatchSyntaxError('A tree needs at least one node.', row.line);
    const fields = { control:'tree', textExpr:null, treeNodes, id, line:row.line };
    if (xText !== undefined) return uiControl(fields, parseLayoutNumbers(xText,yText,widthText,heightText,row.line));
    return uiControl(fields, null);
  }
  function treeNodesAt(nodeIndent) {
    const nodes = [];
    while (i < lines.length) {
      const child = lines[i];
      if (child.indent < nodeIndent) break;
      if (child.indent > nodeIndent) throw new PatchSyntaxError('Tree nodes must use consistent indentation under their parent.', child.line);
      const match = child.text.match(/^node\s+(.+)$/);
      if (!match) throw new PatchSyntaxError('A tree can only contain nodes like node "src".', child.line);
      i += 1;
      const children = i < lines.length && lines[i].indent > nodeIndent ? treeNodesAt(lines[i].indent) : [];
      nodes.push({ labelExpr:match[1], children, line:child.line });
    }
    return nodes;
  }
`);

{
  const path = 'src/parser.js';
  let text = read(path);
  const marker = String.raw`    if ((m = row.text.match(/^table\s+`;
  const index = text.indexOf(marker);
  if (index < 0 || text.indexOf(marker, index + 1) >= 0) throw new Error(`${path}: table statement marker is not unique`);
  const treeStatement = String.raw`    if ((m = row.text.match(/^tree\s+as\s+([A-Za-z_]\w*)(?:\s+at\s+(-?\d+)\s*,\s*(-?\d+)(?:\s+size\s+(\d+)\s*,\s*(\d+))?)?\s*:\s*$/))) {
      return treeControlNode(row, indent, m[1], m[2], m[3], m[4], m[5]);
    }
`;
  text = text.slice(0, index) + treeStatement + text.slice(index);
  write(path, text);
}

// Interpreter: expose evaluated hierarchy only. Selection remains transient toolkit/event state.
replaceOnce(
  'src/interpreter.js',
  `          options:Array.isArray(node.options)?node.options.map(option=>this.uiOption(option)):[],\n          value:node.id&&this.state.has(node.id)?clone(this.state.get(node.id)):''`,
  `          options:Array.isArray(node.options)?node.options.map(option=>this.uiOption(option)):[],\n          nodes:node.control==='tree'?this.uiTreeNodes(node.treeNodes):[],\n          value:node.id&&this.state.has(node.id)?clone(this.state.get(node.id)):''`
);
insertBeforeOnce('src/interpreter.js', '  uiText(expr){', `  uiTreeNodes(nodes){ return (nodes??[]).map(node=>({text:this.uiText(node.labelExpr),children:this.uiTreeNodes(node.children)})); }\n`);

// Window event ABI: TreeView changed carries an event-local text-list path.
replaceOnce('src/window-events.js', "export const PATCH_WINDOW_EVENTS_VERSION = '0.7';", "export const PATCH_WINDOW_EVENTS_VERSION = '0.8';");
replaceOnce(
  'src/window-events.js',
  "    if (controlType === 'table' && (!Array.isArray(payload.value) || !payload.value.every(cell => typeof cell === 'string'))) {\n      throw new PatchRuntimeError(`The 'changed' action for table '${control}' needs a row list of text event-local values.`);\n    }",
  "    if (controlType === 'table' && (!Array.isArray(payload.value) || !payload.value.every(cell => typeof cell === 'string'))) {\n      throw new PatchRuntimeError(`The 'changed' action for table '${control}' needs a row list of text event-local values.`);\n    }\n    if (controlType === 'tree' && (!Array.isArray(payload.value) || !payload.value.length || !payload.value.every(item => typeof item === 'string'))) {\n      throw new PatchRuntimeError(`The 'changed' action for tree '${control}' needs a non-empty text-list event-local value containing the selected node path.`);\n    }"
);

// Shared Window validation: semantic support is known, but targets must opt in explicitly.
replaceOnce('src/window-build.js', '  let menuCheckedBindings = 0;', '  let menuCheckedBindings = 0;\n  let treeViews = 0;');
replaceOnce(
  'src/window-build.js',
  `  const registerControl = (child, formId) => {\n    if (!child?.id) return;\n    if (idTaken(child.id)) throw duplicateId(child);\n    controls.set(child.id, { type: child.control, formId });\n  };`,
  `  const registerControl = (child, formId) => {\n    if (!child?.id) return;\n    if (idTaken(child.id)) throw duplicateId(child);\n    controls.set(child.id, { type: child.control, formId });\n    if (child.control === 'tree') treeViews += 1;\n  };`
);
replaceOnce(
  'src/window-build.js',
  `    if (controlType === 'table' && event.event !== 'changed') {\n      throw new WindowBuildError(\n        \`line \${event.line ?? '?'}: Table '\${event.control}' exposes only 'changed' for transient row selection, not '\${event.event}'.\`\n      );\n    }`,
  `    if (controlType === 'table' && event.event !== 'changed') {\n      throw new WindowBuildError(\n        \`line \${event.line ?? '?'}: Table '\${event.control}' exposes only 'changed' for transient row selection, not '\${event.event}'.\`\n      );\n    }\n    if (controlType === 'tree' && event.event !== 'changed') {\n      throw new WindowBuildError(\n        \`line \${event.line ?? '?'}: TreeView '\${event.control}' exposes only 'changed' for transient node-path selection, not '\${event.event}'.\`\n      );\n    }`
);
replaceOnce(
  'src/window-build.js',
  "      ((controlType === 'input' || controlType === 'checkbox' || controlType === 'combo' || controlType === 'listbox' || controlType === 'radio' || controlType === 'table') && event.event === 'changed');",
  "      ((controlType === 'input' || controlType === 'checkbox' || controlType === 'combo' || controlType === 'listbox' || controlType === 'radio' || controlType === 'table' || controlType === 'tree') && event.event === 'changed');"
);
insertBeforeOnce('src/window-build.js', '  const menuStateBindings = menuEnabledBindings + menuCheckedBindings;', `  if (treeViews && !options.allowTree) {\n    throw new WindowBuildError(\n      'TreeView is not supported by this Window target yet. TreeView Stage 1 is available in the Studio App Preview; native and standalone targets fail closed until they opt into a versioned TreeView runtime contract.'\n    );\n  }\n\n`);
replaceOnce('src/window-build.js', '    controls: controls.size,\n    tabs: tabs.size,', '    controls: controls.size,\n    treeViews,\n    tabs: tabs.size,');

// Designer Stage 1 is preview-only for TreeView. Do not expose unsafe one-line source rewrites.
replaceOnce(
  'src/designer.js',
  `    for (const child of node.body ?? []) {\n      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;`,
  `    for (const child of node.body ?? []) {\n      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;\n      if (child.kind === 'uiControl' && child.control === 'tree') continue;`
);

// Studio App Preview: accessible hierarchy, path selection, no hidden persistence.
replaceOnce(
  'web/playground.js',
  `      if (!interactive) decorateDesignerControl(el, windowIndex, controlIndex, control);`,
  `      if (!interactive && control.type !== 'tree') decorateDesignerControl(el, windowIndex, controlIndex, control);`
);
replaceOnce(
  'web/playground.js',
  `  }\n  return el ?? null;\n}\n\nfunction createTabsElement(control, context) {`,
  `  } else if (control.type === 'tree') {\n    el = createTreeElement(control, context);\n  }\n  return el ?? null;\n}\n\nfunction createTreeElement(control, context) {\n  const root = document.createElement('ul');\n  root.className = 'patch-tree';\n  root.setAttribute('role', 'tree');\n  const renderNodes = (nodes, path = []) => {\n    const fragment = document.createDocumentFragment();\n    for (const node of nodes ?? []) {\n      const item = document.createElement('li');\n      item.setAttribute('role', 'treeitem');\n      const selectedPath = [...path, node.text];\n      const button = document.createElement('button');\n      button.type = 'button';\n      button.className = 'patch-tree-node';\n      button.textContent = node.text;\n      button.setAttribute('aria-label', selectedPath.join(' / '));\n      if (context.interactive) button.addEventListener('click', () => trigger(control.id, 'changed', { value: selectedPath }));\n      else button.disabled = true;\n      item.appendChild(button);\n      if (node.children?.length) {\n        const group = document.createElement('ul');\n        group.setAttribute('role', 'group');\n        group.appendChild(renderNodes(node.children, selectedPath));\n        item.appendChild(group);\n      }\n      fragment.appendChild(item);\n    }\n    return fragment;\n  };\n  root.appendChild(renderNodes(control.nodes));\n  return root;\n}\n\nfunction createTabsElement(control, context) {`
);

appendOnce('web/style.css', '.patch-tree{', `
.patch-tree{width:min(100%,520px);margin:0;padding:10px 12px;list-style:none;border:1px solid var(--border);border-radius:10px;background:var(--surface-subtle)}
.patch-tree ul{margin:3px 0 0 18px;padding:0;list-style:none}
.patch-tree li{margin:2px 0}
.patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:inherit;font:inherit;text-align:left}
.patch-tree-node:hover,.patch-tree-node:focus-visible{background:var(--soft)}
.patch-tree-node:focus-visible{outline:2px solid color-mix(in srgb,var(--text) 32%,transparent);outline-offset:1px}
.patch-tree-node:disabled{opacity:1;cursor:default}
`);

// Roadmap: multi-file project tree is complete; richer data controls remains open while TreeView is browser Stage 1 only.
replaceOnce(
  'docs/ROADMAP.md',
  '- [ ] richer data controls beyond Table/Grid and ListBox\n- [ ] project tree and separate source files/forms',
  '- [ ] richer data controls beyond Table/Grid and ListBox\n- [x] project tree and separate source files/forms with project bundle v3, full-project recovery and deterministic Run/Build composition\n- [x] TreeView Stage 1 language/IR + Studio App Preview with hierarchical source-backed nodes and transient text-list path selection; unsupported standalone/native targets fail closed'
);

console.log('Applied TreeView Stage 1 source transformation.');
