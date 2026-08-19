import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tabs = fs.readFileSync('docs/TABS.md', 'utf8');
const listbox = fs.readFileSync('docs/LISTBOX.md', 'utf8');
const studio = fs.readFileSync('docs/PATCH_STUDIO.md', 'utf8');
const roadmap = fs.readFileSync('docs/ROADMAP.md', 'utf8');
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

test('current ListBox documentation reflects native single/multi-select parity', () => {
  assert.match(listbox, /direct native Win32\/AppKit\/GTK/);
  assert.match(listbox, /create text/);
  assert.match(listbox, /create list/);
  assert.match(listbox, /Native GUI IR \*\*1\.2\*\*/);
  assert.match(listbox, /sealed payload \*\*v12\*\*/);
  assert.match(listbox, /native runtime \*\*v1\.3\*\*/);
  assert.doesNotMatch(listbox, /direct native GUI parity is not implemented yet/);
  assert.doesNotMatch(listbox, /Native GUI IR v0\.2 currently supports ComboBox but not ListBox/);
  assert.match(docs, /docs\/LISTBOX\.md/);
  assert.match(docs, /text-backed single-select and list-backed multi-select contracts/);
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

test('roadmap records the actual current Studio and native line', () => {
  assert.match(roadmap, /Current development beta: \*\*0\.2\.0-beta\.35\*\*/);
  assert.match(roadmap, /Native GUI IR: \*\*1\.2\*\*/);
  assert.match(roadmap, /current sealed native GUI payload: \*\*v12\*\*/);
  assert.match(roadmap, /current token-free Ready\/offline native runtime: \*\*v1\.3\*\*/);
  assert.match(roadmap, /\[x\] dedicated nested Table column\/row and TreeView hierarchy structural editing inside Tabs Properties/);
  assert.match(roadmap, /\[ \] shared Designer selection\/event architecture cleanup for special adapters/);
});
