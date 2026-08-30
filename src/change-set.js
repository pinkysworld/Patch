import { clone, applySemanticOperations } from './change.js';
import { deepEqual, evaluateExpression } from './expression.js';

export const PATCH_CHANGE_SET_MODEL_VERSION = '0.1-research';

export class AtomicChangeSetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AtomicChangeSetError';
  }
}

/**
 * Pure Stage-0 research model for atomic multi-target mutation.
 *
 * It deliberately does not add Patch source syntax yet. A caller supplies semantic
 * operations already used by the runtime (`addNumber`, `removeNumber`, `set`, ...).
 * The function stages every member against cloned state, checks relational
 * constraints, and returns new state/version maps only if the complete set is valid.
 */
export function stageAtomicChangeSet(spec, state, versions = new Map()) {
  validateInputs(spec, state, versions);

  const id = spec.id ?? 'changeset:preview';
  const beforeMap = cloneStateMap(state);
  const stagedState = cloneStateMap(state);
  const stagedVersions = new Map(versions);
  const members = [];

  for (let index = 0; index < spec.changes.length; index += 1) {
    const requested = spec.changes[index];
    const target = requested?.target;
    if (!target || typeof target !== 'string') {
      throw new AtomicChangeSetError(`Change ${index + 1} needs a target.`);
    }
    if (!stagedState.has(target)) {
      throw new AtomicChangeSetError(`I cannot change '${target}' because it does not exist.`);
    }

    const operations = clone(requested.operations ?? []);
    if (!operations.length) {
      throw new AtomicChangeSetError(`Change ${index + 1} for '${target}' has no operations.`);
    }

    const before = clone(stagedState.get(target));
    const { after, inverseOperations } = applyWithInverse(before, operations, target);
    const baseVersion = stagedVersions.get(target) ?? 0;
    const member = {
      id: `${id}:c${index + 1}`,
      changeSetId: id,
      changeSetName: spec.name ?? null,
      name: requested.name ?? null,
      target,
      baseVersion,
      newVersion: baseVersion + 1,
      operations,
      inverseOperations,
      before,
      after: clone(after)
    };

    members.push(member);
    stagedState.set(target, clone(after));
    stagedVersions.set(target, baseVersion + 1);
  }

  const constraintResults = evaluateConstraints(spec.constraints ?? [], beforeMap, stagedState);
  const record = {
    format: 'patch-change-set',
    version: PATCH_CHANGE_SET_MODEL_VERSION,
    id,
    name: spec.name ?? null,
    atomic: true,
    members,
    constraints: clone(spec.constraints ?? []),
    constraintResults,
    beforeState: stateToObject(beforeMap),
    afterState: stateToObject(stagedState)
  };

  return { record, state: stagedState, versions: stagedVersions };
}

/** Alias used by research callers that want commit-like naming while retaining pure semantics. */
export function commitAtomicChangeSet(spec, state, versions = new Map()) {
  return stageAtomicChangeSet(spec, state, versions);
}

/**
 * Produce a ChangeSet spec that restores the exact member states in reverse order.
 * Relational checks are intentionally omitted: the inverse returns to the already
 * observed pre-state rather than re-authorizing a new forward operation.
 */
export function invertAtomicChangeSet(record) {
  if (!record || record.format !== 'patch-change-set' || !Array.isArray(record.members)) {
    throw new AtomicChangeSetError('I cannot undo this because it is not a Patch ChangeSet record.');
  }
  return {
    id: `${record.id}:inverse`,
    name: record.name ? `undo_${record.name}` : null,
    changes: [...record.members].reverse().map(member => ({
      target: member.target,
      operations: clone(member.inverseOperations)
    })),
    constraints: []
  };
}

export function evaluateChangeSetConstraints(constraints, beforeState, afterState) {
  return evaluateConstraints(constraints, beforeState, afterState);
}

function validateInputs(spec, state, versions) {
  if (!(state instanceof Map)) throw new AtomicChangeSetError('ChangeSet state must be a Map.');
  if (!(versions instanceof Map)) throw new AtomicChangeSetError('ChangeSet versions must be a Map.');
  if (!spec || !Array.isArray(spec.changes) || spec.changes.length < 2) {
    throw new AtomicChangeSetError('A ChangeSet needs at least two changes. Use ordinary change for one target.');
  }
  if (spec.constraints !== undefined && !Array.isArray(spec.constraints)) {
    throw new AtomicChangeSetError('ChangeSet constraints must be a list.');
  }
}

