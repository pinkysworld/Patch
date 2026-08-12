import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');

test('release verifier script is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', 'scripts/verify-release.js'], { stdio: 'pipe' });
});

test('tagged release workflow publishes only from exact version tags', () => {
  assert.match(workflow, /push:\s*\n\s*tags:\s*\n\s*- 'v\*'/);
  assert.match(workflow, /EXPECTED_TAG="v\$\{VERSION\}"/);
  assert.match(workflow, /test "\$\{GITHUB_REF_TYPE\}" = "tag"/);
  assert.match(workflow, /test "\$\{GITHUB_REF_NAME\}" = "\$\{EXPECTED_TAG\}"/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$\{GITHUB_SHA\}"/);
  assert.match(workflow, /git tag --points-at "\$\{GITHUB_SHA\}"/);
});

test('tagged release workflow generates and verifies manifest and checksums before publishing', () => {
  const manifest = workflow.indexOf('Generate release manifest and checksums');
  const verify = workflow.indexOf('Verify release bytes source commit and version');
  const publish = workflow.indexOf('Publish GitHub Release');
  assert.ok(manifest > 0 && verify > manifest && publish > verify);
  assert.match(workflow, /scripts\/release-manifest\.js --out-dir release-meta release-dist/);
  assert.match(workflow, /scripts\/verify-release\.js --commit "\$GITHUB_SHA" --version "\$PATCH_VERSION"/);
  assert.match(workflow, /release-meta\/release-manifest\.json/);
  assert.match(workflow, /release-meta\/SHA256SUMS\.txt/);
});

test('release workflow uses GitHub-owned token and generated release notes', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: write/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /--verify-tag/);
  assert.match(workflow, /--generate-notes/);
  assert.match(workflow, /--prerelease/);
});

test('release bundle contains portable web wasm c99 and npm package artifacts', () => {
  for (const marker of [
    'release-dist/Score.patchapp',
    'release-dist/Score-bootstrap.wasm',
    'release-dist/DirectRecipes.wasm',
    'release-dist/DirectRecipes.c',
    'release-dist/DirectRecipes.html',
    'release-dist/CounterWindow.html',
    'npm pack --pack-destination release-dist'
  ]) assert.ok(workflow.includes(marker), marker);
});
