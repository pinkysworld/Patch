import { inferNumericRange } from './range-analysis.js';
import { buildFormalRangeExpression } from './formal-range.js';
import { buildFormalGuardExpression, PATCH_FORMAL_GUARD_VERSION } from './formal-guard.js';

const PURE_NODES = new Set(['create', 'createThing', 'show', 'why', 'watch', 'history', 'allow', 'uiControl']);
const SOURCE_CHANGE_KINDS = new Set(['add', 'remove', 'set', 'clear']);

/**
 * Build a proof-free source-core view from the production AST.
 *
 * The ordinary `source` field preserves source mutation verbs for PatchSource.
 * Beta.23 adds a parallel `guardTree`: the same source/control-flow shape plus
 * conservative integer/Boolean guards over recipe parameters. The two artifacts
 * remain separate so existing SourceStmt/signature/policy proofs are unchanged.
 */
export function buildFormalSource(ast) {
  const functions = new Map();
  for (const node of ast) if (node.kind === 'function') functions.set(node.name, node);

  const entries = {};
  entries.$program = sourceEntry('$program', ast, new Map(), new Set());
  for (const [name, fn] of functions) {
    entries[name] = sourceEntry(
      name,
      fn.body,
      new Map(Object.entries(fn.paramRanges ?? {})),
      new Set(fn.params ?? [])
    );
  }

  const values = Object.values(entries);
  return {
    format: 'patch-formal-source',
    version: '0.3',
    leanModel: 'PatchSource+PatchRange+PatchGuarded',
    formalGuardVersion: PATCH_FORMAL_GUARD_VERSION,
    entries,
    summary: {
      supported: values.filter(entry => entry.supported).length,
      unsupported: values.filter(entry => !entry.supported).length,
      rangeClaims: values.reduce((sum, entry) => sum + entry.rangeClaims.length, 0),
      guardSupported: values.filter(entry => entry.guardSupported).length,
      guardUnsupported: values.filter(entry => !entry.guardSupported).length,
      guardClaims: values.reduce((sum, entry) => sum + entry.guardClaims.length, 0)
    }
  };
}

function sourceEntry(name, nodes, ranges, guardVariables) {
  const context = {
    ranges,
    guardVariables,
    reasons: new Set(),
    abstractions: new Set(),
    rangeClaims: [],
    guardReasons: new Set(),
    guardClaims: []
  };
  const source = sequence(nodes.map(node => sourceNode(node, context)).filter(Boolean));
  const guardTree = sequenceGuard(nodes.map(node => guardNode(node, context)).filter(Boolean));
  return {
    name,
    supported: context.reasons.size === 0,
    reasons: [...context.reasons].sort(),
    abstractions: [...context.abstractions].sort(),
    rangeClaims: context.rangeClaims,
    source,
    guardSupported: context.reasons.size === 0 && context.guardReasons.size === 0,
    guardReasons: [...context.guardReasons].sort(),
    guardClaims: context.guardClaims,
    guardVariables: [...guardVariables].sort(),
    guardTree
  };
}

function sourceNode(node, context) {
  if (PURE_NODES.has(node.kind) || node.kind === 'function') return { kind: 'skip' };

  if (node.kind === 'change') {
    return sequence(node.ops.map(change => {
      const sourceChange = classifySourceChange(node, change, context);
      return sourceChange ? { kind: 'change', change: sourceChange } : null;
    }).filter(Boolean));
  }

  if (node.kind === 'if') {
    return {
      kind: 'branch',
      then: sequence(node.thenBody.map(child => sourceNode(child, context)).filter(Boolean)),
      else: sequence(node.elseBody.map(child => sourceNode(child, context)).filter(Boolean))
    };
  }

  if (node.kind === 'repeat') {
    const count = parseStaticRepeatCount(node.expr);
    if (count === null) {
      context.reasons.add(`line ${node.line}: dynamic repeat count is not yet in the formal source core`);
      return { kind: 'skip' };
    }
    return {
      kind: 'repeat',
      count,
      body: sequence(node.body.map(child => sourceNode(child, context)).filter(Boolean))
    };
  }

  if (node.kind === 'preview') {
    context.abstractions.add('preview is modeled as no committed source-core change');
    return { kind: 'skip' };
  }

  if (node.kind === 'call') {
    context.reasons.add(`line ${node.line}: recipe calls are not yet in the formal source core`);
    return { kind: 'skip' };
  }

  if (node.kind === 'return') {
    context.reasons.add(`line ${node.line}: return control flow is not yet in the formal source core`);
    return { kind: 'skip' };
  }

  if (node.kind === 'undo' || node.kind === 'redo') {
    context.reasons.add(`line ${node.line}: ${node.kind} is not yet in the formal source core`);
    return { kind: 'skip' };
  }

  if (node.kind === 'window' || node.kind === 'event') {
    context.reasons.add(`line ${node.line}: GUI/event execution is not yet in the formal source core`);
    return { kind: 'skip' };
  }

  context.reasons.add(`line ${node.line ?? '?'}: AST node '${node.kind}' is not modeled by the formal source core`);
  return { kind: 'skip' };
}

