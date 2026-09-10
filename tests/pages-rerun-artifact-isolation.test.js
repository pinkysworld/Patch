import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');

test('Pages uploads and deploys an artifact scoped to the workflow run attempt', () => {
  assert.match(
    pages,
    /actions\/upload-pages-artifact@v5[\s\S]*?name:\s*github-pages-\$\{\{ github\.run_attempt \}\}[\s\S]*?path:\s*_site/
  );
  assert.match(
    pages,
    /actions\/deploy-pages@v5[\s\S]*?artifact_name:\s*github-pages-\$\{\{ github\.run_attempt \}\}/
  );
});

test('Pages no longer relies on the duplicate-prone default artifact name', () => {
  const uploadBlock = pages.match(/- uses: actions\/upload-pages-artifact@v5[\s\S]*?(?=\n\s*- name: Deploy)/)?.[0] ?? '';
  const deployBlock = pages.match(/- name: Deploy[\s\S]*?(?=\n\s*- name: Verify deployed Patch Studio critical assets)/)?.[0] ?? '';
  assert.match(uploadBlock, /name:\s*github-pages-\$\{\{ github\.run_attempt \}\}/);
  assert.match(deployBlock, /artifact_name:\s*github-pages-\$\{\{ github\.run_attempt \}\}/);
});
