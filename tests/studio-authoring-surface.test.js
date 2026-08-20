import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const surface = fs.readFileSync('docs/STUDIO_AUTHORING_SURFACE.md', 'utf8');
const docsPage = fs.readFileSync('web/docs.html', 'utf8');
const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');

test('current Studio authoring surface records the complete Form lifecycle', () => {
  for (const marker of [
    'add a Form',
    'select and navigate Forms',
    'edit source-backed name, title, width and height',
    'fit the Form to its controls',
    'duplicate the complete Form',
    'delete a Form with explicit confirmation',
    'refuse deletion of the last remaining Form'
  ]) assert.match(surface, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workspace, /designer-form-duplicate\.js/);
  assert.match(workspace, /designer-form-delete\.js/);
});

test('current Studio authoring surface records shared top-level control workflows', () => {
  assert.match(surface, /Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Table, TreeView and Tabs/);
  assert.match(surface, /shared primary selection and common Properties actions/);
  assert.match(surface, /duplicate as a real Patch source block/);
  assert.match(surface, /Center H \/ Center V/);
  assert.match(surface, /collision-aware Auto place/);
  assert.match(surface, /transient multi-select/);
  assert.match(workspace, /designer-control-duplicate\.js/);
  assert.match(workspace, /designer-layout-actions\.js/);
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
  assert.match(surface, /Patch \*\*0\.2\.0-beta\.35\*\*/);
  assert.match(surface, /Change IR \*\*0\.10\*\*/);
  assert.match(surface, /Native GUI IR \*\*1\.2\*\*/);
  assert.match(surface, /payload \*\*v12\*\*/);
  assert.match(surface, /runtime \*\*v1\.3\*\*/);
  assert.match(surface, /formal runtime-correspondence milestone remaining \*\*beta\.32\*\*/);
});

test('current Studio authoring surface explicitly separates future work from missing current implementation', () => {
  assert.match(surface, /complete current authoring surface for the \*\*existing Patch UI\/control vocabulary\*\*/);
  assert.match(surface, /new\/richer data controls beyond the current Table, ListBox and TreeView vocabulary/);
  assert.match(surface, /manual assistive-technology verification with Narrator, VoiceOver, Orca/);
  assert.match(surface, /makes no WCAG conformance claim/);
  assert.match(surface, /distribution work such as installer\/uninstaller formats/);
});

test('public Documentation page links the current authoring contracts', () => {
  for (const path of [
    'docs/STUDIO_AUTHORING_SURFACE.md',
    'docs/STUDIO_CONTROL_DUPLICATION.md',
    'docs/STUDIO_FORM_DUPLICATION.md',
    'docs/STUDIO_FORM_DELETION.md',
    'docs/STUDIO_TABLE_ACTIONS.md',
    'docs/STUDIO_TREE_ACTIONS.md',
    'docs/STUDIO_TABS_CONTROL_ACTIONS.md',
    'docs/STUDIO_TABS_PAGE_DUPLICATION.md'
  ]) assert.match(docsPage, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
