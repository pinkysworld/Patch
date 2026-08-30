import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import {
  AtomicChangeSetError,
  invertAtomicChangeSet,
  stageAtomicChangeSet
} from '../src/change-set.js';
import { buildChangePlan } from '../src/change-plan.js';
import {
  ExperimentalChangeSetSyntaxError,
  parseExperimentalChangeSet
} from '../src/change-set-source.js';

function transferSpec(amount, credited = amount) {
  return {
    id: 'set:transfer',
    name: 'transfer',
    changes: [
      { target: 'alice', operations: [{ op: 'removeNumber', value: amount }] },
      { target: 'bob', operations: [{ op: 'addNumber', value: credited }] }
    ],
    constraints: [
      { kind: 'same', expr: 'alice + bob' },
      { kind: 'ensure', expr: 'alice >= 0' }
    ]
  };
}

test('the beginner change syntax remains unchanged', () => {
  const ast = parse(`create number score = 0\nchange score:\n  add 1\nshow score`);
  assert.equal(ast[1].kind, 'change');
  assert.equal(ast[1].target, 'score');
  assert.equal(ast[1].ops[0].op, 'add');
});

test('experimental source keeps atomic and relational ideas in plain language', () => {
  const ast = parseExperimentalChangeSet(`change together called transfer:\n  change alice:\n    remove 20\n  change bob:\n    add 20\n  keep alice + bob the same\n  make sure alice >= 0`);

  assert.equal(ast.kind, 'changeSet');
  assert.equal(ast.name, 'transfer');
  assert.equal(ast.changes.length, 2);
  assert.equal(ast.changes[0].target, 'alice');
  assert.equal(ast.changes[0].ops[0].op, 'remove');
  assert.deepEqual(ast.constraints.map(item => [item.kind, item.expr]), [
    ['same', 'alice + bob'],
    ['ensure', 'alice >= 0']
  ]);
});

test('experimental source directs one-target programs back to ordinary change', () => {
  assert.throws(
    () => parseExperimentalChangeSet(`change together:\n  change score:\n    add 1`),
    error => error instanceof ExperimentalChangeSetSyntaxError && /Use ordinary change for one target/.test(error.message)
  );
});

test('atomic ChangeSet stages a balanced transfer without mutating input state', () => {
  const state = new Map([['alice', 100], ['bob', 50]]);
  const versions = new Map([['alice', 0], ['bob', 0]]);
  const result = stageAtomicChangeSet(transferSpec(20), state, versions);

  assert.equal(state.get('alice'), 100);
  assert.equal(state.get('bob'), 50);
  assert.equal(versions.get('alice'), 0);
  assert.equal(result.state.get('alice'), 80);
  assert.equal(result.state.get('bob'), 70);
  assert.equal(result.versions.get('alice'), 1);
  assert.equal(result.versions.get('bob'), 1);
  assert.equal(result.record.members.length, 2);
  assert.deepEqual(result.record.constraintResults.map(check => check.passed), [true, true]);
});

test('a relational failure rejects the complete ChangeSet', () => {
  const state = new Map([['alice', 100], ['bob', 50]]);
  assert.throws(
    () => stageAtomicChangeSet(transferSpec(20, 10), state),
    error => error instanceof AtomicChangeSetError && /would not stay the same/.test(error.message)
  );
  assert.equal(state.get('alice'), 100);
  assert.equal(state.get('bob'), 50);
});

test('a postcondition failure rejects the complete ChangeSet', () => {
  const state = new Map([['alice', 10], ['bob', 50]]);
  assert.throws(
    () => stageAtomicChangeSet(transferSpec(20), state),
    error => error instanceof AtomicChangeSetError && /would not be true afterwards/.test(error.message)
  );
  assert.equal(state.get('alice'), 10);
  assert.equal(state.get('bob'), 50);
});

test('multiple members on one target observe staged state and advance versions in order', () => {
  const state = new Map([['score', 10]]);
  const result = stageAtomicChangeSet({
    id: 'set:score',
    changes: [
      { target: 'score', operations: [{ op: 'addNumber', value: 5 }] },
      { target: 'score', operations: [{ op: 'removeNumber', value: 2 }] }
    ]
  }, state, new Map([['score', 7]]));

  assert.equal(result.record.members[0].before, 10);
  assert.equal(result.record.members[0].after, 15);
  assert.equal(result.record.members[0].baseVersion, 7);
  assert.equal(result.record.members[1].before, 15);
  assert.equal(result.record.members[1].after, 13);
  assert.equal(result.record.members[1].baseVersion, 8);
  assert.equal(result.versions.get('score'), 9);
});

test('inverse ChangeSet restores the complete pre-state', () => {
  const state = new Map([['alice', 100], ['bob', 50]]);
  const forward = stageAtomicChangeSet(transferSpec(20), state);
  const inverse = invertAtomicChangeSet(forward.record);
  const restored = stageAtomicChangeSet(inverse, forward.state, forward.versions);

  assert.equal(restored.state.get('alice'), 100);
  assert.equal(restored.state.get('bob'), 50);
});

test('Change Plan exposes before/after deltas and friendly relational checks', () => {
  const result = stageAtomicChangeSet(transferSpec(20), new Map([['alice', 100], ['bob', 50]]));
  const plan = buildChangePlan(result.record);

  assert.equal(plan.atomic, true);
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.rows[0].path, 'alice');
  assert.equal(plan.rows[0].before, 100);
  assert.equal(plan.rows[0].after, 80);
  assert.equal(plan.rows[0].delta, -20);
  assert.equal(plan.rows[1].delta, 20);
  assert.equal(plan.checks[0].label, 'keep alice + bob the same');
  assert.equal(plan.checks[1].label, 'make sure alice >= 0');
  assert.match(plan.summary, /2 planned operations/);
});

test('Change Plan shows intermediate state for multiple operations in one member', () => {
  const staged = stageAtomicChangeSet({
    id: 'set:multi-op',
    changes: [
      { target: 'score', operations: [{ op: 'addNumber', value: 5 }, { op: 'removeNumber', value: 2 }] },
      { target: 'other', operations: [{ op: 'addNumber', value: 1 }] }
    ]
  }, new Map([['score', 10], ['other', 0]]));
  const plan = buildChangePlan(staged.record);

  assert.deepEqual(plan.rows.slice(0, 2).map(row => [row.before, row.after, row.delta]), [
    [10, 15, 5],
    [15, 13, -2]
  ]);
});
