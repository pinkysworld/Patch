import { inferNumericRange } from './range-analysis.js';

const FORMAL_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);
const PURE_NODES = new Set(['create', 'createThing', 'show', 'why', 'watch', 'history', 'allow', 'uiControl']);

/**
 * Build a translation-validation artifact between the production AST/change
 * analysis and the smaller Lean control-flow model in formal/PatchSignature.lean.
 *
 * This is intentionally conservative. Unsupported language constructs are
 * reported explicitly rather than being treated as formally covered.
 */
export function buildFormalBridge(ast, changeAnalysis) {
  const functions = new Map();
  for (const node of ast) if (node.kind === 'function') functions.set(node.name, node);

  const entries = {};
  entries.$program = bridgeEntry('$program', ast, changeAnalysis.signatures.$program, new Map());

  for (const [name, fn] of functions) {
    entries[name] = bridgeEntry(
      name,
      fn.body,
      changeAnalysis.signatures[name],
      new Map(Object.entries(fn.paramRanges ?? {}))
    );
  }

  return {
    format: 'patch-formal-bridge',
    version: '0.1',
    leanModel: 'PatchSignature',
    theorem: 'changeSignatureSoundness',
    entries,
    summary: {
      supported: Object.values(entries).filter(entry => entry.supported).length,
      unsupported: Object.values(entries).filter(entry => !entry.supported).length,
      mismatches: Object.values(entries).filter(entry => entry.supported && !entry.signatureMatchesProduction).length
    }
  };
}

function bridgeEntry(name, nodes, productionSignature, ranges) {
  const context = { ranges, reasons: new Set(), abstractions: new Set() };
  const core = sequence(nodes.map(node => bridgeNode(node, context)).filter(Boolean));
  const formalSignature = canonicalEffects(inferFormalSignature(core));
  const normalizedProduction = normalizeProductionSignature(productionSignature, context);
  const supported = context.reasons.size === 0;
  const signatureMatchesProduction = supported && sameJson(formalSignature, normalizedProduction);

  if (supported && !signatureMatchesProduction) {
    throw new Error(`Formal bridge mismatch for '${name}': production Change Signature differs from the independently reconstructed formal-core signature.`);
  }

  return {
    name,
    supported,
    reasons: [...context.reasons].sort(),
    abstractions: [...context.abstractions].sort(),
    core,
    formalSignature,
    productionSignature: normalizedProduction,
    signatureMatchesProduction
  };
}

function bridgeNode(node, context) {
  if (PURE_NODES.has(node.kind)) return { kind: 'skip' };
  if (node.kind === 'function') return { kind: 'skip' };

  if (node.kind === 'change') {
    return sequence(node.ops.map(change => {
      const effect = classifyFormalEffect(node, change, context.ranges);
      if (!effect) {
        context.reasons.add(`line ${change.line ?? node.line}: change operation is outside the current Lean effect fragment`);
        return null;
      }
      return { kind: 'emit', effect };
    }).filter(Boolean));
  }

  if (node.kind === 'if') {
    return {
      kind: 'branch',
      then: sequence(node.thenBody.map(child => bridgeNode(child, context)).filter(Boolean)),
      else: sequence(node.elseBody.map(child => bridgeNode(child, context)).filter(Boolean))
    };
  }

  if (node.kind === 'repeat') {
    const count = parseStaticRepeatCount(node.expr);
    if (count === null) {
      context.reasons.add(`line ${node.line}: dynamic repeat count is not yet in the compiler/Lean bridge`);
      return { kind: 'skip' };
    }
    return {
      kind: 'repeat',
      count,
      body: sequence(node.body.map(child => bridgeNode(child, context)).filter(Boolean))
    };
  }

  if (node.kind === 'preview') {
    context.abstractions.add('preview is modeled as no committed effect');
    return { kind: 'skip' };
  }

  if (node.kind === 'call') {
    context.reasons.add(`line ${node.line}: recipe calls are not yet in the compiler/Lean bridge`);
    return { kind: 'skip' };
  }

  if (node.kind === 'return') {
    context.reasons.add(`line ${node.line}: return control flow is not yet in the compiler/Lean bridge`);
    return { kind: 'skip' };
  }

  if (node.kind === 'undo' || node.kind === 'redo') {
    context.reasons.add(`line ${node.line}: ${node.kind} state transitions are not yet in the compiler/Lean bridge`);
    return { kind: 'skip' };
  }

  if (node.kind === 'window' || node.kind === 'event') {
    context.reasons.add(`line ${node.line}: GUI/event execution is not yet in the compiler/Lean bridge`);
    return { kind: 'skip' };
  }

  context.reasons.add(`line ${node.line ?? '?'}: AST node '${node.kind}' is not modeled by the compiler/Lean bridge`);
  return { kind: 'skip' };
}

