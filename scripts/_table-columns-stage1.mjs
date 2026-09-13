import fs from 'node:fs';

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change made to ${path}`);
  fs.writeFileSync(path, after);
}
function once(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one anchor for ${label}, found ${count}`);
  return source.replace(before, after);
}

edit('src/window-layout-policy.js', source => once(
  source,
  "const METADATA_RE = /^\\s*#\\s*@(layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode|panel-mode|button-mode)\\b/i;",
  "const METADATA_RE = /^\\s*#\\s*@(layout|taborder|locked|input-mode|input-mask|listbox-mode|slider-mode|panel-mode|button-mode|table-columns)\\b/i;",
  'designer metadata table-columns'
));

edit('src/compiler.js', source => {
  let s = source;
  s = once(s,
    "import {\n  attachWindowButtonPresentations,\n  buildWindowButtonPresentationManifest\n} from './button-presentation.js';",
    "import {\n  attachWindowButtonPresentations,\n  buildWindowButtonPresentationManifest\n} from './button-presentation.js';\nimport {\n  attachWindowTableColumnPresentations,\n  buildWindowTableColumnPresentationManifest\n} from './table-column-presentation.js';",
    'compiler table column import');
  s = once(s,
    "  const windowSliderPresentation = buildWindowSliderPresentationManifest(source, ast);\n  const windowPanelPresentation = buildWindowPanelPresentationManifest(source, ast);",
    "  const windowSliderPresentation = buildWindowSliderPresentationManifest(source, ast);\n  const windowTableColumnPresentation = buildWindowTableColumnPresentationManifest(source, ast);\n  const windowPanelPresentation = buildWindowPanelPresentationManifest(source, ast);",
    'compiler table column manifest');
  s = once(s,
    "  attachWindowSliderPresentations(ast, windowSliderPresentation);\n  attachWindowPanelPresentations(ast, windowPanelPresentation);",
    "  attachWindowSliderPresentations(ast, windowSliderPresentation);\n  attachWindowTableColumnPresentations(ast, windowTableColumnPresentation);\n  attachWindowPanelPresentations(ast, windowPanelPresentation);",
    'compiler table column attach');
  s = once(s,
    "    windowSliderPresentation, windowPanelPresentation, windowPanelScroll, windowPanelSplit",
    "    windowSliderPresentation, windowTableColumnPresentation, windowPanelPresentation, windowPanelScroll, windowPanelSplit",
    'compiler table column return');
  return s;
});

edit('src/window-build.js', source => {
  let s = source;
  s = once(s, '  let scrollBars = 0;\n  let memos = 0;', '  let scrollBars = 0;\n  let advancedTableColumns = 0;\n  let memos = 0;', 'advanced table counter');
  s = once(s,
    "    if (child.control === 'tree') treeViews += 1;",
    "    if (child.control === 'table' && Array.isArray(child.tableColumnPresentation)) advancedTableColumns += 1;\n    if (child.control === 'tree') treeViews += 1;",
    'advanced table count');
  s = once(s,
    "  if (memos && !options.allowMemo) {",
    "  if (advancedTableColumns && !options.allowAdvancedTableColumns) {\n    throw new WindowBuildError(\n      'Advanced Table columns Stage 1 is Studio/Web only. Current Ready native GUI 1.9/19/1.10 does not encode source-backed per-column width/alignment; validation fails closed rather than silently discarding the column presentation.'\n    );\n  }\n\n  if (memos && !options.allowMemo) {",
    'advanced table target gate');
  s = once(s, '    scrollBars,\n    memos,', '    scrollBars,\n    advancedTableColumns,\n    memos,', 'advanced table support result');
  return s;
});

edit('src/window-compiled.js', source => once(
  source,
  '    allowScrollBar: true,\n    allowMemo: true,',
  '    allowScrollBar: true,\n    allowAdvancedTableColumns: true,\n    allowMemo: true,',
  'target-neutral advanced table allowance'
));

