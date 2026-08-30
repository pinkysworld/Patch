import { parse } from './parser.js';
import { PatchInterpreter } from './interpreter.js';

export const PATCH_STUDIO_DESIGN_MODEL_VERSION = '0.2';
export const PATCH_STUDIO_DESIGN_EVALUATION_POLICY_VERSION = '0.1';
export const PATCH_STUDIO_DESIGN_MAX_TOP_LEVEL_NODES = 20000;
export const PATCH_STUDIO_DESIGN_MAX_EXPRESSION_CHARS = 8192;
export const PATCH_STUDIO_DESIGN_MAX_TOTAL_EXPRESSION_CHARS = 262144;

const DECLARATIVE_KINDS = new Set(['create', 'createThing', 'window', 'event', 'function', 'allow']);
const DESIGN_EXPRESSION_KEYS = new Set([
  'expr', 'textExpr', 'titleExpr', 'messageExpr', 'sourceExpr', 'shortcutExpr', 'labelExpr'
]);
const DESIGN_EXPRESSION_ARRAY_KEYS = new Set(['options', 'rows']);

export class PatchStudioDesignModelError extends Error {
  constructor(message, code = 'STUDIO_DESIGN_MODEL') {
    super(message);
    this.name = 'PatchStudioDesignModelError';
    this.code = code;
  }
}

/**
 * Build the source-backed UI model used by design-time tooling without executing
 * application behavior. Only declarations needed to establish initial state,
 * Forms and event/function metadata are processed. Calls, changes, loops,
 * conditionals, preview blocks, output and Form open/close actions are skipped.
 *
 * This is deliberately narrower than PatchInterpreter.run(): a Designer refresh
 * must not execute arbitrary application work just because source text changed.
 * Expressions that are still required to materialize initial state/UI are also
 * constrained by the versioned design-time evaluation policy below.
 */
export function buildStudioDesignModel(source, options = {}) {
  const maxTopLevelNodes = normalizeBudget(options.maxTopLevelNodes);
  const evaluationPolicy = normalizeEvaluationPolicy(options);
  const ast = parse(String(source ?? ''));
  if (ast.length > maxTopLevelNodes) {
    throw new PatchStudioDesignModelError(
      `Studio design model contains ${ast.length} top-level instructions; the design-time limit is ${maxTopLevelNodes}.`,
      'STUDIO_DESIGN_MODEL_BUDGET'
    );
  }

  const evaluation = enforceDesignEvaluationPolicy(ast, evaluationPolicy);
  const runtime = new PatchInterpreter();
  const skipped = [];
  let declarationCount = 0;

  for (const node of ast) {
    if (!DECLARATIVE_KINDS.has(node.kind)) {
      skipped.push(Object.freeze({ kind: node.kind, line: node.line ?? null }));
      continue;
    }
    declarationCount += 1;
    applyDeclaration(runtime, node);
  }

  const state = Object.freeze(Object.fromEntries(runtime.state));
  const ui = deepFreezeJson(runtime.buildUIModel());
  return Object.freeze({
    version: PATCH_STUDIO_DESIGN_MODEL_VERSION,
    ast,
    ui,
    state,
    declarationCount,
    skipped: Object.freeze(skipped),
    skippedCount: skipped.length,
    evaluationPolicy: Object.freeze({ ...evaluationPolicy }),
    evaluatedExpressionCount: evaluation.count,
    evaluatedExpressionChars: evaluation.totalChars
  });
}

function applyDeclaration(runtime, node) {
  switch (node.kind) {
    case 'create':
      runtime.create(node, {});
      return;
    case 'createThing':
      runtime.createThing(node, {});
      return;
    case 'window':
      runtime.registerWindow(node);
      return;
    case 'event':
      runtime.events.push(node);
      return;
    case 'function':
      runtime.functions.set(node.name, node);
      return;
    case 'allow':
      return;
    default:
      throw new PatchStudioDesignModelError(
        `Unsupported design declaration '${node.kind}'.`,
        'STUDIO_DESIGN_MODEL_DECLARATION'
      );
  }
}

