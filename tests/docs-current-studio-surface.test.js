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
const tableActionsDoc = fs.readFileSync('docs/STUDIO_TABLE_ACTIONS.md', 'utf8');
const tableActionsWeb = fs.readFileSync('web/designer-table-actions.js', 'utf8');

test('current Tabs documentation names native v1.4 and retains frozen v1.3 compatibility', () => {
  assert.match(tabs, /Native GUI IR \*\*1\.3\*\*/);
  assert.match(tabs, /payload v13 \/ runtime v1\.4\s+current Slider-capable Ready\/offline line/);
  assert.match(tabs, /payload v12 \/ runtime v1\.3\s+frozen TreeView-capable line, Slider fail-closed/);
  assert.match(tabs, /Slider/);
  assert.doesNotMatch(tabs, /payload v12 \/ runtime v1\.3\s+current TreeView-capable Ready\/offline line/);
});

test('current ListBox documentation reflects native single/multi-select parity on v1.4', () => {
  assert.match(listbox, /direct native Win32\/AppKit\/GTK/);
  assert.match(listbox, /create text/);
  assert.match(listbox, /create list/);
  assert.match(listbox, /Native GUI IR \*\*1\.1\*\*/);
  assert.match(listbox, /Native GUI IR \*\*1\.3\*\*/);
  assert.match(listbox, /sealed payload \*\*v13\*\*/);
  assert.match(listbox, /native runtime \*\*v1\.4\*\*/);
  assert.match(listbox, /payload v12 \/ runtime v1\.3\s+frozen TreeView-capable line/);
  assert.doesNotMatch(listbox, /direct native GUI parity is not implemented yet/);
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

test('nested Tabs implementation and docs stay aligned on Table TreeView and Slider editing', () => {
  assert.match(nested, /'table', 'tree'/);
  assert.match(nested, /'slider'/);
  assert.match(nested, /updateDesignerTabPageTableData/);
  assert.match(nested, /updateDesignerTabPageTreeNodes/);
  assert.match(nestedWeb, /Nested Table data/);
  assert.match(nestedWeb, /Nested TreeView nodes/);
  assert.match(nestedWeb, /data-tabs-table-action/);
  assert.match(nestedWeb, /data-tabs-tree-action/);
  assert.match(studio, /Table, TreeView and Tabs additionally expose source-backed structural editors inside Properties/);
  assert.match(studio, /All top-level controls (?:now )?share one authoritative primary-selection and common Properties action boundary/);
  assert.doesNotMatch(tabs, /dedicated nested Table\/TreeView structural Properties inspector is still pending/);
  assert.match(studio, /Native GUI IR \*\*1\.3\*\*/);
  assert.match(studio, /payload \*\*v13\*\*/);
  assert.match(studio, /runtime \*\*v1\.4\*\*/);
  assert.match(studio, /Native GUI IR \*\*1\.2\*\* \/ payload \*\*v12\*\* \/ runtime \*\*v1\.3\*\* remains the frozen TreeView compatibility line/);
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

test('Table reorder/duplicate documentation matches the shared top-level and nested source-backed action layer', () => {
  assert.match(tableActionsDoc, /Row Up \/ Down/);
  assert.match(tableActionsDoc, /Duplicate Row/);
  assert.match(tableActionsDoc, /Column Left \/ Right/);
  assert.match(tableActionsDoc, /Duplicate Column/);
  assert.match(tableActionsDoc, /header and the matching cell in every row always move together/);
  assert.match(tableActionsDoc, /Top-level Tables use `updateDesignerTableData`/);
  assert.match(tableActionsDoc, /nested Tables use `updateDesignerTabPageTableData`/);
  assert.match(tableActionsWeb, /updateDesignerTableData/);
  assert.match(tableActionsWeb, /updateDesignerTabPageTableData/);
  assert.match(tableActionsWeb, /toolbar\.dataset\.signature === signature/);
  assert.match(tableActionsDoc, /Change IR 0\.10/);
});

test('Studio docs and implementation keep core Tabs Table and TreeView on one shared transient primary layer', () => {
  assert.match(studio, /`web\/designer-selection\.js` owns the adapter-aware selection record/);
  assert.match(studio, /All top-level controls (?:now )?share one authoritative primary-selection and common Properties action boundary/);
  assert.match(studio, /Designer multi-select remains an explicit transient secondary set over the shared primary selection/);
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

test('roadmap records the actual current Studio and native line plus frozen compatibility', () => {
  assert.match(roadmap, /Current development beta: \*\*0\.2\.0-beta\.35\*\*/);
  assert.match(roadmap, /Native GUI IR: \*\*1\.3\*\*/);
  assert.match(roadmap, /current sealed native GUI payload: \*\*v13\*\*/);
  assert.match(roadmap, /current token-free Ready\/offline (?:native )?runtime: \*\*v1\.4\*\* on Windows, macOS and Linux/);
  assert.match(roadmap, /frozen TreeView compatibility line: Native GUI IR \*\*1\.2\*\* \/ payload \*\*v12\*\* \/ runtime \*\*v1\.3\*\*/);
  assert.match(roadmap, /Slider Stage 1 source syntax, Designer, Tabs, browser preview, Standalone Web and native Windows\/macOS\/Linux parity/);
  assert.match(roadmap, /Native GUI IR 1\.3 \/ payload v13 \/ runtime v1\.4 additive Slider line while v12\/v1\.3 remains frozen/);
  assert.match(roadmap, /Table\/Grid Stage 1 with selected-row events and source-backed structural Properties editing/);
  assert.match(roadmap, /TreeView hierarchy, source-backed structural editing, browser preview and current native parity/);
  assert.match(roadmap, /shared top-level control selection and source-backed Properties actions/);
  assert.match(roadmap, /Tabs page lifecycle plus nested Text\/Button\/Input\/Checkbox\/Radio\/ComboBox\/ListBox\/Slider\/Table\/TreeView editing/);
});
