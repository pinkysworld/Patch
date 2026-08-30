import { PATCH_FORMAL_GUARD_VERSION } from './formal-guard.js?v=868f0784ca7f3972';
import { buildIndependentGuardExpression, PATCH_INDEPENDENT_GUARD_EXPRESSION_VERSION } from './independent-guard-expression.js?v=868f0784ca7f3972';

export const PATCH_GUARD_VALIDATION_VERSION = '0.2';

/**
 * Independently reconstruct beta.23 guard trees from raw Patch source.
 *
 * This validator does not import parser.js, consume the production AST, or use
 * the production formal guard expression parser. Indentation/control-flow and
 * Boolean/integer guard expressions are reconstructed through independent code,
 * then compared with compiler-produced formalSource entries before certification.
 */
export function validateFormalGuardExtraction(source, formalSource) {
  const witness = buildRawGuardWitness(source);
  const production = formalSource?.entries ?? {};
  const names = new Set([...Object.keys(production), ...Object.keys(witness.entries)]);
  const entries = {};

  for (const name of [...names].sort()) {
    const expected = production[name] ?? null;
    const observed = witness.entries[name] ?? null;
    const reasons = [];
    if (!expected) reasons.push('production formalSource entry is missing');
    if (!observed) reasons.push('independent raw guard entry is missing');
    if (expected && !expected.supported) reasons.push('production SourceStmt entry is unsupported');
    if (expected && !expected.guardSupported) reasons.push(...(expected.guardReasons ?? []).map(reason => `production guard: ${reason}`));
    if (observed && !observed.supported) reasons.push(...observed.reasons.map(reason => `raw guard validator: ${reason}`));

    const treeMatches = Boolean(expected && observed && canonical(expected.guardTree) === canonical(observed.guardTree));
    const claimsMatch = Boolean(expected && observed && canonical(expected.guardClaims ?? []) === canonical(observed.guardClaims ?? []));
    const variablesMatch = Boolean(expected && observed && canonical(expected.guardVariables ?? []) === canonical(observed.guardVariables ?? []));

    if (expected?.supported && expected?.guardSupported && observed?.supported && !treeMatches) {
      reasons.push('raw-source guard tree disagrees with production AST extraction');
    }
    if (expected?.supported && expected?.guardSupported && observed?.supported && !claimsMatch) {
      reasons.push('raw-source guard claims disagree with production AST extraction');
    }
    if (expected?.supported && expected?.guardSupported && observed?.supported && !variablesMatch) {
      reasons.push('raw-source recipe guard variables disagree with production AST extraction');
    }

    const validated = Boolean(
      expected?.supported && expected?.guardSupported && observed?.supported &&
      treeMatches && claimsMatch && variablesMatch
    );
    entries[name] = {
      name,
      validated,
      productionSourceSupported: Boolean(expected?.supported),
      productionGuardSupported: Boolean(expected?.guardSupported),
      rawGuardSupported: Boolean(observed?.supported),
      treeMatches,
      claimsMatch,
      variablesMatch,
      reasons: unique(reasons),
      rawGuardTree: observed?.guardTree ?? null,
      rawGuardClaims: observed?.guardClaims ?? [],
      rawGuardVariables: observed?.guardVariables ?? []
    };
  }

  const values = Object.values(entries);
  return {
    format: 'patch-guard-extraction-validation',
    version: PATCH_GUARD_VALIDATION_VERSION,
    formalGuardVersion: PATCH_FORMAL_GUARD_VERSION,
    independentGuardExpressionVersion: PATCH_INDEPENDENT_GUARD_EXPRESSION_VERSION,
    producer: 'raw-source-independent-guard-parser',
    comparedAgainst: formalSource?.format ?? 'patch-formal-source',
    entries,
    summary: {
      validated: values.filter(entry => entry.validated).length,
      unvalidated: values.filter(entry => !entry.validated).length,
      mismatches: values.filter(entry =>
        entry.productionSourceSupported && entry.productionGuardSupported && entry.rawGuardSupported &&
        (!entry.treeMatches || !entry.claimsMatch || !entry.variablesMatch)
      ).length
    }
  };
}

