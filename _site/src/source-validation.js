import { buildIndependentRangeExpression, PATCH_INDEPENDENT_RANGE_EXPRESSION_VERSION } from './independent-range-expression.js?v=9ad29318e93c7c71';

export const PATCH_SOURCE_VALIDATION_VERSION = '0.2';
const SOURCE_OPS = new Set(['add', 'remove', 'set', 'clear']);

/**
 * Independently reconstruct the formal source/range view from raw Patch text.
 *
 * This module deliberately does not import parser.js, formal-range.js, or
 * range-analysis.js and does not consume the production AST. It uses a small
 * indentation-aware source parser plus an independent numeric expression parser
 * and interval evaluator for the supported formal source subset. The result is
 * compared with compiler-produced formalSource entries before certification.
 */
export function validateFormalSourceExtraction(source, formalSource) {
  const witness = buildRawSourceWitness(source);
  const production = formalSource?.entries ?? {};
  const names = new Set([...Object.keys(production), ...Object.keys(witness.entries)]);
  const entries = {};

  for (const name of [...names].sort()) {
    const expected = production[name] ?? null;
    const observed = witness.entries[name] ?? null;
    const reasons = [];
    if (!expected) reasons.push('production formalSource entry is missing');
    if (!observed) reasons.push('independent raw-source entry is missing');
    if (expected && !expected.supported) reasons.push('production formalSource marks this entry unsupported');
    if (observed && !observed.supported) reasons.push(...observed.reasons.map(reason => `raw source validator: ${reason}`));

    const sourceMatches = Boolean(expected && observed && canonical(expected.source) === canonical(observed.source));
    const rangeClaimsMatch = Boolean(expected && observed && canonical(expected.rangeClaims ?? []) === canonical(observed.rangeClaims ?? []));
    if (expected?.supported && observed?.supported && !sourceMatches) reasons.push('raw-source SourceStmt disagrees with production AST extraction');
    if (expected?.supported && observed?.supported && !rangeClaimsMatch) reasons.push('raw-source range claims disagree with production AST extraction');

    const validated = Boolean(expected?.supported && observed?.supported && sourceMatches && rangeClaimsMatch);
    entries[name] = {
      name,
      validated,
      productionSupported: Boolean(expected?.supported),
      rawSourceSupported: Boolean(observed?.supported),
      sourceMatches,
      rangeClaimsMatch,
      reasons: unique(reasons),
      rawSource: observed?.source ?? null,
      rawRangeClaims: observed?.rangeClaims ?? []
    };
  }

  const values = Object.values(entries);
  return {
    format: 'patch-source-extraction-validation',
    version: PATCH_SOURCE_VALIDATION_VERSION,
    independentRangeExpressionVersion: PATCH_INDEPENDENT_RANGE_EXPRESSION_VERSION,
    producer: 'raw-source-independent-parser',
    comparedAgainst: formalSource?.format ?? 'patch-formal-source',
    entries,
    summary: {
      validated: values.filter(entry => entry.validated).length,
      unvalidated: values.filter(entry => !entry.validated).length,
      mismatches: values.filter(entry => entry.productionSupported && entry.rawSourceSupported && (!entry.sourceMatches || !entry.rangeClaimsMatch)).length
    }
  };
}

export function buildRawSourceWitness(source) {
  const parser = new RawFormalParser(source);
  const nodes = parser.parse();
  const functions = new Map();
  for (const node of nodes) if (node.kind === 'function') functions.set(node.name, node);

  const entries = {};
  entries.$program = witnessEntry('$program', nodes, new Map());
  for (const [name, fn] of functions) entries[name] = witnessEntry(name, fn.body, new Map(Object.entries(fn.paramRanges ?? {})));

  return {
    format: 'patch-raw-source-witness',
    version: PATCH_SOURCE_VALIDATION_VERSION,
    independentRangeExpressionVersion: PATCH_INDEPENDENT_RANGE_EXPRESSION_VERSION,
    entries
  };
}

class RawFormalParser {
  constructor(source) {
    this.rows = scanRows(source);
    this.index = 0;
  }

  parse() {
    return this.block(0);
  }

  block(indent) {
    const nodes = [];
    while (this.index < this.rows.length) {
      const row = this.rows[this.index];
      if (row.indent < indent || row.text === 'else:') break;
      if (row.indent > indent) {
        nodes.push({ kind: 'unsupported', line: row.line, reason: `unexpected indentation at line ${row.line}` });
        this.index++;
        continue;
      }
      nodes.push(this.statement(indent));
    }
    return nodes;
  }

  childBlock(parentIndent, row) {
    if (this.index >= this.rows.length || this.rows[this.index].indent <= parentIndent) {
      return [{ kind: 'unsupported', line: row.line, reason: `missing indented block below line ${row.line}` }];
    }
    return this.block(this.rows[this.index].indent);
  }

