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

test('Pages retries and defers an automatic deployment when a release asset is temporarily unavailable', () => {
  assert.match(workflow, /id: runtime_assets/);
  assert.match(workflow, /download_verified_asset\(\)/);
  assert.match(workflow, /for attempt in 1 2 3 4 5; do/);
  assert.match(workflow, /gh release download "\$tag"/);
  assert.match(workflow, /Pinned runtime assets are still publishing\. Deferring Pages without reporting an expected failure/);
  assert.match(workflow, /if: steps\.runtime_assets\.outputs\.ready == 'true'/);
});

test('manual Pages deployment remains fail-closed for missing releases or assets', () => {
  assert.match(workflow, /A manual Pages deployment requires every pinned runtime release to exist\. Refusing to deploy\./);
  assert.match(workflow, /A manual Pages deployment requires every pinned runtime asset and SHA-256 digest to be available\. Refusing to deploy\./);
  assert.match(workflow, /exit 1/);
});

test('release-aware orchestration verifies downloaded bytes against the release digest before manifesting them', () => {
  assert.match(workflow, /\^sha256:\[0-9a-f\]\{64\}\$/);
  assert.match(workflow, /actual="sha256:\$\(sha256sum/);
  assert.match(workflow, /if \[ "\$actual" = "\$digest" \]; then/);
  assert.match(workflow, /manifest_args\+=\(--entry "\$file\|\$tag\|\$digest"\)/);
  assert.match(workflow, /runtime-integrity-manifest\.js/);
});

test('Pages deployment triggers include ScrollBox Standalone Web dependencies', () => {
  assert.match(workflow, /- src\/panel-scroll\.js/);
  assert.match(workflow, /- src\/window-web-accessibility\.js/);
});