/** Build a control-flow tree whose leaves line up with SourceStmt skip/change. */
function guardNode(node, context) {
  if (PURE_NODES.has(node.kind) || node.kind === 'function' || node.kind === 'preview') return { kind: 'leaf' };

  if (node.kind === 'change') {
    return sequenceGuard((node.ops ?? []).map(() => ({ kind: 'leaf' })));
  }

  if (node.kind === 'if') {
    const formal = buildFormalGuardExpression(node.expr, context.guardVariables);
    let guard = null;
    if (!formal.supported) {
      context.guardReasons.add(`line ${node.line}: condition is outside the beta.23 guard-aware fragment: ${formal.reason}`);
    } else {
      guard = formal.expr;
      context.guardClaims.push({
        line: node.line,
        expression: String(node.expr).trim(),
        expr: formal.expr,
        variables: formal.variables
      });
    }
    return {
      kind: 'branch',
      guard,
      then: sequenceGuard(node.thenBody.map(child => guardNode(child, context)).filter(Boolean)),
      else: sequenceGuard(node.elseBody.map(child => guardNode(child, context)).filter(Boolean))
    };
  }

  if (node.kind === 'repeat') {
    const count = parseStaticRepeatCount(node.expr);
    if (count === null) return { kind: 'leaf' };
    return {
      kind: 'repeat',
      count,
      body: sequenceGuard(node.body.map(child => guardNode(child, context)).filter(Boolean))
    };
  }

  // Unsupported SourceStmt nodes already make the source entry uncertifiable.
  return { kind: 'leaf' };
}

function classifySourceChange(changeNode, change, context) {
  if (!SOURCE_CHANGE_KINDS.has(change.op)) {
    context.reasons.add(`line ${change.line ?? changeNode.line}: source change '${change.op}' is outside the formal source-core vocabulary`);
    return null;
  }

  const target = changeNode.target;
  const field = change.field ?? null;
  const path = field ? `${target}.${field}` : target;

  if (change.op === 'set' || change.op === 'clear') {
    return { target, field, path, operation: change.op, amountRange: null };
  }

  const expression = change.expr ?? '';
  const interval = inferNumericRange(expression, context.ranges);
  if (!interval) {
    context.reasons.add(`line ${change.line ?? changeNode.line}: numeric source change amount has no proven production range`);
    return null;
  }

  const formal = buildFormalRangeExpression(expression, context.ranges);
  if (!formal.supported) {
    context.reasons.add(`line ${change.line ?? changeNode.line}: numeric expression is outside the beta.9 verified range fragment: ${formal.reason}`);
    return null;
  }

  if (formal.range.min !== interval.min || formal.range.max !== interval.max) {
    context.reasons.add(`line ${change.line ?? changeNode.line}: production range ${interval.min}..${interval.max} disagrees with independent formal-range extraction ${formal.range.min}..${formal.range.max}`);
    return null;
  }

  if (interval.min < 0 && interval.max > 0) {
    context.reasons.add(`line ${change.line ?? changeNode.line}: numeric source change range crosses zero and has no single semantic direction`);
    return null;
  }

  context.rangeClaims.push({
    line: change.line ?? changeNode.line,
    target,
    field,
    path,
    sourceOperation: change.op,
    expression,
    expr: formal.expr,
    bindings: formal.bindings,
    range: { min: formal.range.min, max: formal.range.max }
  });

  return {
    target,
    field,
    path,
    operation: change.op,
    amountRange: { min: interval.min, max: interval.max }
  };
}

function sequence(nodes) {
  if (!nodes.length) return { kind: 'skip' };
  return nodes.reduce((left, right) => ({ kind: 'seq', first: left, second: right }));
}

function sequenceGuard(nodes) {
  if (!nodes.length) return { kind: 'leaf' };
  return nodes.reduce((left, right) => ({ kind: 'seq', first: left, second: right }));
}

function parseStaticRepeatCount(expr) {
  const text = String(expr ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const count = Number(text);
  return Number.isSafeInteger(count) ? count : null;
}
