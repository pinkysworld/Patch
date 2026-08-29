import { parse } from './parser.js?v=9ad29318e93c7c71';
import { PatchInterpreter } from './interpreter.js?v=9ad29318e93c7c71';

export const PATCH_STUDIO_DESIGN_MODEL_VERSION = '0.1';
export const PATCH_STUDIO_DESIGN_MAX_TOP_LEVEL_NODES = 20000;

const DECLARATIVE_KINDS = new Set(['create', 'createThing', 'window', 'event', 'function', 'allow']);

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
 */
export function buildStudioDesignModel(source, options = {}) {
  const maxTopLevelNodes = normalizeBudget(options.maxTopLevelNodes);
  const ast = parse(String(source ?? ''));
  if (ast.length > maxTopLevelNodes) {
    throw new PatchStudioDesignModelError(
      `Studio design model contains ${ast.length} top-level instructions; the design-time limit is ${maxTopLevelNodes}.`,
      'STUDIO_DESIGN_MODEL_BUDGET'
    );
  }

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
    skippedCount: skipped.length
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

function deepFreezeJson(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreezeJson);
    return Object.freeze(value);
  }
  for (const child of Object.values(value)) deepFreezeJson(child);
  return Object.freeze(value);
}
