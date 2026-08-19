import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Patch CI syntax-checks current source-backed Designer and UX modules before the full suite', () => {
  const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  const syntaxStep = workflow.match(/- name: Syntax check\n\s+run: ([^\n]+)/)?.[1] ?? '';
  assert.match(syntaxStep, /node --check src\/designer\.js/);
  assert.match(syntaxStep, /node --check src\/designer-data\.js/);
  assert.match(syntaxStep, /node --check src\/designer-tabs-nested\.js/);
  assert.match(syntaxStep, /node --check web\/designer-selection\.js/);
  assert.match(syntaxStep, /node --check web\/designer-core-selection\.js/);
  assert.match(syntaxStep, /node --check web\/designer-data-editor\.js/);
  assert.match(syntaxStep, /node --check web\/designer-tabs-nested\.js/);
  assert.match(syntaxStep, /node --check web\/designer-structure-ux\.js/);
  assert.match(syntaxStep, /node --check web\/designer-workspace\.js/);
  assert.match(syntaxStep, /node --check web\/designer-ux\.js/);
  assert.match(syntaxStep, /node --check web\/form-designer-workflow\.js/);
  assert.match(syntaxStep, /node --check web\/designer-toolbox\.js/);
});
