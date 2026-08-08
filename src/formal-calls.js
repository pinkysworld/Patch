import { buildFormalRangeExpression } from './formal-range.js';

export const PATCH_FORMAL_CALLS_VERSION = '0.1';

const FORMAL_EFFECT_KINDS = new Set(['increase', 'decrease', 'set', 'clear']);

/**
 * Build a conservative proof-oriented view of the existing acyclic numeric
 * recipe-call subset. This does not execute calls and does not claim full
 * substitution semantics: it records enough structure for Lean to check that
 * call arguments fit declared parameter intervals and that callee signatures
 * compose inside caller signatures.
 */
export function buildFormalCalls(ast, changeAnalysis) {
  const collected = collectRecipes(ast);
  const ranks = rankRecipes(collected.recipes);
  const entries = {};

  for (const [name, fn] of collected.recipes) {
    const reasons = [];
    if (collected.duplicates.has(name)) reasons.push(`recipe '${name}' is declared more than once`);
    if (ranks.cycles.has(name)) reasons.push(`recipe '${name}' participates in a recursive/cyclic call graph`);

    const signature = changeAnalysis?.signatures?.[name];
    if (!signature) reasons.push(`production Change Signature for '${name}' is missing`);

    const paramRanges = [];
    const bindings = {};
    for (const param of fn.params ?? []) {
      const range = fn.paramRanges?.[param];
      if (!isSafeIntegerRange(range)) {
        reasons.push(`parameter '${param}' has no safe integer range for formal call checking`);
        continue;
      }
      const normalized = { min: range.min, max: range.max };
      bindings[param] = normalized;
      paramRanges.push({ name: param, range: normalized });
    }

    const formalSignature = [];
    if (signature) {
      for (const effect of signature.changes ?? []) {
        if (effect.committed === false) continue;
        const normalized = normalizeEffect(effect, reasons, `signature of '${name}'`);
        if (normalized) formalSignature.push(normalized);
      }
    }

    const lowered = lowerBlock(fn.body ?? [], {
      caller: name,
      callerSignature: signature,
      callerBindings: bindings,
      recipes: collected.recipes,
      ranks: ranks.values,
      reasons
    });

    entries[name] = {
      supported: reasons.length === 0,
      rank: ranks.values.get(name) ?? null,
      params: [...(fn.params ?? [])],
      paramRanges,
      signature: dedupe(formalSignature),
      body: lowered,
      reasons: dedupeStrings(reasons)
    };
  }

  const values = Object.values(entries);
  return {
    format: 'patch-formal-calls',
    version: PATCH_FORMAL_CALLS_VERSION,
    leanModel: 'PatchCalls.CallStmt/RecipeDef',
    theorem: 'PatchCalls.checkedRecipeExecutionCannotEscape',
    entries,
    summary: {
      supported: values.filter(entry => entry.supported).length,
      unsupported: values.filter(entry => !entry.supported).length,
      cycles: ranks.cycles.size
    }
  };
}

function collectRecipes(ast) {
  const recipes = new Map();
  const duplicates = new Set();
  const visit = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'function') {
        if (recipes.has(node.name)) duplicates.add(node.name);
        else recipes.set(node.name, node);
        // Nested declarations are outside the direct recipe subset; still scan
        // their bodies for duplicate declarations so they cannot be hidden.
        visit(node.body);
        continue;
      }
      if (node.body) visit(node.body);
      if (node.thenBody) visit(node.thenBody);
      if (node.elseBody) visit(node.elseBody);
    }
  };
  visit(ast);
  return { recipes, duplicates };
}

function rankRecipes(recipes) {
  const dependencies = new Map();
  for (const [name, fn] of recipes) dependencies.set(name, collectDirectCalls(fn.body));

  const state = new Map();
  const values = new Map();
  const cycles = new Set();
  const stack = [];

  const visit = name => {
    if (state.get(name) === 'done') return values.get(name) ?? 0;
    if (state.get(name) === 'visiting') {
      const start = stack.lastIndexOf(name);
      for (const member of stack.slice(start < 0 ? 0 : start)) cycles.add(member);
      cycles.add(name);
      return 0;
    }
    state.set(name, 'visiting');
    stack.push(name);
    let rank = 0;
    for (const callee of dependencies.get(name) ?? []) {
      if (!recipes.has(callee)) continue;
      rank = Math.max(rank, visit(callee) + 1);
    }
    stack.pop();
    state.set(name, 'done');
    values.set(name, rank);
    return rank;
  };

  for (const name of recipes.keys()) visit(name);
  return { values, cycles };
}

function collectDirectCalls(nodes) {
  const calls = new Set();
  const visit = list => {
    for (const node of list ?? []) {
      if (node.kind === 'function') continue;
      if (node.kind === 'call') calls.add(node.name);
      if (node.body) visit(node.body);
      if (node.thenBody) visit(node.thenBody);
      if (node.elseBody) visit(node.elseBody);
    }
  };
  visit(nodes);
  return calls;
}

function lowerBlock(nodes, context) {
  const statements = [];
  for (const node of nodes ?? []) {
    if (node.kind === 'function') {
      context.reasons.push(`nested recipe declaration at line ${node.line ?? '?'} is outside the formal call core`);
      continue;
    }
    const lowered = lowerNode(node, context);
    if (lowered) statements.push(lowered);
  }
  return sequence(statements);
}