edit('src/window-webapp.js', source => once(
  source,
  'validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowProgressBar: true, allowScrollBar: true, allowMemo: true, allowPaintBox: true, allowImageList: true });',
  'validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowProgressBar: true, allowScrollBar: true, allowAdvancedTableColumns: true, allowMemo: true, allowPaintBox: true, allowImageList: true });',
  'Standalone Web advanced table allowance'
));

edit('src/webapp.js', source => {
  let s = source;
  s = once(s,
    "  const hasTable = (built.compiled?.ast ?? []).some(windowNode => windowNode.kind === 'window' && containsTable(windowNode.body));\n  if (!hasTable) return built;",
    "  const hasTable = (built.compiled?.ast ?? []).some(windowNode => windowNode.kind === 'window' && containsTable(windowNode.body));\n  if (!hasTable) return built;\n  const advancedTableColumns = (built.compiled?.ast ?? []).some(windowNode => windowNode.kind === 'window' && containsAdvancedTableColumns(windowNode.body));",
    'Standalone advanced table detection');
  s = once(s,
    '"columns:Array.isArray(node.columns)?node.columns.map(uiOption):[],rows:Array.isArray(node.rows)?node.rows.map(row=>row.map(uiOption)):[],value:"',
    '"columns:Array.isArray(node.columns)?node.columns.map(uiOption):[],rows:Array.isArray(node.rows)?node.rows.map(row=>row.map(uiOption)):[],columnPresentation:Array.isArray(node.tableColumnPresentation)?node.tableColumnPresentation.map(spec=>({width:spec.width??null,align:spec.align||\'left\'})):[],value:"',
    'Standalone table model presentation');
  const oldRenderer = "function renderTable(control){const wrap=document.createElement('div');wrap.className='patch-table-wrap';const table=document.createElement('table');table.className='patch-table';const head=document.createElement('thead');const headRow=document.createElement('tr');for(const column of control.columns??[]){const th=document.createElement('th');th.scope='col';th.textContent=column;headRow.appendChild(th);}head.appendChild(headRow);const body=document.createElement('tbody');const key=control.id||'';const selected=tableSelections.get(key)??-1;for(let rowIndex=0;rowIndex<(control.rows??[]).length;rowIndex+=1){const row=control.rows[rowIndex];const tr=document.createElement('tr');tr.tabIndex=0;tr.setAttribute('aria-selected',rowIndex===selected?'true':'false');if(rowIndex===selected)tr.className='patch-table-selected';const selectRow=()=>{tableSelections.set(key,rowIndex);const hasHandler=events.some(handler=>handler.control===control.id&&handler.event==='changed');if(hasHandler)safeTrigger(control.id,'changed',{value:[...row]});else render();};tr.addEventListener('click',selectRow);tr.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRow();}});for(let index=0;index<(control.columns??[]).length;index+=1){const td=document.createElement('td');td.textContent=row[index]??'';tr.appendChild(td);}body.appendChild(tr);}table.append(head,body);wrap.appendChild(table);return wrap;}\\n";
  const newRenderer = "function renderTable(control){const wrap=document.createElement('div');wrap.className='patch-table-wrap';const table=document.createElement('table');table.className='patch-table';const presentation=Array.isArray(control.columnPresentation)?control.columnPresentation:[];if(presentation.length){const colgroup=document.createElement('colgroup');for(const spec of presentation){const col=document.createElement('col');if(Number.isInteger(spec?.width))col.style.width=spec.width+'px';colgroup.appendChild(col);}table.appendChild(colgroup);}const head=document.createElement('thead');const headRow=document.createElement('tr');for(let columnIndex=0;columnIndex<(control.columns??[]).length;columnIndex+=1){const column=control.columns[columnIndex];const th=document.createElement('th');th.scope='col';th.textContent=column;const spec=presentation[columnIndex];if(spec?.align)th.style.textAlign=spec.align;headRow.appendChild(th);}head.appendChild(headRow);const body=document.createElement('tbody');const key=control.id||'';const selected=tableSelections.get(key)??-1;for(let rowIndex=0;rowIndex<(control.rows??[]).length;rowIndex+=1){const row=control.rows[rowIndex];const tr=document.createElement('tr');tr.tabIndex=0;tr.setAttribute('aria-selected',rowIndex===selected?'true':'false');if(rowIndex===selected)tr.className='patch-table-selected';const selectRow=()=>{tableSelections.set(key,rowIndex);const hasHandler=events.some(handler=>handler.control===control.id&&handler.event==='changed');if(hasHandler)safeTrigger(control.id,'changed',{value:[...row]});else render();};tr.addEventListener('click',selectRow);tr.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRow();}});for(let index=0;index<(control.columns??[]).length;index+=1){const td=document.createElement('td');td.textContent=row[index]??'';const spec=presentation[index];if(spec?.align)td.style.textAlign=spec.align;tr.appendChild(td);}body.appendChild(tr);}table.append(head,body);wrap.appendChild(table);return wrap;}\\n";
  s = once(s, oldRenderer, newRenderer, 'Standalone advanced table renderer');
  s = once(s,
    "    metadata: { ...built.metadata, tableStage: 2, tableMode: 'transient-row-selection' }",
    "    metadata: { ...built.metadata, tableStage: 2, tableMode: 'transient-row-selection', ...(advancedTableColumns ? { tableColumnPresentationStage: 1, tableColumnPresentationVersion: '0.1', tableColumnPresentationMode: 'source-backed-width-alignment' } : {}) }",
    'Standalone advanced table metadata');
  s = once(s,
    "function containsTable(nodes) {\n  for (const node of nodes ?? []) {\n    if (node.kind === 'uiControl' && node.control === 'table') return true;\n    if (node.kind === 'tabs' && (node.body ?? []).some(page => containsTable(page.body))) return true;\n  }\n  return false;\n}",
    "function containsTable(nodes) {\n  for (const node of nodes ?? []) {\n    if (node.kind === 'uiControl' && node.control === 'table') return true;\n    if (node.kind === 'tabs' && (node.body ?? []).some(page => containsTable(page.body))) return true;\n  }\n  return false;\n}\n\nfunction containsAdvancedTableColumns(nodes) {\n  for (const node of nodes ?? []) {\n    if (node.kind === 'uiControl' && node.control === 'table' && Array.isArray(node.tableColumnPresentation)) return true;\n    if (node.kind === 'tabs' && (node.body ?? []).some(page => containsAdvancedTableColumns(page.body))) return true;\n    if (node.kind === 'uiControl' && Array.isArray(node.body) && containsAdvancedTableColumns(node.body)) return true;\n  }\n  return false;\n}",
    'Standalone advanced table detector helper');
  return s;
});

