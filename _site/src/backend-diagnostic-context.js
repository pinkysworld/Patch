export const PATCH_BACKEND_DIAGNOSTIC_CONTEXT_VERSION = 1;

export function inferBackendPatchLine(message, source) {
  const text = String(message ?? '');
  if (!/^C99 backend:/i.test(text)) return null;
  const rows = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  if (!rows.length) return null;

  let match = text.match(/nested recipe '([^']+)' is unsupported/i);
  if (match) return uniqueLine(rows, row => new RegExp(`^\\s*make\\s+${escapeRegex(match[1])}(?:\\s*\\(|\\b)`, 'i').test(row));

  match = text.match(/create '([^']+)' is only supported at top level/i);
  if (match) return uniqueLine(rows, row => new RegExp(`^\\s*create\\s+(?:number|text|boolean|list|thing)\\s+${escapeRegex(match[1])}\\b`, 'i').test(row));

  match = text.match(/unknown recipe '([^']+)'/i);
  if (match) return uniqueLine(rows, row => new RegExp(`^\\s*do\\s+${escapeRegex(match[1])}\\s*\\(`, 'i').test(row));

  if (/return-valued recipes are outside the portable subset/i.test(text)) {
    return uniqueLine(rows, row => /^\s*return\b/i.test(row));
  }

  match = text.match(/repeat count '([^']+)' must be a literal whole number/i);
  if (match) {
    const count = match[1] === '?' ? null : match[1];
    return uniqueLine(rows, row => {
      const parsed = row.match(/^\s*repeat\s+(.+?)\s*:\s*$/i);
      return Boolean(parsed && (count === null || parsed[1].trim() === count));
    });
  }

  match = text.match(/field change '([^'.]+)\.([^']+)' is outside the numeric subset/i);
  if (match) {
    const [, target, field] = match;
    return uniqueLine(rows, (row, index) => {
      if (!new RegExp(`\\b${escapeRegex(field)}\\b`, 'i').test(row)) return false;
      return nearestChangeTarget(rows, index) === target;
    });
  }

  return null;
}

function uniqueLine(rows, predicate) {
  const matches = [];
  rows.forEach((row, index) => {
    if (predicate(row, index)) matches.push(index + 1);
  });
  return matches.length === 1 ? matches[0] : null;
}

function nearestChangeTarget(rows, index) {
  const indent = leadingSpaces(rows[index]);
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!rows[i].trim()) continue;
    const currentIndent = leadingSpaces(rows[i]);
    if (currentIndent >= indent) continue;
    const match = rows[i].match(/^\s*change\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:called\s+[^:]+)?\s*:\s*$/i);
    return match ? match[1] : null;
  }
  return null;
}

function leadingSpaces(row) {
  return /^\s*/.exec(row)?.[0].replace(/\t/g, '  ').length ?? 0;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
