import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/offline-compiler.yml', 'utf8');

test('Offline Compiler uses a cheap dependency-closure preflight before cross-platform builds', () => {
  assert.match(workflow, /\n  affected:\n/);
  assert.match(workflow, /offline-compiler-affected\.js --stdin/);
  assert.match(workflow, /gh api --paginate "repos\/\$GITHUB_REPOSITORY\/pulls\/\$PR_NUMBER\/files\?per_page=100"/);
  assert.match(workflow, /gh api "repos\/\$GITHUB_REPOSITORY\/compare\/\$BEFORE\.\.\.\$GITHUB_SHA"/);
  assert.match(workflow, /build:\n    needs: affected\n    if: needs\.affected\.outputs\.affected == 'true'/);
  assert.match(workflow, /macos-intel-kit:\n    needs: affected\n    if: needs\.affected\.outputs\.affected == 'true'/);
  assert.match(workflow, /freebsd-kit:\n    needs: affected\n    if: needs\.affected\.outputs\.affected == 'true'/);
});

test('portable macOS Intel and FreeBSD kits use the same source-closure copier', () => {
  const calls = workflow.match(/node scripts\/copy-offline-compiler-source\.js "\$ROOT"/g) ?? [];
  assert.equal(calls.length, 2);
  assert.doesNotMatch(workflow, /cp -R src\/\./);
});

test('manual Offline Compiler dispatch still forces a complete build', () => {
  assert.match(workflow, /if \[ "\$GITHUB_EVENT_NAME" = 'workflow_dispatch' \]; then\n            echo 'affected=true'/);
});