  statement(indent) {
    const row = this.rows[this.index++];
    let match;

    if ((match = row.text.match(/^make\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:\s*$/))) {
      const parsed = parseRawParams(match[2], row.line);
      return { kind: 'function', name: match[1], paramRanges: parsed.ranges, body: this.childBlock(indent, row), line: row.line, paramReasons: parsed.reasons };
    }

    if ((match = row.text.match(/^change\s+([A-Za-z_]\w*)(?:\s+called\s+[A-Za-z_]\w*)?\s*:\s*$/))) {
      const body = this.childBlock(indent, row);
      return { kind: 'change', target: match[1], ops: body, line: row.line };
    }

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

    if ((match = row.text.match(/^if\s+.+\s*:\s*$/))) {
      const thenBody = this.childBlock(indent, row);
      let elseBody = [];
      if (this.index < this.rows.length && this.rows[this.index].indent === indent && this.rows[this.index].text === 'else:') {
        const elseRow = this.rows[this.index++];
        elseBody = this.childBlock(indent, elseRow);
      }
      return { kind: 'if', thenBody, elseBody, line: row.line };
    }

    if ((match = row.text.match(/^repeat\s+(.+)\s*:\s*$/))) {
      return { kind: 'repeat', expr: match[1], body: this.childBlock(indent, row), line: row.line };
    }

    if (row.text === 'preview:') {
      this.childBlock(indent, row);
      return { kind: 'preview', line: row.line };
    }

    if ((match = row.text.match(/^allow\s+[A-Za-z_]\w*\s*:\s*$/))) {
      this.childBlock(indent, row);
      return { kind: 'pure', line: row.line };
    }

    if ((match = row.text.match(/^create\s+(?:thing\s+)?[A-Za-z_]\w*\s*:\s*$/))) {
      this.childBlock(indent, row);
      return { kind: 'pure', line: row.line };
    }

    if ((match = row.text.match(/^window\s+.+\s*:\s*$/))) {
      this.childBlock(indent, row);
      return { kind: 'unsupported', line: row.line, reason: `line ${row.line}: GUI/event execution is not yet in the formal source core` };
    }
    if ((match = row.text.match(/^when\s+[A-Za-z_]\w*\s+(?:clicked|changed|closed)\s*:\s*$/))) {
      this.childBlock(indent, row);
      return { kind: 'unsupported', line: row.line, reason: `line ${row.line}: GUI/event execution is not yet in the formal source core` };
    }

    if (/^do\s+[A-Za-z_]\w*\s*\(.*\)\s*$/.test(row.text)) return { kind: 'unsupported', line: row.line, reason: `line ${row.line}: recipe calls are not yet in the formal source core` };
    if (/^return(?:\s+.+)?$/.test(row.text)) return { kind: 'unsupported', line: row.line, reason: `line ${row.line}: return control flow is not yet in the formal source core` };
    if (/^undo(?:\s+[A-Za-z_]\w*)?$/.test(row.text)) return { kind: 'unsupported', line: row.line, reason: `line ${row.line}: undo is not yet in the formal source core` };
    if (row.text === 'redo') return { kind: 'unsupported', line: row.line, reason: `line ${row.line}: redo is not yet in the formal source core` };

    if (/^create\s+(?:number|text|boolean|list)\s+[A-Za-z_]\w*\s*=/.test(row.text) ||
        /^(?:show|why)\s+/.test(row.text) ||
        /^(?:watch|history)\s+[A-Za-z_]\w*$/.test(row.text) ||
        /^(?:text\s+.+|button\s+.+\s+as\s+[A-Za-z_]\w*|input\s+[A-Za-z_]\w*)$/.test(row.text) ||
        /^[A-Za-z_]\w*\s+may\s+/.test(row.text) ||
        /^[A-Za-z_]\w*\s*=\s*.+$/.test(row.text)) {
      return { kind: 'pure', line: row.line };
    }

    if (row.text.endsWith(':') && this.index < this.rows.length && this.rows[this.index].indent > indent) this.childBlock(indent, row);
    return { kind: 'unsupported', line: row.line, reason: `line ${row.line}: raw source validator does not model '${row.text}'` };
  }
}

function witnessEntry(name, nodes, ranges) {
  const context = { ranges, reasons: new Set(), rangeClaims: [] };
  for (const node of nodes) if (node.kind === 'function' && node.paramReasons?.length) for (const reason of node.paramReasons) context.reasons.add(reason);
  const source = sequence(nodes.map(node => witnessNode(node, context)).filter(Boolean));
  return {
    name,
    supported: context.reasons.size === 0,
    reasons: [...context.reasons].sort(),
    rangeClaims: context.rangeClaims,
    source
  };
}

