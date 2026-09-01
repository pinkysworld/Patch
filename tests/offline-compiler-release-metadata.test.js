import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/offline-compiler-release-metadata.yml', import.meta.url), 'utf8');

test('rolling Offline Compiler release notes follow successful main compiler publishes', () => {
  assert.match(workflow, /workflows: \['Patch Offline Compiler'\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /gh release edit "\$TAG"/);
  assert.match(workflow, /Native GUI IR 1\.9 \/ sealed payload v19 \/ runtime v1\.10/);
  assert.match(workflow, /--gui-payload-version 17/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});
