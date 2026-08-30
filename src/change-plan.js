import { clone, formatValue } from './change.js';

export const PATCH_CHANGE_PLAN_MODEL_VERSION = '0.1-research';

/**
 * Build a presentation-neutral model for Patch Studio's future Change Plan view.
 * The model is intentionally plain data so Web/Offline/native Studio surfaces can
 * render the same semantic plan without putting UI concerns into the language core.
 */
export function buildChangePlan(changeSetRecord) {
  if (!changeSetRecord || changeSetRecord.format !== 'patch-change-set') {
    throw new Error('Change Plan needs a Patch ChangeSet record.');
  }

  const rows = [];
  for (const member of changeSetRecord.members ?? []) {
    const operations = member.operations ?? [];
    if (!operations.length) {
      rows.push(baseRow(member, member.target, null, member.before, member.after));
      continue;
    }
    for (const operation of operations) {
      const path = operation.field ? `${member.target}.${operation.field}` : member.target;
      const before = operation.field ? ownField(member.before, operation.field) : member.before;
      const after = operation.field ? ownField(member.after, operation.field) : member.after;
      rows.push(baseRow(member, path, operation, before, after));
    }
  }

  const checks = (changeSetRecord.constraintResults ?? []).map(result => ({
    kind: result.kind,
    expression: result.expr,
    passed: Boolean(result.passed),
    before: result.kind === 'same' ? clone(result.before) : null,
    after: result.kind === 'same' ? clone(result.after) : null,
    value: result.kind === 'ensure' ? clone(result.value) : null,
    label: result.kind === 'same'
      ? `keep ${result.expr} the same`
      : `make sure ${result.expr}`
  }));

  return {
    format: 'patch-change-plan',
    version: PATCH_CHANGE_PLAN_MODEL_VERSION,
    id: changeSetRecord.id,
    name: changeSetRecord.name ?? null,
    atomic: true,
    rows,
    checks,
    beforeState: clone(changeSetRecord.beforeState),
    afterState: clone(changeSetRecord.afterState),
    summary: `${rows.length} planned operation${rows.length === 1 ? '' : 's'} in one atomic ChangeSet; ${checks.filter(check => check.passed).length}/${checks.length} condition${checks.length === 1 ? '' : 's'} satisfied.`
  };
}

function baseRow(member, path, operation, before, after) {
  return {
    changeId: member.id,
    path,
    operation: describeOperation(operation),
    before: clone(before),
    after: clone(after),
    beforeText: formatValue(before),
    afterText: formatValue(after),
    delta: typeof before === 'number' && typeof after === 'number' ? after - before : null
  };
}

function describeOperation(operation) {
  if (!operation) return 'change';
  if (operation.op === 'addNumber') {
    const amount = Number(operation.value);
    return amount >= 0 ? `increase ${amount}` : `decrease ${Math.abs(amount)}`;
  }
  if (operation.op === 'removeNumber') return `decrease ${Number(operation.value)}`;
  if (operation.op === 'set') return 'set';
  if (operation.op === 'append') return 'add item';
  if (operation.op === 'appendText') return 'add text';
  if (operation.op === 'removeAt') return 'remove item';
  if (operation.op === 'insertAt') return 'insert item';
  if (operation.op === 'clear') return 'clear';
  if (operation.op === 'restore') return 'restore';
  return operation.op;
}

function ownField(value, field) {
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, field)) {
    return value[field];
  }
  return undefined;
}