edit('web/table-stage1.js', source => {
  let s = source;
  s = once(s,
    "import { evaluateLoose } from '../src/expression.js';",
    "import { evaluateLoose } from '../src/expression.js';\nimport { readWindowTableColumnPresentation } from '../src/table-column-presentation.js';",
    'Studio table presentation import');
  s = once(s,
    "    hasHandler: options.hasHandler === true\n  });",
    "    hasHandler: options.hasHandler === true,\n    columnPresentation: options.columnPresentation ?? null\n  });",
    'Studio table fingerprint');
  s = once(s,
    "        const tableOptions = {\n          interactive: !designer,\n          container,\n          key,\n          hasHandler: Boolean(node.id && changedHandlers.has(node.id))\n        };",
    "        const tableOptions = {\n          interactive: !designer,\n          container,\n          key,\n          hasHandler: Boolean(node.id && changedHandlers.has(node.id)),\n          columnPresentation: readWindowTableColumnPresentation(code.value, node.line, node.columns?.length ?? 0)\n        };",
    'Studio table presentation read');
  s = once(s,
    "  const table = document.createElement('table');\n  table.className = 'patch-table';\n  if (node.id) table.setAttribute('aria-label', `${node.id} table`);\n  const head = document.createElement('thead');",
    "  const table = document.createElement('table');\n  table.className = 'patch-table';\n  if (node.id) table.setAttribute('aria-label', `${node.id} table`);\n  const presentation = options.columnPresentation ?? [];\n  if (presentation.length) {\n    const colgroup = document.createElement('colgroup');\n    for (const spec of presentation) {\n      const col = document.createElement('col');\n      if (Number.isInteger(spec?.width)) col.style.width = `${spec.width}px`;\n      colgroup.appendChild(col);\n    }\n    table.appendChild(colgroup);\n  }\n  const head = document.createElement('thead');",
    'Studio table colgroup');
  s = once(s,
    "  for (const column of node.columns ?? []) {\n    const th = document.createElement('th');\n    th.scope = 'col';\n    th.textContent = displayExpression(column);\n    headRow.appendChild(th);\n  }",
    "  for (let columnIndex = 0; columnIndex < (node.columns ?? []).length; columnIndex += 1) {\n    const column = node.columns[columnIndex];\n    const th = document.createElement('th');\n    th.scope = 'col';\n    th.textContent = displayExpression(column);\n    const spec = presentation[columnIndex];\n    if (spec?.align) th.style.textAlign = spec.align;\n    headRow.appendChild(th);\n  }",
    'Studio table header alignment');
  s = once(s,
    "      const td = document.createElement('td');\n      td.textContent = row[index] ?? '';\n      tr.appendChild(td);",
    "      const td = document.createElement('td');\n      td.textContent = row[index] ?? '';\n      const spec = presentation[index];\n      if (spec?.align) td.style.textAlign = spec.align;\n      tr.appendChild(td);",
    'Studio table cell alignment');
  return s;
});

