import test from 'node:test';
import assert from 'node:assert/strict';
import { AtomicChangeSetError } from '../src/change-set.js';
import { runExperimentalChangeSet } from '../src/change-set-experiment.js';

const transferSource = `change together called transfer:
  change alice:
    remove amount
  change bob:
    add amount
  keep alice + bob the same
  make sure alice >= 0`;

test('child-friendly source runs end to end without mutating the caller state', () => {
  const state = new Map([['alice', 100], ['bob', 50]]);
  const result = runExperimentalChangeSet(transferSource, state, { locals: { amount: 20 } });

  assert.equal(state.get('alice'), 100);
  assert.equal(state.get('bob'), 50);
  assert.equal(result.state.get('alice'), 80);
  assert.equal(result.state.get('bob'), 70);
  assert.equal(result.record.atomic, true);
  assert.equal(result.plan.rows[0].operation, 'decrease 20');
  assert.equal(result.plan.rows[1].operation, 'increase 20');
  assert.deepEqual(result.plan.checks.map(check => check.passed), [true, true]);
});

test('plain-language invariant failure keeps the complete input state unchanged', () => {
  const state = new Map([['alice', 100], ['bob', 50]]);
  const source = `change together called broken_transfer:
  change alice:
    remove 20
  change bob:
    add 10
  keep alice + bob the same`;

  assert.throws(
    () => runExperimentalChangeSet(source, state),
    error => error instanceof AtomicChangeSetError && /would not stay the same/.test(error.message)
  );
  assert.deepEqual(Object.fromEntries(state), { alice: 100, bob: 50 });
});

test('plain-language postcondition prevents overdraw', () => {
  const state = new Map([['alice', 10], ['bob', 50]]);

  assert.throws(
    () => runExperimentalChangeSet(transferSource, state, { locals: { amount: 20 } }),
    error => error instanceof AtomicChangeSetError && /would not be true afterwards/.test(error.message)
  );
  assert.deepEqual(Object.fromEntries(state), { alice: 10, bob: 50 });
});

test('later members can read state staged by earlier members', () => {
  const source = `change together:
  change first:
    add 5
  change second:
    set = first
  make sure second == 15`;
  const state = new Map([['first', 10], ['second', 0]]);
  const result = runExperimentalChangeSet(source, state);

  assert.equal(result.state.get('first'), 15);
  assert.equal(result.state.get('second'), 15);
});
