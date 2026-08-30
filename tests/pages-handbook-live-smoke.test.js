import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');

test('Pages deployment smoke verifies the published handbook subpages', () => {
  assert.match(pages, /for handbook in tutorials examples; do/);
  assert.match(pages, /fetch_asset "\$\{base\}\$\{handbook\}\.html\?smoke=\$\{cache_bust\}"/);
  assert.match(pages, /grep -F 'data-patch-version="0\.2\.0-beta\.36"'/);
  assert.match(pages, /grep -F "\.\/docs-handbook\.css\?v=\$\{revision\}"/);
  assert.match(pages, /Patch handbook · Tutorials/);
  assert.match(pages, /Patch handbook · Examples/);
  assert.match(pages, /docs-handbook\.css/);
});
