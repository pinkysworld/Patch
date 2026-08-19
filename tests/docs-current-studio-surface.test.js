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
const designerSelection = fs.readFileSync('web/designer-selection.js', 'utf8');
const designerCoreSelection = fs.readFileSync('web/designer-core-selection.js', 'utf8');
const structureUx = fs.readFileSync('web/designer-structure-ux.js', 'utf8');
const formWorkflow = fs.readFileSync('web/form-designer-workflow.js', 'utf8');
const selectionArchitecture = fs.readFileSync('docs/STUDIO_SELECTION_ARCHITECTURE.md', 'utf8');

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
  assert.match(studio, /nested Table\/TreeView structural Properties editing, structural Properties summary\/filter\/empty-state polish, the shared top-level Designer selection\/Properties bridge/);
  assert.doesNotMatch(tabs, /dedicated nested Table\/TreeView structural Properties inspector is still pending/);
  assert.match(studio, /Native GUI IR \*\*1\.2\*\*/);
  assert.match(studio, /payload \*\*v12\*\*/);
  assert.match(studio, /runtime \*\*v1\.3\*\*/);
});

test('Studio docs and implementation expose current structural Properties usability without a second mutation path', () => {
  assert.match(studio, /common \*\*Structure\*\* summary/);
  assert.match(studio, /filters for TreeView nodes, Tabs pages and controls inside the selected page/);
  assert.match(studio, /Empty Tables show \*\*No rows yet\*\*/);
  assert.match(studio, /quick actions call the existing source-backed editor buttons/);
  assert.match(structureUx, /filterStructureLabels/);
  assert.match(structureUx, /structuralEditorSummary/);
  assert.match(structureUx, /clickExisting/);
  assert.doesNotMatch(structureUx, /\bcode\.value\b/);
});

test('Studio docs and implementation keep core Tabs Table and TreeView on one shared transient primary layer', () => {
  assert.match(studio, /shared `web\/designer-selection\.js` layer/);
  assert.match(studio, /one adapter-aware selection state per Designer canvas/);
  assert.match(studio, /Ordinary controls and Tabs are bridged into the same shared primary-selection and Properties boundary/);
  assert.match(studio, /never becomes Patch application state or Change History/);
  assert.match(designerSelection, /patch-designer-selection-change/);
  assert.match(designerSelection, /selectionState = new WeakMap/);
  assert.match(designerCoreSelection, /installSharedInspectorBridge/);
  assert.match(selectionArchitecture, /There is no longer a private `playground\.js` control-selection mirror/);
  assert.match(selectionArchitecture, /former Table\/TreeView Inspector fallback listeners have been removed/);
});

test('Studio docs and implementation expose the current source-backed active Form workflow', () => {
  assert.match(studio, /active Form is highlighted in the canvas/);
  assert.match(studio, /Alt\+PageUp \/ Alt\+PageDown navigate named Forms/);
  assert.match(studio, /\*\*Fit controls\*\* computes the bounding box/);
  assert.match(studio, /\*\*Default 640×420\*\*/);
  assert.match(formWorkflow, /suggestDesignerFormSize/);
  assert.match(formWorkflow, /updateDesignerWindow\(code\.value, windowIndex, size\)/);
  assert.match(formWorkflow, /patchPreviousForm/);
  assert.match(formWorkflow, /patchNextForm/);
});

test('roadmap records the actual current Studio and native line', () => {
  assert.match(roadmap, /Current development beta: \*\*0\.2\.0-beta\.35\*\*/);
  assert.match(roadmap, /Native GUI IR: \*\*1\.2\*\*/);
  assert.match(roadmap, /current sealed native GUI payload: \*\*v12\*\*/);
  assert.match(roadmap, /current token-free Ready\/offline native runtime: \*\*v1\.3\*\*/);
  assert.match(roadmap, /\[x\] dedicated nested Table column\/row and TreeView hierarchy structural editing inside Tabs Properties/);
  assert.match(roadmap, /\[x\] shared Designer selection\/event architecture cleanup across core\/Tabs\/Table\/TreeView/);
  assert.match(roadmap, /\[x\] unify core\/Tabs\/Table\/TreeView behind one shared primary-selection\/event and common Properties action architecture/);
});