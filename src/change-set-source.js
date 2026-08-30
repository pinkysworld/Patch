export const PATCH_EXPERIMENTAL_CHANGE_SET_SYNTAX_VERSION = '0.1-research';

export class ExperimentalChangeSetSyntaxError extends Error {
  constructor(message, line = null) {
    super(line ? `line ${line}: ${message}` : message);
    this.name = 'ExperimentalChangeSetSyntaxError';
    this.line = line;
  }
}

/**
 * Research-only parser for the proposed beginner-readable ChangeSet surface.
 * It is intentionally not wired into the production Patch parser yet.
 */
export function parseExperimentalChangeSet(source) {
  const rows = source.replace(/\t/g, '  ').split(/\r?\n/)
    .map((raw, index) => ({ raw, text: raw.trim(), indent: raw.length - raw.trimStart().length, line: index + 1 }))
    .filter(row => row.text && !row.text.startsWith('#'));

  if (!rows.length) throw new ExperimentalChangeSetSyntaxError('A ChangeSet needs some code.');

  const header = rows[0].text.match(/^change\s+together(?:\s+called\s+([A-Za-z_]\w*))?\s*:\s*$/);
  if (!header) {
    throw new ExperimentalChangeSetSyntaxError("Start an atomic group with 'change together:' or 'change together called name:'.", rows[0].line);
  }
  if (rows[0].indent !== 0) throw new ExperimentalChangeSetSyntaxError('The ChangeSet header must start at the left edge.', rows[0].line);

  const changes = [];
  const constraints = [];
  let i = 1;

  while (i < rows.length) {
    const row = rows[i];
    if (row.indent !== 2) {
      throw new ExperimentalChangeSetSyntaxError('Inside change together, use two spaces before each change or condition.', row.line);
    }

    const changeHeader = row.text.match(/^change\s+([A-Za-z_]\w*)\s*:\s*$/);
    if (changeHeader) {
      const target = changeHeader[1];
      const ops = [];
      i += 1;
      while (i < rows.length && rows[i].indent > 2) {
        const opRow = rows[i];
        if (opRow.indent !== 4) {
          throw new ExperimentalChangeSetSyntaxError('Inside a change, use four spaces before set, add, remove, or clear.', opRow.line);
        }
        ops.push(parseOperation(opRow));
        i += 1;
      }
      if (!ops.length) throw new ExperimentalChangeSetSyntaxError(`Change '${target}' needs at least one operation.`, row.line);
      changes.push({ kind: 'change', target, name: null, ops, line: row.line });
      continue;
    }

    const same = row.text.match(/^keep\s+(.+?)\s+the\s+same$/);
    if (same) {
      constraints.push({ kind: 'same', expr: same[1].trim(), line: row.line });
      i += 1;
      continue;
    }

    const ensure = row.text.match(/^make\s+sure\s+(.+)$/);
    if (ensure) {
      constraints.push({ kind: 'ensure', expr: ensure[1].trim(), line: row.line });
      i += 1;
      continue;
    }

    throw new ExperimentalChangeSetSyntaxError("Use 'change target:', 'keep ... the same', or 'make sure ...' inside change together.", row.line);
  }

  if (changes.length < 2) {
    throw new ExperimentalChangeSetSyntaxError('change together needs at least two changes. Use ordinary change for one target.', rows[0].line);
  }

  return {
    kind: 'changeSet',
    experimentalSyntaxVersion: PATCH_EXPERIMENTAL_CHANGE_SET_SYNTAX_VERSION,
    name: header[1] ?? null,
    changes,
    constraints,
    line: rows[0].line
  };
}

function parseOperation(row) {
  let match;
  if ((match = row.text.match(/^set(?:\s+([A-Za-z_]\w*))?\s*=\s*(.+)$/))) {
    return { kind: 'changeOp', op: 'set', field: match[1] ?? null, expr: match[2], line: row.line };
  }
  if ((match = row.text.match(/^add\s+(.+?)(?:\s+to\s+([A-Za-z_]\w*))?$/))) {
    return { kind: 'changeOp', op: 'add', field: match[2] ?? null, expr: match[1], line: row.line };
  }
  if ((match = row.text.match(/^remove\s+(.+?)(?:\s+from\s+([A-Za-z_]\w*))?$/))) {
    return { kind: 'changeOp', op: 'remove', field: match[2] ?? null, expr: match[1], line: row.line };
  }
  if ((match = row.text.match(/^clear(?:\s+([A-Za-z_]\w*))?$/))) {
    return { kind: 'changeOp', op: 'clear', field: match[1] ?? null, expr: null, line: row.line };
  }
  throw new ExperimentalChangeSetSyntaxError('Only set, add, remove, or clear can appear inside a change.', row.line);
}
