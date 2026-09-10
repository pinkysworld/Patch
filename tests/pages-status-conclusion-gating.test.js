import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/pages-status.yml', 'utf8');

test('public-site status ignores skipped and cancelled Pages runs', () => {
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /cancelled\|skipped\|neutral\|stale\)/);
  assert.match(workflow, /Ignoring non-authoritative Pages conclusion/);
  assert.match(workflow, /exit 0/);
});

test('public-site status maps only authoritative deployment conclusions', () => {
  assert.match(workflow, /success\)/);
  assert.match(workflow, /state=success/);
  assert.match(workflow, /failure\|timed_out\|startup_failure\|action_required\)/);
  assert.match(workflow, /state=failure/);
  assert.match(workflow, /Ignoring unknown Pages conclusion/);
  assert.match(workflow, /context='patch-studio\/public-site'/);
});
