import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tabs = fs.readFileSync('docs/TABS.md', 'utf8');
const studio = fs.readFileSync('docs/PATCH_STUDIO.md', 'utf8');
const help = fs.readFileSync('web/help.html', 'utf8');
const docs = fs.readFileSync('web/docs.html', 'utf8');
const nested = fs.readFileSync('src/designer-tabs-nested.js', 'utf8');
const nestedWeb = fs.readFileSync('web/designer-tabs-nested.js', 'utf8');

test('current Tabs documentation names the active native contract rather than the historical v0.4 line', () => {
  assert.match(tabs, /Native GUI IR \*\*1\.2\*\*/);
  assert.match(tabs, /payload \*\*v12\*\*/);
  assert.match(tabs, /runtime \*\*v1\.3\*\*/);
  assert.match(tabs, /payload v12 \/ runtime v1\.3\s+current TreeView-capable Ready\/offline line/);
  assert.doesNotMatch(tabs, /The corresponding token-free runtime releases are:\s*\n\s*- `native-win32-runtime-v0\.4`/);
});

test('Studio public docs describe current nested Tabs structural Properties editing', () => {
  assert.match(help, /Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView directly to that page/);
  assert.match(help, /Click <strong>Edit<\/strong> beside a nested Table/);
  assert.match(help, /Click <strong>Edit<\/strong> beside a nested TreeView/);
  assert.match(docs, /docs\/TABS\.md/);
  assert.match(docs, /nested Table\/TreeView structural Properties editing/);
});

test('nested Tabs implementation and docs stay aligned on Table and TreeView structural editing', () => {
  assert.match(nested, /'table', 'tree'/);
  assert.match(nested, /updateDesignerTabPageTableData/);
  assert.match(nested, /updateDesignerTabPageTreeNodes/);
  assert.match(nestedWeb, /Nested Table data/);
  assert.match(nestedWeb, /Nested TreeView nodes/);
  assert.match(nestedWeb, /data-tabs-table-action/);
  assert.match(nestedWeb, /data-tabs-tree-action/);
  assert.match(studio, /nested Table\/TreeView structural Properties editing are complete/);
  assert.doesNotMatch(tabs, /dedicated nested Table\/TreeView structural Properties inspector is still pending/);
  assert.match(studio, /Native GUI IR \*\*1\.2\*\*/);
  assert.match(studio, /payload \*\*v12\*\*/);
  assert.match(studio, /runtime \*\*v1\.3\*\*/);
});
