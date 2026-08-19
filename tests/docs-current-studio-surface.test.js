import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tabs = fs.readFileSync('docs/TABS.md', 'utf8');
const studio = fs.readFileSync('docs/PATCH_STUDIO.md', 'utf8');
const help = fs.readFileSync('web/help.html', 'utf8');
const docs = fs.readFileSync('web/docs.html', 'utf8');
const nested = fs.readFileSync('src/designer-tabs-nested.js', 'utf8');

test('current Tabs documentation names the active native contract rather than the historical v0.4 line', () => {
  assert.match(tabs, /Native GUI IR \*\*1\.2\*\*/);
  assert.match(tabs, /payload \*\*v12\*\*/);
  assert.match(tabs, /runtime \*\*v1\.3\*\*/);
  assert.match(tabs, /payload v12 \/ runtime v1\.3\s+current TreeView-capable Ready\/offline line/);
  assert.doesNotMatch(tabs, /The corresponding token-free runtime releases are:\s*\n\s*- `native-win32-runtime-v0\.4`/);
});

test('Studio public docs describe the current source-backed nested Tabs surface', () => {
  assert.match(help, /Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table and TreeView directly to that page/);
  assert.match(help, /complete multi-line <code>row<\/code>\/<code>node<\/code> block/);
  assert.match(docs, /docs\/TABS\.md/);
  assert.match(docs, /source-backed page editing, nested controls, Table\/TreeView support/);
});

test('nested Tabs implementation and docs stay aligned on Table and TreeView availability', () => {
  assert.match(nested, /'table', 'tree'/);
  assert.match(nested, /table \"Name\", \"Value\" as/);
  assert.match(nested, /tree as \$\{id\}/);
  assert.match(studio, /Native GUI IR \*\*1\.2\*\*/);
  assert.match(studio, /payload \*\*v12\*\*/);
  assert.match(studio, /runtime \*\*v1\.3\*\*/);
});