function lowerNode(node, context) {
  switch (node.kind) {
    case 'change': {
      const effects = [];
      for (const operation of node.ops ?? []) {
        const effect = (context.callerSignature?.changes ?? []).find(candidate =>
          !candidate.via &&
          candidate.changeLine === node.line &&
          candidate.line === operation.line &&
          candidate.committed !== false
        );
        if (!effect) {
          context.reasons.push(`line ${operation.line ?? node.line ?? '?'}: direct semantic effect is missing from the production signature`);
          continue;
        }
        const normalized = normalizeEffect(effect, context.reasons, `line ${operation.line ?? node.line ?? '?'}`);
        if (normalized) effects.push({ kind: 'emit', effect: normalized });
      }
      return sequence(effects);
    }
    case 'call':
      return lowerCall(node, context);
    case 'if':
      return {
        kind: 'branch',
        then: lowerBlock(node.thenBody, context),
        else: lowerBlock(node.elseBody, context)
      };
    case 'repeat': {
      const text = String(node.expr ?? '').trim();
      if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
        context.reasons.push(`line ${node.line ?? '?'}: repeat count must be a safe non-negative integer literal in the formal call core`);
        return { kind: 'skip' };
      }
      return { kind: 'repeat', count: Number(text), body: lowerBlock(node.body, context) };
    }
    case 'show':
      return { kind: 'skip' };
    case 'allow':
      return { kind: 'skip' };
    case 'return':
      context.reasons.push(`line ${node.line ?? '?'}: return is outside the beta.25 formal call core`);
      return { kind: 'skip' };
    case 'create':
    case 'createThing':
    case 'window':
    case 'event':
    case 'preview':
    case 'undo':
    case 'redo':
    case 'watch':
    case 'history':
    case 'why':
      context.reasons.push(`line ${node.line ?? '?'}: ${node.kind} is outside the beta.25 formal call core`);
      return { kind: 'skip' };
    default:
      context.reasons.push(`line ${node.line ?? '?'}: AST node '${node.kind}' is outside the beta.25 formal call core`);
      return { kind: 'skip' };
  }
}

function lowerCall(node, context) {
  const callee = context.recipes.get(node.name);
  if (!callee) {
    context.reasons.push(`line ${node.line ?? '?'}: unknown recipe '${node.name}'`);
    return { kind: 'call', name: node.name, args: [], calleeRank: null };
  }
  if ((callee.params ?? []).length !== (node.args ?? []).length) {
    context.reasons.push(`line ${node.line ?? '?'}: recipe '${node.name}' arity does not match its declaration`);
  }

  const args = [];
  (callee.params ?? []).forEach((param, index) => {
    const expected = callee.paramRanges?.[param];
    if (!isSafeIntegerRange(expected)) {
      context.reasons.push(`line ${node.line ?? '?'}: callee parameter '${node.name}.${param}' has no safe integer range`);
      return;
    }
    const formal = buildFormalRangeExpression(node.args?.[index] ?? '', context.callerBindings);
    if (!formal.supported) {
      context.reasons.push(`line ${node.line ?? '?'}: argument ${index + 1} for '${node.name}' is outside the formal integer range fragment: ${formal.reason}`);
      return;
    }
    const actual = formal.range;
    if (actual.min < expected.min || actual.max > expected.max) {
      context.reasons.push(`line ${node.line ?? '?'}: argument ${index + 1} range ${actual.min}..${actual.max} escapes '${node.name}.${param}' range ${expected.min}..${expected.max}`);
    }
    args.push({ parameter: param, range: { min: actual.min, max: actual.max }, expr: formal.expr });
  });

  const callerRank = context.ranks.get(context.caller);
  const calleeRank = context.ranks.get(node.name);
  if (callerRank === undefined || calleeRank === undefined || !(calleeRank < callerRank)) {
    context.reasons.push(`line ${node.line ?? '?'}: call '${context.caller}' -> '${node.name}' is not rank-decreasing`);
  }

  return { kind: 'call', name: node.name, args, calleeRank: calleeRank ?? null, line: node.line ?? null };
}

function normalizeEffect(effect, reasons, where) {
  if (effect.unproven) {
    reasons.push(`${where}: semantic effect is marked unproven`);
    return null;
  }
  if (!FORMAL_EFFECT_KINDS.has(effect.operation)) {
    reasons.push(`${where}: semantic operation '${effect.operation}' is outside the formal call effect vocabulary`);
    return null;
  }
  if (!effect.target || String(effect.target).startsWith('<')) {
    reasons.push(`${where}: semantic target '${effect.target}' is not a concrete formal target`);
    return null;
  }
  let amountRange = null;
  if (effect.operation === 'increase' || effect.operation === 'decrease') {
    if (!isSafeIntegerRange(effect.amountRange) || effect.amountRange.min < 0) {
      reasons.push(`${where}: quantitative effect lacks a non-negative safe-integer interval`);
      return null;
    }
    amountRange = { min: effect.amountRange.min, max: effect.amountRange.max };
  }
  return {
    target: effect.target,
    field: effect.field ?? null,
    operation: effect.operation,
    amountRange
  };
}

function sequence(statements) {
  if (!statements.length) return { kind: 'skip' };
  return statements.reduce((first, second) => ({ kind: 'seq', first, second }));
}

function isSafeIntegerRange(range) {
  return Boolean(
    range && Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) && range.min <= range.max
  );
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeStrings(items) { return [...new Set(items)]; }