function classifyFormalEffect(changeNode, change, ranges) {
  const target = changeNode.target;
  const field = change.field ?? null;
  const path = field ? `${target}.${field}` : target;

  if (change.op === 'set') return formalEffect(target, field, path, 'set', null);
  if (change.op === 'clear') return formalEffect(target, field, path, 'clear', null);
  if (change.op !== 'add' && change.op !== 'remove') return null;

  const interval = inferNumericRange(change.expr ?? '', ranges);
  if (!interval) return null;

  if (change.op === 'add') {
    if (interval.min >= 0) return formalEffect(target, field, path, 'increase', interval);
    if (interval.max <= 0) return formalEffect(target, field, path, 'decrease', absRange(interval));
    return null;
  }

  if (interval.min >= 0) return formalEffect(target, field, path, 'decrease', interval);
  if (interval.max <= 0) return formalEffect(target, field, path, 'increase', absRange(interval));
  return null;
}

function formalEffect(target, field, path, operation, amountRange) {
  return {
    target,
    field,
    path,
    operation,
    amountRange: amountRange ? { min: amountRange.min, max: amountRange.max } : null
  };
}

function normalizeProductionSignature(signature, context) {
  const effects = [];
  for (const effect of signature?.changes ?? []) {
    if (effect.committed === false) continue;
    if (effect.unproven) {
      context.reasons.add(`line ${effect.line ?? effect.callLine ?? '?'}: production signature contains an unproven effect`);
      continue;
    }
    if (effect.via) {
      context.reasons.add(`line ${effect.callLine ?? effect.line ?? '?'}: transitive recipe effects are not yet in the compiler/Lean bridge`);
      continue;
    }
    if (!FORMAL_KINDS.has(effect.operation)) {
      context.reasons.add(`line ${effect.line ?? '?'}: production effect '${effect.operation}' is outside the current Lean effect fragment`);
      continue;
    }
    effects.push(formalEffect(
      effect.target,
      effect.field ?? null,
      effect.path,
      effect.operation,
      effect.amountRange ? { min: effect.amountRange.min, max: effect.amountRange.max } : null
    ));
  }
  return canonicalEffects(effects);
}

export function inferFormalSignature(core) {
  switch (core.kind) {
    case 'skip': return [];
    case 'emit': return [core.effect];
    case 'seq': return [...inferFormalSignature(core.first), ...inferFormalSignature(core.second)];
    case 'branch': return [...inferFormalSignature(core.then), ...inferFormalSignature(core.else)];
    case 'repeat': return inferFormalSignature(core.body);
    default: throw new Error(`Unknown formal bridge node '${core.kind}'.`);
  }
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

function canonicalEffects(effects) {
  const map = new Map();
  for (const effect of effects) {
    const normalized = {
      target: effect.target,
      field: effect.field ?? null,
      path: effect.path,
      operation: effect.operation,
      amountRange: effect.amountRange ? { min: effect.amountRange.min, max: effect.amountRange.max } : null
    };
    map.set(JSON.stringify(normalized), normalized);
  }
  return [...map.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function absRange(range) {
  return { min: Math.abs(range.max), max: Math.abs(range.min) };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
