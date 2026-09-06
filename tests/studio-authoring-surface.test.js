import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function readRepoText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

const surface = readRepoText('docs/STUDIO_AUTHORING_SURFACE.md');
const docsPage = readRepoText('web/docs.html');
const workspace = readRepoText('web/designer-workspace.js');

test('current Studio authoring surface records the complete Form lifecycle', () => {
  for (const marker of [
    'add a Form',
    'select and navigate Forms',
    'edit source-backed name, title, icon, width and height',
    'fit the Form to its controls',
    'duplicate the complete Form',
    'delete a Form with explicit confirmation',
    'refuse deletion of the last remaining Form'
  ]) assert.match(surface, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workspace, /designer-form-duplicate\.js/);
  assert.match(workspace, /designer-form-delete\.js/);
});

test('current Studio authoring surface records shared top-level control workflows', () => {
  assert.match(surface, /Text, Button, Input, Memo, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox and StatusBar/);
  assert.match(surface, /shared primary selection and common Properties actions/);
  assert.match(surface, /duplicate as a real Patch source block/);
  assert.match(surface, /Center H \/ Center V/);
  assert.match(surface, /collision-aware Auto place/);
  assert.match(surface, /transient multi-select/);
  assert.match(surface, /Timer and ImageList/);
  assert.match(surface, /independent source-backed TabOrder/);
  assert.match(surface, /Layers\/Object Tree/);
  assert.match(workspace, /designer-control-duplicate\.js/);
  assert.match(workspace, /designer-layout-actions\.js/);
});

test('current Studio authoring surface records source-backed R4 presentations and boundaries', () => {
  assert.match(surface, /PasswordEdit as ordinary Input plus `# @input-mode password`/);
  assert.match(surface, /MaskedEdit as ordinary Input plus `# @input-mask "\.\.\."`/);
  assert.match(surface, /CheckedListBox as list-backed ListBox plus `# @listbox-mode checked`/);
  assert.match(surface, /ProgressBar as number-backed Slider plus `# @slider-mode progress`/);
  assert.match(surface, /GroupBox as ordinary Panel plus `# @panel-mode group`/);
  assert.match(surface, /ProgressBar Stage 1 is passive/);
  assert.match(surface, /GroupBox Stage 1 does not introduce hidden state or a second containment type/);
  assert.match(surface, /has no control event/);
  assert.match(surface, /Clipboard v2 preserves/);
  assert.match(surface, /Current Ready Native GUI IR 1\.9 \/ payload v19 \/ runtime v1\.10 deliberately fails closed/);
});

test('current Studio authoring surface records Table TreeView and Tabs structural workflows', () => {
  assert.match(surface, /Duplicate Row/);
  assert.match(surface, /Duplicate Column/);
  assert.match(surface, /header and the corresponding cell in every row together/);
  assert.match(surface, /duplicate the selected node and its complete descendant subtree/);
  assert.match(surface, /duplicate the complete page/);
  assert.match(surface, /move up\/down;\n- duplicate;/);
  assert.match(workspace, /designer-table-actions\.js/);
  assert.match(workspace, /designer-tree-duplicate\.js/);
  assert.match(workspace, /designer-tabs-control-actions\.js/);
  assert.match(workspace, /designer-tabs-page-duplicate\.js/);
});

test('current Studio authoring surface preserves source and assurance boundaries', () => {
  assert.match(surface, /never creates a hidden `\.frm`, `\.dfm`, second control tree/);
  assert.match(surface, /Handler bodies are preserved verbatim/);
  assert.match(surface, /Patch \*\*0\.2\.0-beta\.36\*\*/);
  assert.match(surface, /Studio project bundle \*\*v4\*\*/);
  assert.match(surface, /Component Registry \*\*0\.10\*\*/);
  assert.match(surface, /Change IR \*\*0\.10\*\*/);
  assert.match(surface, /Native GUI IR \*\*1\.9\*\*/);
  assert.match(surface, /sealed payload \*\*v19\*\*/);
  assert.match(surface, /runtime \*\*v1\.10\*\*/);
  assert.match(surface, /formal runtime-correspondence milestone remains \*\*beta\.32\*\*/);
});

test('current Studio authoring surface explicitly separates future work from current implementation', () => {
  assert.match(surface, /complete current authoring surface for the \*\*existing Patch UI\/control vocabulary\*\*/);
  assert.match(surface, /new\/richer data controls beyond the current Table, ListBox and TreeView vocabulary/);
  assert.match(surface, /Number\/SpinEdit, date\/time controls, ScrollBox\/SplitContainer/);
  assert.doesNotMatch(surface, /Number\/SpinEdit, date\/time controls, GroupBox\/ScrollBox\/SplitContainer/);
  assert.match(surface, /Undo\/Redo transaction coverage/);
  assert.match(surface, /manual assistive-technology verification with Narrator, VoiceOver, Orca/);
  assert.match(surface, /makes no WCAG conformance claim/);
  assert.match(surface, /distribution work such as installer\/uninstaller formats/);
});

test('public Documentation page links the current authoring contracts', () => {
  for (const path of [
    'docs/STUDIO_AUTHORING_SURFACE.md',
    'docs/STUDIO_PROJECT_OUTLINE.md',
    'docs/STUDIO_COMMAND_PALETTE.md',
    'docs/STUDIO_SELECTION_ARCHITECTURE.md',
    'docs/STUDIO_LAYOUT_ACTIONS.md',
    'docs/STUDIO_KEYBOARD_ACCESSIBILITY.md'
  ]) assert.match(docsPage, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