edit('web/designer-table-model.js', source => {
  let s = source;
  s = once(s,
    "  table.columns.splice(columnIndex + 1, 0, table.columns[columnIndex]);\n  for (const row of table.rows) row.splice(columnIndex + 1, 0, row[columnIndex]);",
    "  table.columns.splice(columnIndex + 1, 0, table.columns[columnIndex]);\n  table.presentation.splice(columnIndex + 1, 0, { ...table.presentation[columnIndex] });\n  for (const row of table.rows) row.splice(columnIndex + 1, 0, row[columnIndex]);",
    'duplicate table column presentation');
  s = once(s,
    "  [table.columns[columnIndex], table.columns[target]] = [table.columns[target], table.columns[columnIndex]];\n  for (const row of table.rows) [row[columnIndex], row[target]] = [row[target], row[columnIndex]];",
    "  [table.columns[columnIndex], table.columns[target]] = [table.columns[target], table.columns[columnIndex]];\n  [table.presentation[columnIndex], table.presentation[target]] = [table.presentation[target], table.presentation[columnIndex]];\n  for (const row of table.rows) [row[columnIndex], row[target]] = [row[target], row[columnIndex]];",
    'move table column presentation');
  s = once(s,
    "  return { columns, rows };",
    "  const presentation = Array.isArray(data.presentation) && data.presentation.length === columns.length\n    ? data.presentation.map(spec => ({ width: spec?.width ?? null, align: spec?.align ?? 'left' }))\n    : columns.map(() => ({ width: null, align: 'left' }));\n  return { columns, rows, presentation };",
    'clone table presentation');
  return s;
});

