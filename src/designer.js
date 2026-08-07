export function addDesignerControl(source, type) {
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let windowIndex = lines.findIndex(line => /^\s*window\s+".*"\s*:\s*$/.test(line));

  if (windowIndex < 0) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    windowIndex = lines.length;
    lines.push('window "My App":');
  }

  const baseIndent = indentOf(lines[windowIndex]);
  const childIndent = `${baseIndent}  `;
  let insertAt = windowIndex + 1;
  while (insertAt < lines.length) {
    const line = lines[insertAt];
    if (!line.trim()) { insertAt++; continue; }
    if (indentOf(line).length <= baseIndent.length) break;
    insertAt++;
  }

  const control = makeControl(type, lines);
  lines.splice(insertAt, 0, `${childIndent}${control}`);
  return tidy(lines.join('\n'));
}

export function renameDesignerButton(source, id, newText) {
  const escapedId = escapeRegExp(id);
  const pattern = new RegExp(`^(\\s*)button\\s+"(?:[^"\\\\]|\\\\.)*"\\s+as\\s+${escapedId}\\s*$`, 'm');
  if (!pattern.test(source)) throw new Error(`Cannot find button '${id}' in Patch source.`);
  const safe = String(newText).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return source.replace(pattern, `$1button "${safe}" as ${id}`);
}

function makeControl(type, lines) {
  if (type === 'text') return 'text "Text"';
  if (type === 'button') return `button "Button" as ${nextId(lines, 'button')}`;
  if (type === 'input') return `input ${nextId(lines, 'input')}`;
  throw new Error(`Designer cannot add '${type}' yet.`);
}

function nextId(lines, base) {
  const text = lines.join('\n');
  let i = 1;
  while (new RegExp(`\\b${base}_${i}\\b`).test(text)) i++;
  return `${base}_${i}`;
}

function indentOf(line) {
  return line.match(/^\s*/)?.[0] ?? '';
}

function tidy(text) {
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