function evaluateConstraints(constraints, beforeState, afterState) {
  const results = [];
  for (const constraint of constraints) {
    const kind = constraint?.kind;
    const expr = String(constraint?.expr ?? '').trim();
    if (!expr) throw new AtomicChangeSetError('A ChangeSet condition needs an expression.');

    if (kind === 'same') {
      const before = evaluateFriendly(expr, beforeState);
      const after = evaluateFriendly(expr, afterState);
      const passed = deepEqual(before, after);
      results.push({ kind, expr, passed, before: clone(before), after: clone(after) });
      if (!passed) {
        throw new AtomicChangeSetError(`The changes cannot happen together because '${expr}' would not stay the same.`);
      }
      continue;
    }

    if (kind === 'ensure') {
      const value = evaluateFriendly(expr, afterState);
      const passed = Boolean(value);
      results.push({ kind, expr, passed, value: clone(value) });
      if (!passed) {
        throw new AtomicChangeSetError(`The changes cannot happen together because '${expr}' would not be true afterwards.`);
      }
      continue;
    }

    throw new AtomicChangeSetError(`Unknown ChangeSet condition '${kind}'.`);
  }
  return results;
}

function evaluateFriendly(expr, state) {
  try {
    return evaluateExpression(expr, { state, locals: {} });
  } catch (error) {
    throw new AtomicChangeSetError(`I cannot check '${expr}': ${error?.message ?? String(error)}`);
  }
}

function applyWithInverse(before, operations, target) {
  let current = clone(before);
  const inverseOperations = [];

  for (const operation of operations) {
    const op = clone(operation);
    const old = valueAtOperationTarget(current, op, target);
    const inverse = inverseFor(op, old);
    try {
      current = applySemanticOperations(current, [op]);
    } catch (error) {
      throw new AtomicChangeSetError(`I cannot apply a change to '${target}': ${error?.message ?? String(error)}`);
    }
    inverseOperations.unshift(inverse);
  }

  return { after: current, inverseOperations };
}

function valueAtOperationTarget(current, operation, target) {
  if (!operation.field) return clone(current);
  if (current === null || typeof current !== 'object' || Array.isArray(current)) {
    throw new AtomicChangeSetError(`'${target}' has no fields.`);
  }
  if (!Object.prototype.hasOwnProperty.call(current, operation.field)) {
    throw new AtomicChangeSetError(`'${target}' has no field called '${operation.field}'.`);
  }
  return clone(current[operation.field]);
}

function inverseFor(operation, old) {
  const field = operation.field ?? null;
  if (operation.op === 'set') return { op: 'set', field, value: clone(old) };
  if (operation.op === 'addNumber') return { op: 'addNumber', field, value: -Number(operation.value) };
  if (operation.op === 'removeNumber') return { op: 'addNumber', field, value: Number(operation.value) };
  if (operation.op === 'append') {
    if (!Array.isArray(old)) throw new AtomicChangeSetError('append can only be inverted for a list.');
    return { op: 'removeAt', field, index: old.length };
  }
  if (operation.op === 'appendText') return { op: 'set', field, value: clone(old) };
  if (operation.op === 'removeAt') {
    if (!Array.isArray(old) || operation.index < 0 || operation.index >= old.length) {
      throw new AtomicChangeSetError('removeAt cannot be inverted because the list index is outside the current value.');
    }
    return { op: 'insertAt', field, index: operation.index, value: clone(old[operation.index]) };
  }
  if (operation.op === 'insertAt') return { op: 'removeAt', field, index: operation.index };
  if (operation.op === 'clear' || operation.op === 'restore') return { op: 'set', field, value: clone(old) };
  throw new AtomicChangeSetError(`ChangeSet inverse does not know semantic operation '${operation.op}'.`);
}

function cloneStateMap(state) {
  return new Map([...state].map(([key, value]) => [key, clone(value)]));
}

function stateToObject(state) {
  return Object.fromEntries([...state].map(([key, value]) => [key, clone(value)]));
}
