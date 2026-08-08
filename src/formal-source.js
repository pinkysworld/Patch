import { inferNumericRange } from './range-analysis.js';

const PURE_NODES = new Set(['create', 'createThing', 'show', 'why', 'watch', 'history', 'allow', 'uiControl']);
const SOURCE_CHANGE_KINDS = new Set(['add', 'remove', 'set', 'clear']);

/**
 * Build a proof-free source-core view from the production AST.
 *
 * Unlike formal-bridge.js, this layer preserves source mutation verbs
 * (`add`, `remove`, `set`, `clear`) instead of pre-classifying them as semantic
 * increase/decrease effects. Lean's PatchSource module performs that semantic
 * normalization and checks that it lowers to the separately emitted evidence.
 */
export function buildFormalSource(ast) {
  const functions = new Map();
  for (const node of ast) if (node.kind === 'function') functions.set(node.name, node);

  const entries = {};
  entries.$program = sourceEntry('$program', ast, new Map());
  for (const [name, fn] of functions) {
    entries[name] = sourceEntry(name, fn.body, new Map(Object.entries(fn.paramRanges ?? {})));
  }

  return {
    format: 'patch-formal-source',
    version: '0.1',
    leanModel: 'PatchSource',
    entries,
    summary: {
      supported: Object.values(entries).filter(entry => entry.supported).length,
      unsupported: Object.values(entries).filter(entry => !entry.supported).length
    }
  };
}

function sourceEntry(name, nodes, ranges) {
  const context = { ranges, reasons: new Set(), abstractions: new Set() };
  const source = sequence(nodes.map(node => sourceNode(node, context)).filter(Boolean));
  return {
    name,
    supported: context.reasons.size === 0,
    reasons: [...context.reasons].sort(),
    abstractions: [...context.abstractions].sort(),
    source
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

  const interval = inferNumericRange(change.expr ?? '', context.ranges);
  if (!interval) {
    context.reasons.add(`line ${change.line ?? changeNode.line}: numeric source change amount has no proven range`);
    return null;
  }

  if (interval.min < 0 && interval.max > 0) {
    context.reasons.add(`line ${change.line ?? changeNode.line}: numeric source change range crosses zero and has no single semantic direction`);
    return null;
  }

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

function parseStaticRepeatCount(expr) {
  const text = String(expr ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const count = Number(text);
  return Number.isSafeInteger(count) ? count : null;
}