function normalizeBudget(value) {
  if (value === undefined || value === null) return PATCH_STUDIO_DESIGN_MAX_TOP_LEVEL_NODES;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > PATCH_STUDIO_DESIGN_MAX_TOP_LEVEL_NODES) {
    throw new PatchStudioDesignModelError(
      `Design-time node budget must be a whole number from 1 to ${PATCH_STUDIO_DESIGN_MAX_TOP_LEVEL_NODES}.`,
      'STUDIO_DESIGN_MODEL_BUDGET_VALUE'
    );
  }
  return number;
}

function normalizeEvaluationPolicy(options) {
  return {
    version: PATCH_STUDIO_DESIGN_EVALUATION_POLICY_VERSION,
    maxExpressionChars: normalizeEvaluationBudget(
      options.maxExpressionChars,
      PATCH_STUDIO_DESIGN_MAX_EXPRESSION_CHARS,
      PATCH_STUDIO_DESIGN_MAX_EXPRESSION_CHARS,
      'maxExpressionChars'
    ),
    maxTotalExpressionChars: normalizeEvaluationBudget(
      options.maxTotalExpressionChars,
      PATCH_STUDIO_DESIGN_MAX_TOTAL_EXPRESSION_CHARS,
      PATCH_STUDIO_DESIGN_MAX_TOTAL_EXPRESSION_CHARS,
      'maxTotalExpressionChars'
    )
  };
}

function normalizeEvaluationBudget(value, fallback, maximum, name) {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new PatchStudioDesignModelError(
      `${name} must be a whole number from 1 to ${maximum}.`,
      'STUDIO_DESIGN_EVALUATION_POLICY_VALUE'
    );
  }
  return number;
}

function enforceDesignEvaluationPolicy(ast, policy) {
  let count = 0;
  let totalChars = 0;

  const accept = (source, line = null) => {
    if (typeof source !== 'string') return;
    const chars = source.length;
    count += 1;
    totalChars += chars;
    if (chars > policy.maxExpressionChars) {
      throw new PatchStudioDesignModelError(
        `A design-time expression${line ? ` at line ${line}` : ''} is ${chars} characters; the per-expression limit is ${policy.maxExpressionChars}.`,
        'STUDIO_DESIGN_EVALUATION_BUDGET'
      );
    }
    if (totalChars > policy.maxTotalExpressionChars) {
      throw new PatchStudioDesignModelError(
        `Design-time expressions total ${totalChars} characters; the design-time total limit is ${policy.maxTotalExpressionChars}.`,
        'STUDIO_DESIGN_EVALUATION_BUDGET'
      );
    }
  };

  for (const node of ast) {
    if (node.kind === 'create') {
      accept(node.expr, node.line);
      continue;
    }
    if (node.kind === 'createThing') {
      for (const field of node.fields ?? []) accept(field.expr, field.line ?? node.line);
      continue;
    }
    // Event/recipe bodies are retained only as metadata and never evaluated by
    // the declaration-only Designer. Do not charge skipped application behavior
    // against the design-time evaluation budget.
    if (node.kind === 'window') scanRenderableExpressions(node, accept, node.line);
  }

  return Object.freeze({ count, totalChars });
}

function scanRenderableExpressions(value, accept, fallbackLine = null, key = null) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (DESIGN_EXPRESSION_KEYS.has(key)) accept(value, fallbackLine);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && DESIGN_EXPRESSION_ARRAY_KEYS.has(key)) accept(item, fallbackLine);
      else scanRenderableExpressions(item, accept, fallbackLine, key);
    }
    return;
  }
  if (typeof value !== 'object') return;

  const line = Number.isInteger(value.line) ? value.line : fallbackLine;
  for (const [childKey, child] of Object.entries(value)) {
    if (typeof child === 'string' && DESIGN_EXPRESSION_KEYS.has(childKey)) {
      accept(child, line);
      continue;
    }
    if (Array.isArray(child) && DESIGN_EXPRESSION_ARRAY_KEYS.has(childKey)) {
      scanExpressionArray(child, accept, line);
      continue;
    }
    scanRenderableExpressions(child, accept, line, childKey);
  }
}

function scanExpressionArray(value, accept, line) {
  for (const item of value) {
    if (typeof item === 'string') accept(item, line);
    else if (Array.isArray(item)) scanExpressionArray(item, accept, line);
    else scanRenderableExpressions(item, accept, line, null);
  }
}

function deepFreezeJson(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreezeJson);
    return Object.freeze(value);
  }
  for (const child of Object.values(value)) deepFreezeJson(child);
  return Object.freeze(value);
}