edit('web/designer-data-editor.js', source => {
  let s = source;
  s = once(s,
    "import { installDesignerStructuralKeyboard } from './designer-structural-keyboard.js';",
    "import { installDesignerStructuralKeyboard } from './designer-structural-keyboard.js';\nimport {\n  defaultTableColumnPresentation,\n  readWindowTableColumnPresentation,\n  setWindowTableColumnPresentation\n} from '../src/table-column-presentation.js';",
    'top table editor presentation import');
  s = once(s,
    "  const columns = control.columns ?? [];\n  const rows = control.rows ?? [];\n  panel.innerHTML = `",
    "  const columns = control.columns ?? [];\n  const rows = control.rows ?? [];\n  const presentation = readWindowTableColumnPresentation(code.value, control.line, columns.length) ?? defaultTableColumnPresentation(columns.length);\n  panel.innerHTML = `",
    'top table editor presentation state');
  s = once(s,
    "        ${columns.map((column, index) => `<label>Column ${index + 1}<input data-table-column=\"${index}\" spellcheck=\"false\" value=\"${escapeAttr(column)}\"></label>`).join('')}",
    "        ${columns.map((column, index) => `<div class=\"designer-table-column-card\"><label>Column ${index + 1}<input data-table-column=\"${index}\" spellcheck=\"false\" value=\"${escapeAttr(column)}\"></label><label>Width px <input data-table-column-width=\"${index}\" type=\"number\" min=\"40\" max=\"2000\" placeholder=\"auto\" value=\"${presentation[index]?.width ?? ''}\"></label><label>Align <select data-table-column-align=\"${index}\"><option value=\"left\"${presentation[index]?.align === 'left' ? ' selected' : ''}>Left</option><option value=\"center\"${presentation[index]?.align === 'center' ? ' selected' : ''}>Center</option><option value=\"right\"${presentation[index]?.align === 'right' ? ' selected' : ''}>Right</option></select></label></div>`).join('')}",
    'top table column property controls');
  s = once(s,
    "    <p class=\"inspector-hint\">Cells are Patch expressions. Editing this grid rewrites only the selected source-backed <code>table</code>/<code>row</code> block. <span class=\"designer-keyboard-hint\">Ctrl/Cmd+Enter in any cell or column applies the current grid.</span></p>`;",
    "    <p class=\"inspector-hint\">Cells are Patch expressions. Width/alignment are source-backed <code># @table-columns</code> presentation metadata and do not change row selection or Patch state. <span class=\"designer-keyboard-hint\">Ctrl/Cmd+Enter in any cell or column applies the current grid.</span></p>`;",
    'top table editor hint');
  s = once(s,
    "    const next = transform(draft);\n    setSource(updateDesignerTableData(code.value, control, next));",
    "    const next = transform(draft);\n    let source = updateDesignerTableData(code.value, control, next);\n    const updated = listDesignerControls(source).find(item => item.windowIndex === control.windowIndex && item.controlIndex === control.controlIndex && item.type === 'table');\n    if (!updated) throw new Error('Updated Table could not be located after source rewrite.');\n    const presentation = Array.isArray(next.presentation) && next.presentation.length === next.columns.length ? next.presentation : defaultTableColumnPresentation(next.columns.length);\n    source = setWindowTableColumnPresentation(source, updated.line, presentation, next.columns.length);\n    setSource(source);",
    'top table editor metadata write');
  s = once(s,
    "  return { columns, rows };",
    "  const presentation = columns.map((_, index) => {\n    const rawWidth = panel.querySelector(`[data-table-column-width=\\\"${index}\\\"]`)?.value.trim() ?? '';\n    const width = rawWidth ? Number(rawWidth) : null;\n    const align = panel.querySelector(`[data-table-column-align=\\\"${index}\\\"]`)?.value ?? 'left';\n    return { width, align };\n  });\n  return { columns, rows, presentation };",
    'top table editor metadata draft');
  s = once(s,
    "  if (tableAction === 'add-column') applyTableMutation(data => ({ columns: [...data.columns, JSON.stringify(`Column ${data.columns.length + 1}`)], rows: data.rows.map(row => [...row, '\"\"']) }));",
    "  if (tableAction === 'add-column') applyTableMutation(data => ({ columns: [...data.columns, JSON.stringify(`Column ${data.columns.length + 1}`)], rows: data.rows.map(row => [...row, '\"\"']), presentation: [...data.presentation, { width: null, align: 'left' }] }));",
    'top table add column metadata');
  s = once(s,
    "    return { columns: data.columns.slice(0, -1), rows: data.rows.map(row => row.slice(0, -1)) };",
    "    return { columns: data.columns.slice(0, -1), rows: data.rows.map(row => row.slice(0, -1)), presentation: data.presentation.slice(0, -1) };",
    'top table remove column metadata');
  return s;
});

