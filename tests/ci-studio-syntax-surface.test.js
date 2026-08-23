import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { discoverJavaScriptFiles } from '../scripts/check-js-syntax.js';

function readRepoText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

test('Patch CI syntax-checks current source-backed Designer and UX modules before the full suite', () => {
  const workflow = readRepoText('.github/workflows/ci.yml');
  const pkg = JSON.parse(readRepoText('package.json'));
  const syntaxStep = workflow.match(/- name: Syntax check\n\s+run: ([^\n]+)/)?.[1] ?? '';
  assert.equal(syntaxStep, 'npm run check:syntax');
  assert.equal(pkg.scripts?.['check:syntax'], 'node scripts/check-js-syntax.js');

  const discovered = discoverJavaScriptFiles();
  for (const file of [
    'src/designer.js',
    'src/designer-data.js',
    'src/designer-tabs-nested.js',
    'web/designer-selection.js',
    'web/designer-core-selection.js',
    'web/designer-data-editor.js',
    'web/designer-tabs-nested.js',
    'web/designer-structure-ux.js',
    'web/designer-workspace.js',
    'web/designer-ux.js',
    'web/form-designer-workflow.js',
    'web/designer-toolbox.js'
  ]) assert.ok(discovered.includes(file), `automatic syntax discovery is missing ${file}`);
});

test('workflow syntax-check discovery survives CRLF checkouts', () => {
  const crlf = fs.readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\n/g, '\r\n');
  const normalized = crlf.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  assert.equal(normalized.match(/- name: Syntax check\n\s+run: ([^\n]+)/)?.[1], 'npm run check:syntax');
});
