import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'docs', 'README.md');
const indexText = fs.readFileSync(indexPath, 'utf8');

test('docs index local Markdown links resolve to tracked files', () => {
  const links = [...indexText.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map(match => match[1])
    .filter(target => !/^[a-z]+:/i.test(target) && !target.startsWith('#'));

  assert.ok(links.length >= 20, 'docs index should remain a useful navigation surface');

  for (const target of links) {
    const withoutAnchor = target.split('#')[0];
    const resolved = path.resolve(path.dirname(indexPath), withoutAnchor);
    assert.ok(
      resolved.startsWith(root + path.sep) || resolved === root,
      `docs index link escapes repository root: ${target}`
    );
    assert.ok(fs.existsSync(resolved), `docs index link does not exist: ${target}`);
  }
});

test('docs index distinguishes live product contracts from historical beta snapshots', () => {
  assert.match(indexText, /Current Ready desktop product contract: \*\*Native GUI IR 1\.7 \/ payload v17 \/ runtime v1\.8\*\*/);
  assert.match(indexText, /IR 1\.9 \/ payload v19 \/ runtime v1\.10/);
  assert.match(indexText, /not promoted/i);
  assert.match(indexText, /BETA33\.md.*BETA34\.md.*BETA35\.md[\s\S]*historical snapshots/i);
  assert.match(indexText, /BETA36\.md.*current beta milestone record/i);
});