function witnessNode(node, context) {
  if (node.kind === 'pure' || node.kind === 'function' || node.kind === 'preview') return { kind: 'skip' };
  if (node.kind === 'unsupported') {
    context.reasons.add(node.reason);
    return { kind: 'skip' };
  }
  if (node.kind === 'changeOp') {
    context.reasons.add(`line ${node.line}: change operation appears outside a change block`);
    return { kind: 'skip' };
  }
  if (node.kind === 'change') {
    return sequence((node.ops ?? []).map(operation => {
      if (operation.kind !== 'changeOp') {
        context.reasons.add(`line ${operation.line ?? node.line}: non-change statement appears directly inside change`);
        return null;
      }
      const change = rawSourceChange(node, operation, context);
      return change ? { kind: 'change', change } : null;
    }).filter(Boolean));
  }
  if (node.kind === 'if') {
    return {
      kind: 'branch',
      then: sequence(node.thenBody.map(child => witnessNode(child, context)).filter(Boolean)),
      else: sequence(node.elseBody.map(child => witnessNode(child, context)).filter(Boolean))
    };
  }
  if (node.kind === 'repeat') {
    const count = staticRepeat(node.expr);
    if (count === null) {
      context.reasons.add(`line ${node.line}: dynamic repeat count is not yet in the formal source core`);
      return { kind: 'skip' };
    }
    return { kind: 'repeat', count, body: sequence(node.body.map(child => witnessNode(child, context)).filter(Boolean)) };
  }
  context.reasons.add(`line ${node.line ?? '?'}: raw witness node '${node.kind}' is not modeled`);
  return { kind: 'skip' };
}

function rawSourceChange(changeNode, operation, context) {
  if (!SOURCE_OPS.has(operation.op)) {
    context.reasons.add(`line ${operation.line}: source change '${operation.op}' is outside the formal source-core vocabulary`);
    return null;
  }
  const target = changeNode.target;
  const field = operation.field ?? null;
  const path = field ? `${target}.${field}` : target;
  if (operation.op === 'set' || operation.op === 'clear') return { target, field, path, operation: operation.op, amountRange: null };

  const expression = operation.expr ?? '';
  const independent = buildIndependentRangeExpression(expression, context.ranges);
  if (!independent.supported) {
    context.reasons.add(`line ${operation.line}: numeric expression is outside the independently validated range fragment: ${independent.reason}`);
    return null;
  }
  if (independent.range.min < 0 && independent.range.max > 0) {
    context.reasons.add(`line ${operation.line}: numeric source change range crosses zero and has no single semantic direction`);
    return null;
  }
  context.rangeClaims.push({
    line: operation.line,
    target,
    field,
    path,
    sourceOperation: operation.op,
    expression,
    expr: independent.expr,
    bindings: independent.bindings,
    range: { min: independent.range.min, max: independent.range.max }
  });
  return { target, field, path, operation: operation.op, amountRange: { min: independent.range.min, max: independent.range.max } };
}

function scanRows(source) {
  const rows = [];
  String(source).replace(/\t/g, '  ').split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim() || raw.trimStart().startsWith('#')) return;
    rows.push({ text: raw.trim(), indent: raw.length - raw.trimStart().length, line: index + 1 });
  });
  return rows;
}

function parseRawParams(text, line) {
  const ranges = {};
  const reasons = [];
  if (!text.trim()) return { ranges, reasons };
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const re = new RegExp(`^([A-Za-z_]\\w*)(?:\\s+number\\s+(${number})\\.\\.(${number}))?$`);
  for (const part of splitSimpleArgs(text)) {
    const match = part.match(re);
    if (!match) {
      reasons.push(`line ${line}: raw source validator cannot parse recipe parameter '${part}'`);
      continue;
    }
    if (match[2] !== undefined) {
      const min = Number(match[2]);
      const max = Number(match[3]);
      if (min > max) reasons.push(`line ${line}: raw source validator found reversed range for '${match[1]}'`);
      else ranges[match[1]] = { min, max };
    }
  }
  return { ranges, reasons };
}

function splitSimpleArgs(text) {
  if (!text.trim()) return [];
  const out = [];
  let current = '';
  let depth = 0;
  for (const char of text) {
    if (char === '(' || char === '[') depth++;
    if (char === ')' || char === ']') depth--;
    if (char === ',' && depth === 0) { out.push(current.trim()); current = ''; continue; }
    current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function staticRepeat(expr) {
  const text = String(expr ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const count = Number(text);
  return Number.isSafeInteger(count) ? count : null;
}

function sequence(nodes) {
  if (!nodes.length) return { kind: 'skip' };
  return nodes.reduce((first, second) => ({ kind: 'seq', first, second }));
}

function canonical(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortDeep(value[key])]));
  }
  return value;
}

function unique(values) {
  return [...new Set(values)].sort();
}
