import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');

test('Pages defers automatic deployment while pinned runtime releases are still publishing', () => {
  assert.match(workflow, /if \[ "\$GITHUB_EVENT_NAME" = 'workflow_dispatch' \]; then/);
  assert.match(workflow, /Pinned runtime releases are still publishing\. Deferring Pages without reporting an expected failure/);
  assert.match(workflow, /echo 'ready=false' >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /if: steps\.native_runtime\.outputs\.ready == 'true'/);
});

test('manual Pages deployment remains fail-closed when a pinned runtime release is missing', () => {
  assert.match(workflow, /A manual Pages deployment requires every pinned runtime release to exist\. Refusing to deploy\./);
  assert.match(workflow, /exit 1/);
});

test('release-aware orchestration does not weaken asset digest verification', () => {
  assert.match(workflow, /release_digest\(\)/);
  assert.match(workflow, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(workflow, /runtime-integrity-manifest\.js/);
  assert.match(workflow, /add_verified_entry "\$WIN32_RUNTIME_TAG" "\$WIN_FILE"/);
  assert.match(workflow, /add_verified_entry "\$LINUX_NATIVE_RUNTIME_TAG" "\$LINUX_FILE"/);
  assert.match(workflow, /add_verified_entry "\$MACOS_NATIVE_RUNTIME_TAG" "\$MACOS_FILE"/);
});
