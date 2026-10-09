import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WORKFLOW_DIRECTORY = '.github/workflows';

// Parse the top-level event mapping, not event-name strings in comments,
// shell scripts or conditional expressions elsewhere in the YAML.
function workflowEvents(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const onIndex = lines.findIndex(line => line === 'on:');
  if (onIndex < 0) return null;
  const events = [];
  for (const line of lines.slice(onIndex + 1)) {
    if (line && !/^\s/.test(line) && !/^#/.test(line)) break;
    const event = /^  ([a-z_][\w-]*):(?:\s|$)/.exec(line);
    if (event) events.push(event[1]);
  }
  return events;
}

test('every GitHub Actions workflow runs exclusively via manual dispatch', () => {
  const paths = fs.readdirSync(WORKFLOW_DIRECTORY)
    .filter(name => /\.ya?ml$/.test(name))
    .sort();
  assert.ok(paths.length >= 1, 'expected at least one workflow to protect');
  for (const name of paths) {
    const source = fs.readFileSync(path.join(WORKFLOW_DIRECTORY, name), 'utf8');
    assert.deepEqual(workflowEvents(source), ['workflow_dispatch'],
      `${name} must have only top-level workflow_dispatch; no push, PR, cron or workflow_run triggers`);
  }
});

test('the manual-only guard rejects automatic event keys and missing on mappings', () => {
  assert.deepEqual(workflowEvents('name: Test\non:\n  workflow_dispatch:\n  push:\njobs:\n'), ['workflow_dispatch', 'push']);
  assert.deepEqual(workflowEvents('on: [push]\njobs:\n'), null);
  assert.deepEqual(workflowEvents('name: Test\njobs:\n  test:\n'), null);
  assert.deepEqual(workflowEvents('on:\n  workflow_dispatch:\n    inputs:\n      mode:\n        description: push\npermissions:\n'), ['workflow_dispatch']);
});