export function buildRawGuardWitness(source) {
  const parser = new RawGuardParser(source);
  const nodes = parser.parse();
  const functions = new Map();
  for (const node of nodes) if (node.kind === 'function') functions.set(node.name, node);

  const entries = {};
  entries.$program = guardEntry('$program', nodes, new Set());
  for (const [name, fn] of functions) entries[name] = guardEntry(name, fn.body, new Set(fn.params ?? []));

  return {
    format: 'patch-raw-guard-witness',
    version: PATCH_GUARD_VALIDATION_VERSION,
    formalGuardVersion: PATCH_FORMAL_GUARD_VERSION,
    independentGuardExpressionVersion: PATCH_INDEPENDENT_GUARD_EXPRESSION_VERSION,
    entries
  };
}

class RawGuardParser {
  constructor(source) {
    this.rows = scanRows(source);
    this.index = 0;
  }

  parse() { return this.block(0); }

  block(indent) {
    const nodes = [];
    while (this.index < this.rows.length) {
      const row = this.rows[this.index];
      if (row.indent < indent || row.text === 'else:') break;
      if (row.indent > indent) {
        nodes.push({ kind: 'unsupported', line: row.line, reason: `unexpected indentation at line ${row.line}` });
        this.index += 1;
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
      const parsed = parseParamNames(match[2], row.line);
      return { kind: 'function', name: match[1], params: parsed.params, reasons: parsed.reasons, body: this.childBlock(indent, row), line: row.line };
    }

    if ((match = row.text.match(/^change\s+([A-Za-z_]\w*)(?:\s+called\s+[A-Za-z_]\w*)?\s*:\s*$/))) {
      return { kind: 'change', body: this.childBlock(indent, row), line: row.line };
    }

    if (/^(?:set|add|remove|clear)(?:\s|$)/.test(row.text)) return { kind: 'changeOp', line: row.line };

    if ((match = row.text.match(/^if\s+(.+?)\s*:\s*$/))) {
      const thenBody = this.childBlock(indent, row);
      let elseBody = [];
      if (this.index < this.rows.length && this.rows[this.index].indent === indent && this.rows[this.index].text === 'else:') {
        const elseRow = this.rows[this.index++];
        elseBody = this.childBlock(indent, elseRow);
      }
      return { kind: 'if', expr: match[1].trim(), thenBody, elseBody, line: row.line };
    }

    if ((match = row.text.match(/^repeat\s+(.+)\s*:\s*$/))) {
      return { kind: 'repeat', expr: match[1].trim(), body: this.childBlock(indent, row), line: row.line };
    }

    if (row.text === 'preview:') {
      this.childBlock(indent, row);
      return { kind: 'leaf', line: row.line };
    }

    if (/^allow\s+[A-Za-z_]\w*\s*:\s*$/.test(row.text) ||
        /^create\s+(?:thing\s+)?[A-Za-z_]\w*\s*:\s*$/.test(row.text) ||
        /^window\s+.+\s*:\s*$/.test(row.text) ||
        /^when\s+[A-Za-z_]\w*\s+(?:clicked|changed|closed)\s*:\s*$/.test(row.text)) {
      this.childBlock(indent, row);
      return { kind: 'leaf', line: row.line };
    }

    // All other single-line statements occupy one SourceStmt skip/unsupported
    // leaf for guard-shape purposes. Source validation separately decides
    // whether the corresponding SourceStmt entry is certifiable.
    return { kind: 'leaf', line: row.line };
  }
}

function guardEntry(name, nodes, allowedVariables) {
  const context = { allowedVariables, reasons: new Set(), guardClaims: [] };
  for (const node of nodes) if (node.kind === 'function' && node.reasons?.length) for (const reason of node.reasons) context.reasons.add(reason);
  const guardTree = sequenceGuard(nodes.map(node => rawGuardNode(node, context)).filter(Boolean));
  return {
    name,
    supported: context.reasons.size === 0,
    reasons: [...context.reasons].sort(),
    guardVariables: [...allowedVariables].sort(),
    guardClaims: context.guardClaims,
    guardTree
  };
}

function rawGuardNode(node, context) {
  if (node.kind === 'unsupported') {
    context.reasons.add(node.reason);
    return { kind: 'leaf' };
  }
  if (node.kind === 'leaf' || node.kind === 'function') return { kind: 'leaf' };
  if (node.kind === 'changeOp') {
    context.reasons.add(`line ${node.line}: change operation appears outside a change block`);
    return { kind: 'leaf' };
  }
  if (node.kind === 'change') {
    return sequenceGuard((node.body ?? []).map(child => {
      if (child.kind !== 'changeOp') {
        context.reasons.add(`line ${child.line ?? node.line}: non-change statement appears directly inside change`);
      }
      return { kind: 'leaf' };
    }));
  }
  if (node.kind === 'if') {
    const formal = buildIndependentGuardExpression(node.expr, context.allowedVariables);
    let guard = null;
    if (!formal.supported) {
      context.reasons.add(`line ${node.line}: condition is outside the beta.23 guard-aware fragment: ${formal.reason}`);
    } else {
      guard = formal.expr;
      context.guardClaims.push({
        line: node.line,
        expression: node.expr,
        expr: formal.expr,
        variables: formal.variables
      });
    }
    return {
      kind: 'branch',
      guard,
      then: sequenceGuard((node.thenBody ?? []).map(child => rawGuardNode(child, context))),
      else: sequenceGuard((node.elseBody ?? []).map(child => rawGuardNode(child, context)))
    };
  }
  if (node.kind === 'repeat') {
    const count = staticRepeat(node.expr);
    if (count === null) {
      // SourceStmt validation will reject the dynamic repeat. Keep one leaf so
      // the raw guard parser does not pretend to validate its execution shape.
      return { kind: 'leaf' };
    }
    return { kind: 'repeat', count, body: sequenceGuard((node.body ?? []).map(child => rawGuardNode(child, context))) };
  }
  context.reasons.add(`line ${node.line ?? '?'}: raw guard node '${node.kind}' is not modeled`);
  return { kind: 'leaf' };
}

function scanRows(source) {
  const rows = [];
  String(source).replace(/\t/g, '  ').split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim() || raw.trimStart().startsWith('#')) return;
    rows.push({ text: raw.trim(), indent: raw.length - raw.trimStart().length, line: index + 1 });
  });
  return rows;
}

function parseParamNames(text, line) {
  const params = [];
  const reasons = [];
  if (!text.trim()) return { params, reasons };
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const re = new RegExp(`^([A-Za-z_]\\w*)(?:\\s+number\\s+(${number})\\.\\.(${number}))?$`);
  for (const part of splitSimpleArgs(text)) {
    const match = part.match(re);
    if (!match) reasons.push(`line ${line}: raw guard validator cannot parse recipe parameter '${part}'`);
    else params.push(match[1]);
  }
  return { params, reasons };
}

function splitSimpleArgs(text) {
  if (!text.trim()) return [];
  return text.split(',').map(part => part.trim()).filter(Boolean);
}

function staticRepeat(expr) {
  const text = String(expr ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const count = Number(text);
  return Number.isSafeInteger(count) ? count : null;
}

function sequenceGuard(nodes) {
  if (!nodes.length) return { kind: 'leaf' };
  return nodes.reduce((left, right) => ({ kind: 'seq', first: left, second: right }));
}

function canonical(value) { return JSON.stringify(value); }
function unique(values) { return [...new Set(values)]; }
