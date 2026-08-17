export function buildOutlineModel(ast) {
  const groups = [
    { key: 'forms', label: 'Forms', items: [] },
    { key: 'state', label: 'State', items: [] },
    { key: 'events', label: 'Events', items: [] },
    { key: 'recipes', label: 'Recipes', items: [] }
  ];
  const byKey = new Map(groups.map(group => [group.key, group]));

  for (const node of ast) {
    if (node.kind === 'window') {
      byKey.get('forms').items.push({
        kind: 'window',
        line: node.line,
        label: node.id || displayExpr(node.titleExpr) || 'window',
        meta: displayExpr(node.titleExpr)
      });
    } else if (node.kind === 'create') {
      byKey.get('state').items.push({ kind: 'state', line: node.line, label: node.name, meta: node.valueType });
    } else if (node.kind === 'createThing') {
      byKey.get('state').items.push({ kind: 'state', line: node.line, label: node.name, meta: 'thing' });
    } else if (node.kind === 'event') {
      byKey.get('events').items.push({ kind: 'event', line: node.line, label: node.control, meta: node.event });
    } else if (node.kind === 'recipe' || node.kind === 'function') {
      byKey.get('recipes').items.push({ kind: 'recipe', line: node.line, label: node.name, meta: 'recipe' });
    }
  }

  return groups.filter(group => group.items.length);
}

export function lineSelectionRange(source, line) {
  const lines = String(source).split(/\r?\n/);
  if (!Number.isInteger(line) || line < 1 || !lines.length) return null;
  const target = Math.min(line, lines.length);
  let start = 0;
  for (let index = 0; index < target - 1; index += 1) start += lines[index].length + 1;
  return { line: target, start, end: start + (lines[target - 1]?.length ?? 0) };
}

function displayExpr(expr) {
  const text = String(expr ?? '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
  return text;
}
