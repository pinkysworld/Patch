import fs from 'node:fs';

const path = 'scripts/_table-columns-stage1.mjs';
let source = fs.readFileSync(path, 'utf8');
const label = "'table actions metadata draft');";
const labelIndex = source.indexOf(label);
if (labelIndex < 0) throw new Error('Table actions metadata-draft harness block is missing.');
const start = source.lastIndexOf('  s = once(s,', labelIndex);
if (start < 0) throw new Error('Table actions metadata-draft harness start is missing.');
const end = labelIndex + label.length;

const oldAnchor = [
  '  return { columns, rows };',
  '}',
  '',
  'function contextKey(context) {'
].join('\n');
const newAnchor = [
  "  const presentation = readWindowTableColumnPresentation(code.value, context.table.line, columns.length) ?? defaultTableColumnPresentation(columns.length);",
  "  const widthAttribute = nested ? 'data-tabs-table-column-width' : 'data-table-column-width';",
  "  const alignAttribute = nested ? 'data-tabs-table-column-align' : 'data-table-column-align';",
  '  for (let index = 0; index < columns.length; index += 1) {',
  '    const widthInput = panel.querySelector(`[${widthAttribute}="${index}"]`);',
  '    const alignInput = panel.querySelector(`[${alignAttribute}="${index}"]`);',
  '    if (widthInput) presentation[index].width = widthInput.value.trim() ? Number(widthInput.value) : null;',
  "    if (alignInput) presentation[index].align = alignInput.value || 'left';",
  '  }',
  '  return { columns, rows, presentation };',
  '}',
  '',
  'function contextKey(context) {'
].join('\n');
const replacement = [
  '  s = once(s,',
  `    ${JSON.stringify(oldAnchor)},`,
  `    ${JSON.stringify(newAnchor)},`,
  "    'table actions metadata draft');"
].join('\n');

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log('Table columns harness metadata-draft anchor stabilized.');
