import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tabs = fs.readFileSync('docs/TABS.md', 'utf8');
const listbox = fs.readFileSync('docs/LISTBOX.md', 'utf8');
const studio = fs.readFileSync('docs/PATCH_STUDIO.md', 'utf8');
const authoring = fs.readFileSync('docs/STUDIO_AUTHORING_SURFACE.md', 'utf8');
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

test('current Tabs documentation names native v1.7 and retains explicit compatibility lines', () => {
  assert.match(tabs, /Native GUI IR \*\*1\.6\*\*/);
  assert.match(tabs, /payload \*\*v16\*\*/);
  assert.match(tabs, /native runtime \*\*v1\.7\*\*/);
  assert.match(tabs, /Native GUI IR \*\*1\.5\*\* \/ payload \*\*v15\*\* \/ runtime \*\*v1\.6\*\*/);
  assert.match(tabs, /Native GUI IR \*\*1\.4\*\* \/ payload \*\*v14\*\* \/ runtime \*\*v1\.5\*\*/);
  assert.match(tabs, /Native GUI IR \*\*1\.3\*\* \/ payload \*\*v13\*\* \/ runtime \*\*v1\.4\*\*/);
  assert.match(tabs, /Native GUI IR \*\*1\.2\*\* \/ payload \*\*v12\*\* \/ runtime \*\*v1\.3\*\*/);
  assert.match(tabs, /TreeView/);
  assert.match(tabs, /Slider/);
});

test('current ListBox documentation reflects native single/multi-select preservation on v1.7', () => {
  assert.match(listbox, /direct native Win32\/AppKit\/GTK/);
  assert.match(listbox, /create text/);
  assert.match(listbox, /create list/);
  assert.match(listbox, /Native GUI IR \*\*1\.1\*\*/);
  assert.match(listbox, /Native GUI IR \*\*1\.6\*\*/);
  assert.match(listbox, /payload \*\*v16\*\*/);
  assert.match(listbox, /runtime \*\*v1\.7\*\*/);
  assert.match(listbox, /payload v12 \/ runtime v1\.3/);
  assert.match(docs, /docs\/LISTBOX\.md/);
});

test('Studio public help describes current nested Tabs structural Properties editing', () => {
  assert.match(help, /Tabs pages can contain Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table and TreeView/);
  assert.match(help, /Click <strong>Edit<\/strong> beside a nested Table/);
  assert.match(help, /Click <strong>Edit<\/strong> beside a nested TreeView/);
  assert.match(docs, /docs\/STUDIO_KEYBOARD_ACCESSIBILITY\.md/);
});

test('nested Tabs implementation and current Studio docs stay aligned', () => {
  assert.match(nested, /'table', 'tree'/);
  assert.match(nested, /'slider'/);
  assert.match(nested, /updateDesignerTabPageTableData/);
  assert.match(nested, /updateDesignerTabPageTreeNodes/);
  assert.match(nestedWeb, /Nested Table data/);
  assert.match(nestedWeb, /Nested TreeView nodes/);
  assert.match(nestedWeb, /data-tabs-table-action/);
  assert.match(nestedWeb, /data-tabs-tree-action/);
  assert.match(studio, /Table, TreeView and Tabs structural editors rewrite their selected source block directly/);
  assert.match(studio, /Native GUI IR \*\*1\.6\*\*/);
  assert.match(studio, /payload \*\*v16\*\*/);
  assert.match(studio, /runtime \*\*v1\.7\*\*/);
  assert.match(studio, /Native GUI IR 1\.2 \/ payload v12 \/ runtime v1\.3/);
});

test('Studio structural Properties usability remains source-backed without a second mutation path', () => {
  assert.match(authoring, /structural summaries and filters/);
  assert.match(authoring, /nested Table and TreeView structural editors use the same source-backed semantics/);
  assert.match(authoring, /do not become Patch application state or Change History entries/);
  assert.match(structureUx, /filterStructureLabels/);
  assert.match(structureUx, /structuralEditorSummary/);
  assert.match(structureUx, /clickExisting/);
  assert.doesNotMatch(structureUx, /\bcode\.value\b/);
});

test('Table reorder/duplicate documentation matches the shared source-backed action layer', () => {
  assert.match(tableActionsDoc, /Row Up \/ Down/);
  assert.match(tableActionsDoc, /Duplicate Row/);
  assert.match(tableActionsDoc, /Column Left \/ Right/);
  assert.match(tableActionsDoc, /Duplicate Column/);
  assert.match(tableActionsDoc, /header and the matching cell in every row always move together/);
  assert.match(tableActionsDoc, /Top-level Tables use `updateDesignerTableData`/);
  assert.match(tableActionsDoc, /nested Tables use `updateDesignerTabPageTableData`/);
  assert.match(tableActionsWeb, /updateDesignerTableData/);
  assert.match(tableActionsWeb, /updateDesignerTabPageTableData/);
  assert.match(tableActionsDoc, /Change IR 0\.10/);
});

test('Studio keeps core structural controls on one shared transient primary selection layer', () => {
  assert.match(authoring, /`web\/designer-selection\.js` is the authoritative primary-selection store/);
  assert.match(authoring, /shared primary selection and common Properties actions/);
  assert.match(authoring, /transient multi-select/);
  assert.match(authoring, /do not become Patch application state or Change History entries/);
  assert.match(designerSelection, /patch-designer-selection-change/);
  assert.match(designerSelection, /selectionState = new WeakMap/);
  assert.match(designerCoreSelection, /installSharedInspectorBridge/);
  assert.match(selectionArchitecture, /There is no longer a private `playground\.js` control-selection mirror/);
});

test('Studio implementation exposes the current source-backed active Form workflow', () => {
  assert.match(authoring, /activate a Form from its canvas title/);
  assert.match(authoring, /fit the Form to its controls/);
  assert.match(authoring, /restore the 640×420 default size/);
  assert.match(formWorkflow, /suggestDesignerFormSize/);
  assert.match(formWorkflow, /updateDesignerWindow\(code\.value, windowIndex, size\)/);
  assert.match(formWorkflow, /patchPreviousForm/);
  assert.match(formWorkflow, /patchNextForm/);
});

test('roadmap records beta36 current Studio/native line and truthful RAD backlog', () => {
  assert.match(roadmap, /Current development beta: \*\*0\.2\.0-beta\.36\*\*/);
  assert.match(roadmap, /Native GUI IR: \*\*1\.6\*\*/);
  assert.match(roadmap, /current sealed native GUI payload: \*\*v16\*\*/);
  assert.match(roadmap, /current token-free Ready\/offline runtime: \*\*v1\.7\*\*/);
  assert.match(roadmap, /frozen TreeView compatibility line: Native GUI IR \*\*1\.2\*\* \/ payload \*\*v12\*\* \/ runtime \*\*v1\.3\*\*/);
  assert.match(roadmap, /project bundle v4/);
  assert.match(roadmap, /ImageList Stage 1/);
  assert.match(roadmap, /Shape native lowering\/runtime parity/);
  assert.match(roadmap, /Memo\/TextArea, PasswordEdit, ProgressBar, SpinEdit\/NumberEdit, Date\/Time controls/);
});