edit('web/designer-tabs-nested.js', source => {
  let s = source;
  s = once(s,
    "import {\n  clearDesignerInspectorError,\n  showDesignerInspectorError\n} from './designer-selection.js';",
    "import {\n  clearDesignerInspectorError,\n  showDesignerInspectorError\n} from './designer-selection.js';\nimport {\n  defaultTableColumnPresentation,\n  readWindowTableColumnPresentation,\n  setWindowTableColumnPresentation\n} from '../src/table-column-presentation.js';",
    'nested table presentation import');
  s = once(s,
    "  const columns = control.columns ?? [];\n  const rows = control.rows ?? [];\n  return `<div class=\"designer-tabs-structure-editor\"",
    "  const columns = control.columns ?? [];\n  const rows = control.rows ?? [];\n  const presentation = readWindowTableColumnPresentation(code.value, control.line, columns.length) ?? defaultTableColumnPresentation(columns.length);\n  return `<div class=\"designer-tabs-structure-editor\"",
    'nested table presentation state');
  s = once(s,
    "        ${columns.map((column, index) => `<label>Column ${index + 1}<input data-tabs-table-column=\"${index}\" spellcheck=\"false\" value=\"${escapeAttr(column)}\"></label>`).join('')}",
    "        ${columns.map((column, index) => `<div class=\"designer-table-column-card\"><label>Column ${index + 1}<input data-tabs-table-column=\"${index}\" spellcheck=\"false\" value=\"${escapeAttr(column)}\"></label><label>Width px <input data-tabs-table-column-width=\"${index}\" type=\"number\" min=\"40\" max=\"2000\" placeholder=\"auto\" value=\"${presentation[index]?.width ?? ''}\"></label><label>Align <select data-tabs-table-column-align=\"${index}\"><option value=\"left\"${presentation[index]?.align === 'left' ? ' selected' : ''}>Left</option><option value=\"center\"${presentation[index]?.align === 'center' ? ' selected' : ''}>Center</option><option value=\"right\"${presentation[index]?.align === 'right' ? ' selected' : ''}>Right</option></select></label></div>`).join('')}",
    'nested table column property controls');
  s = once(s,
    "    <p class=\"inspector-hint\">Cells are Patch expressions. Applying rewrites only this nested <code>table</code>/<code>row</code> source block.</p>",
    "    <p class=\"inspector-hint\">Cells are Patch expressions. Width/alignment use the same source-backed <code># @table-columns</code> presentation contract as top-level Tables.</p>",
    'nested table hint');
  s = once(s,
    "    const next = transform(draft);\n    setSource(updateDesignerTabPageTableData(code.value, structure.tabs, structure.pageIndex, structure.control.controlIndex, next));",
    "    const next = transform(draft);\n    let source = updateDesignerTabPageTableData(code.value, structure.tabs, structure.pageIndex, structure.control.controlIndex, next);\n    const updatedTabs = listDesignerControls(source).find(item => item.windowIndex === structure.tabs.windowIndex && item.controlIndex === structure.tabs.controlIndex && item.type === 'tabs');\n    const updated = updatedTabs ? listDesignerTabPageControls(source, updatedTabs, structure.pageIndex).find(item => item.controlIndex === structure.control.controlIndex && item.type === 'table') : null;\n    if (!updated) throw new Error('Updated nested Table could not be located after source rewrite.');\n    const presentation = Array.isArray(next.presentation) && next.presentation.length === next.columns.length ? next.presentation : defaultTableColumnPresentation(next.columns.length);\n    source = setWindowTableColumnPresentation(source, updated.line, presentation, next.columns.length);\n    setSource(source);",
    'nested table metadata write');
  s = once(s,
    "  return { columns, rows };",
    "  const presentation = columns.map((_, index) => {\n    const rawWidth = panel.querySelector(`[data-tabs-table-column-width=\\\"${index}\\\"]`)?.value.trim() ?? '';\n    const width = rawWidth ? Number(rawWidth) : null;\n    const align = panel.querySelector(`[data-tabs-table-column-align=\\\"${index}\\\"]`)?.value ?? 'left';\n    return { width, align };\n  });\n  return { columns, rows, presentation };",
    'nested table metadata draft');
  s = once(s,
    "    if (tableAction === 'add-column') applyNestedTableMutation(data => ({ columns: [...data.columns, JSON.stringify(`Column ${data.columns.length + 1}`)], rows: data.rows.map(row => [...row, '\"\"']) }));",
    "    if (tableAction === 'add-column') applyNestedTableMutation(data => ({ columns: [...data.columns, JSON.stringify(`Column ${data.columns.length + 1}`)], rows: data.rows.map(row => [...row, '\"\"']), presentation: [...data.presentation, { width: null, align: 'left' }] }));",
    'nested table add column metadata');
  s = once(s,
    "      return { columns: data.columns.slice(0, -1), rows: data.rows.map(row => row.slice(0, -1)) };",
    "      return { columns: data.columns.slice(0, -1), rows: data.rows.map(row => row.slice(0, -1)), presentation: data.presentation.slice(0, -1) };",
    'nested table remove column metadata');
  return s;
});

