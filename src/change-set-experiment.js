import { applySemanticOperations, clone } from './change.js';
import { evaluateLoose } from './expression.js';
import { buildChangePlan } from './change-plan.js';
import { AtomicChangeSetError, stageAtomicChangeSet } from './change-set.js';
import { parseExperimentalChangeSet } from './change-set-source.js';

export const PATCH_CHANGE_SET_EXPERIMENT_VERSION = '0.1-research';

/**
 * Research-only end-to-end path for candidate child-friendly ChangeSet syntax.
 *
 * This deliberately remains separate from the production parser/interpreter. It
 * lets us test surface readability and atomic semantics without changing ordinary
 * Patch programs. The first executable fragment supports the same primitive
 * set/add/remove/clear behavior used by the current interpreter for numbers,
 * lists, text and booleans/objects where clear/set apply.
 */
export function runExperimentalChangeSet(source, state, options = {}) {
  if (!(state instanceof Map)) throw new AtomicChangeSetError('Experimental ChangeSet state must be a Map.');
  const ast = parseExperimentalChangeSet(source);
  const versions = options.versions instanceof Map ? options.versions : new Map();
  const locals = options.locals ?? {};
  const semantic = lowerExperimentalChangeSet(ast, state, locals);
  const staged = stageAtomicChangeSet(semantic, state, versions);
  return {
    format: 'patch-change-set-experiment',
    version: PATCH_CHANGE_SET_EXPERIMENT_VERSION,
    ast,
    semantic,
    ...staged,
    plan: buildChangePlan(staged.record)
  };
}

export function lowerExperimentalChangeSet(ast, state, locals = {}) {
  if (!ast || ast.kind !== 'changeSet') throw new AtomicChangeSetError('Expected an experimental ChangeSet AST.');
  const working = cloneStateMap(state);
  const changes = [];

  for (const member of ast.changes) {
    if (!working.has(member.target)) {
      throw new AtomicChangeSetError(`I cannot change '${member.target}' because it does not exist.`);
    }
    let current = clone(working.get(member.target));
    const operations = [];

    for (const sourceOperation of member.ops) {
      const semantic = lowerOperation(sourceOperation, member.target, current, working, locals);
      current = applySemanticOperations(current, [semantic]);
      operations.push(semantic);
    }

    working.set(member.target, clone(current));
    changes.push({ target: member.target, name: member.name ?? null, operations });
  }

  return {
    id: ast.name ? `experimental:${ast.name}` : 'experimental:changeset',
    name: ast.name ?? null,
    changes,
    constraints: ast.constraints.map(constraint => ({ kind: constraint.kind, expr: constraint.expr }))
  };
}

function lowerOperation(sourceOperation, target, current, state, locals) {
  const field = sourceOperation.field ?? null;
  const old = valueAt(current, field, target);
  const envState = cloneStateMap(state);
  envState.set(target, clone(current));
  const env = { state: envState, locals };

  if (sourceOperation.op === 'set') {
    return { op: 'set', field, value: clone(evaluateLoose(sourceOperation.expr, env)), sourceLine: sourceOperation.line };
  }

  if (sourceOperation.op === 'clear') {
    return { op: 'clear', field, sourceLine: sourceOperation.line };
  }

  const value = evaluateLoose(sourceOperation.expr, env);
  if (sourceOperation.op === 'add') {
    if (typeof old === 'number' && typeof value === 'number') {
      return { op: 'addNumber', field, value, sourceLine: sourceOperation.line };
    }
    if (Array.isArray(old)) {
      return { op: 'append', field, value: clone(value), sourceLine: sourceOperation.line };
    }
    if (typeof old === 'string') {
      return { op: 'appendText', field, value: String(value), sourceLine: sourceOperation.line };
    }
    throw new AtomicChangeSetError('add works with numbers, lists, or text.');
  }

  if (sourceOperation.op === 'remove') {
    if (typeof old === 'number' && typeof value === 'number') {
      return { op: 'removeNumber', field, value, sourceLine: sourceOperation.line };
    }
    if (Array.isArray(old)) {
      const index = old.findIndex(item => structuralEqual(item, value));
      if (index < 0) throw new AtomicChangeSetError(`Cannot remove the requested value because it is not in '${target}'.`);
      return { op: 'removeAt', field, index, sourceLine: sourceOperation.line };
    }
    throw new AtomicChangeSetError('remove works with numbers or lists.');
  }

  throw new AtomicChangeSetError(`Unknown experimental change operation '${sourceOperation.op}'.`);
}

function valueAt(current, field, target) {
  if (!field) return clone(current);
  if (current === null || typeof current !== 'object' || Array.isArray(current)) {
    throw new AtomicChangeSetError(`'${target}' has no fields.`);
  }
  if (!Object.prototype.hasOwnProperty.call(current, field)) {
    throw new AtomicChangeSetError(`'${target}' has no field called '${field}'.`);
  }
  return clone(current[field]);
}

function cloneStateMap(state) {
  return new Map([...state].map(([key, value]) => [key, clone(value)]));
}

function structuralEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => structuralEqual(value, b[index]));
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  return aKeys.length === bKeys.length && aKeys.every((key, index) => key === bKeys[index] && structuralEqual(a[key], b[key]));
}