edit('web/designer-table-actions.js', source => {
  let s = source;
  s = once(s,
    "import { updateDesignerTableData } from '../src/designer-data.js';",
    "import { updateDesignerTableData } from '../src/designer-data.js';\nimport {\n  defaultTableColumnPresentation,\n  readWindowTableColumnPresentation,\n  setWindowTableColumnPresentation\n} from '../src/table-column-presentation.js';",
    'table actions presentation import');
  s = once(s,
    "    const nextData = { columns: result.columns, rows: result.rows };\n    const next = context.kind === 'nested'\n      ? updateDesignerTabPageTableData(code.value, context.tabs, context.pageIndex, context.table.controlIndex, nextData)\n      : updateDesignerTableData(code.value, context.table, nextData);\n    setSource(next);",
    "    const nextData = { columns: result.columns, rows: result.rows };\n    let next = context.kind === 'nested'\n      ? updateDesignerTabPageTableData(code.value, context.tabs, context.pageIndex, context.table.controlIndex, nextData)\n      : updateDesignerTableData(code.value, context.table, nextData);\n    const updatedTop = context.kind === 'nested' ? listDesignerControls(next).find(item => item.windowIndex === context.tabs.windowIndex && item.controlIndex === context.tabs.controlIndex && item.type === 'tabs') : null;\n    const updated = context.kind === 'nested'\n      ? (updatedTop ? listDesignerTabPageControls(next, updatedTop, context.pageIndex).find(item => item.controlIndex === context.table.controlIndex && item.type === 'table') : null)\n      : listDesignerControls(next).find(item => item.windowIndex === context.table.windowIndex && item.controlIndex === context.table.controlIndex && item.type === 'table');\n    if (!updated) throw new Error('Updated Table could not be located after advanced column action.');\n    next = setWindowTableColumnPresentation(next, updated.line, result.presentation, result.columns.length);\n    setSource(next);",
    'table actions metadata write');
  s = once(s,
    "  const sourceRows = context.table.rows ?? [];\n  const rows = sourceRows.map((_, rowIndex) => columns.map((__, cellIndex) =>\n    panel.querySelector(`[${cellAttribute}=\\\"${rowIndex}:${cellIndex}\\\"]`)?.value.trim() ?? '\"\"'\n  ));\n  return { columns, rows };",
    "  const sourceRows = context.table.rows ?? [];\n  const rows = sourceRows.map((_, rowIndex) => columns.map((__, cellIndex) =>\n    panel.querySelector(`[${cellAttribute}=\\\"${rowIndex}:${cellIndex}\\\"]`)?.value.trim() ?? '\"\"'\n  ));\n  const presentation = readWindowTableColumnPresentation(code.value, context.table.line, columns.length) ?? defaultTableColumnPresentation(columns.length);\n  const widthAttribute = nested ? 'data-tabs-table-column-width' : 'data-table-column-width';\n  const alignAttribute = nested ? 'data-tabs-table-column-align' : 'data-table-column-align';\n  for (let index = 0; index < columns.length; index += 1) {\n    const widthInput = panel.querySelector(`[${widthAttribute}=\\\"${index}\\\"]`);\n    const alignInput = panel.querySelector(`[${alignAttribute}=\\\"${index}\\\"]`);\n    if (widthInput) presentation[index].width = widthInput.value.trim() ? Number(widthInput.value) : null;\n    if (alignInput) presentation[index].align = alignInput.value || 'left';\n  }\n  return { columns, rows, presentation };",
    'table actions metadata draft');
  return s;
});

console.log('Advanced Table columns Stage 1 product patch applied.');
