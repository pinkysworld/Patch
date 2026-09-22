import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { compile } from '../src/compiler.js';
import { PatchInterpreter } from '../src/interpreter.js';
import {
  PATCH_LISTVIEW_MODES,
  PATCH_LISTVIEW_VERSION,
  formatPatchListViewItemDeclaration,
  normalizeListViewMode,
  parsePatchListViewItemDeclaration
} from '../src/listview-control.js';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl
} from '../src/designer.js';
import { updateDesignerListViewData } from '../src/designer-data.js';
import { patchComponent, PATCH_COMPONENT_REGISTRY_VERSION } from '../src/component-registry.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildStandaloneWindowWebApp } from '../src/window-webapp.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';
import { triggerWindowEvent } from '../src/window-events.js';

const SOURCE = `create text selected = ""

window "Files" as main size 640, 420:
  imagelist as file_icons size 16, 16:
    image folder from "patch-resource:icons.folder"
    image file from "patch-resource:icons.file"

  listview icons as files at 24, 72 size 360, 220:
    item "src" image file_icons.folder detail "Source folder"
    item "README.md" image file_icons.file detail "Documentation"

when files changed:
  change selected:
    set = value
`;

test('ListView Stage 1 exposes bounded source syntax for icons and details', () => {
  assert.equal(PATCH_LISTVIEW_VERSION, '0.1');
  assert.deepEqual(PATCH_LISTVIEW_MODES, ['icons', 'details']);
  assert.equal(normalizeListViewMode('DETAILS'), 'details');
  assert.throws(() => normalizeListViewMode('tiles'), /icons, details/i);

  assert.deepEqual(parsePatchListViewItemDeclaration('item "README.md" image file_icons.file detail "Documentation"'), {
    labelExpr: '"README.md"',
    imageListId: 'file_icons',
    imageItem: 'file',
    detail: 'Documentation'
  });
  assert.deepEqual(parsePatchListViewItemDeclaration('item "plain"'), {
    labelExpr: '"plain"',
    imageListId: null,
    imageItem: null
  });
  assert.equal(
    formatPatchListViewItemDeclaration({ labelExpr: '"src"', imageListId: 'file_icons', imageItem: 'folder', detail: 'Source folder' }),
    'item "src" image file_icons.folder detail "Source folder"'
  );
});

test('compiler and interpreter keep ListView mode and presentation metadata while label remains event identity', () => {
  const compiled = compile(SOURCE, { name: 'ListViewStage1', kind: 'window' });
  const view = compiled.ast[1].body.find(node => node.kind === 'uiControl' && node.control === 'listview');
  assert.equal(view.mode, 'icons');
  assert.equal(view.items.length, 2);
  assert.equal(view.items[0].imageListId, 'file_icons');
  assert.equal(view.items[0].detail, 'Source folder');

  const ir = compiled.ir.instructions.find(node => node.code === 'WINDOW').body.find(node => node.code === 'UI_CONTROL' && node.control === 'listview');
  assert.equal(ir.mode, 'icons');
  assert.equal(ir.items[1].detail, 'Documentation');
  assert.ok(compiled.runtimeCapabilities.includes('ui.listview'));

  const result = new PatchInterpreter().run(SOURCE);
  const model = result.ui[0].controls.find(control => control.type === 'listview');
  assert.equal(model.listViewMode, 'icons');
  assert.deepEqual(model.listViewItems.map(item => [item.label, item.detail]), [
    ['src', 'Source folder'],
    ['README.md', 'Documentation']
  ]);
  assert.equal(model.listViewItems[0].imageSource, 'patch-resource:icons.folder');
});

test('ListView changed(value) is selected label text only', () => {
  const runtime = new PatchInterpreter();
  runtime.run(SOURCE);
  const changed = triggerWindowEvent(runtime, 'files', 'changed', { value: 'README.md' });
  assert.equal(changed.state.selected, 'README.md');
  assert.equal(changed.history.at(-1).after, 'README.md');
  assert.throws(
    () => triggerWindowEvent(runtime, 'files', 'changed', { value: ['README.md', 'Documentation'] }),
    /needs a text event-local value/i
  );
});

test('ListView validates ImageList bindings and remains Current Ready native fail-closed', () => {
  const compiled = compile(SOURCE, { name: 'ListViewStage1', kind: 'window' });
  const support = validateWindowRuntimeSupport(compiled, { allowListView: true, allowImageList: true });
  assert.equal(support.listViews, 1);
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, { allowImageList: true }),
    /ListView Stage 1.*Studio\/Web only/i
  );
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /ListView Stage 1.*Studio\/Web only.*Current Ready native 1\.10/i
  );

  const missing = SOURCE.replace('image file_icons.file detail "Documentation"', 'image file_icons.missing detail "Documentation"');
  assert.throws(
    () => validateWindowRuntimeSupport(compile(missing, { kind: 'window' }), { allowListView: true, allowImageList: true }),
    /ImageList item 'missing'.*not in 'file_icons'/i
  );
});

test('Standalone Web and Studio render both ListView presentation layers without changing event value', () => {
  const built = buildStandaloneWindowWebApp(compile(SOURCE, { name: 'ListViewStage1', kind: 'window' }), 'ListViewStage1');
  assert.equal(built.metadata.listViewStage, 1);
  assert.equal(built.metadata.listViewVersion, '0.1');
  assert.deepEqual(built.metadata.listViewModes, ['icons', 'details']);
  assert.equal(built.metadata.listViewEventValue, 'selected-label-text');
  assert.match(built.html, /patch-listview/);
  assert.match(built.html, /patchListviewMode/);
  assert.match(built.html, /safeTrigger\(control\.id,'changed',\{value:item\.label\}\)/);

  const studio = fs.readFileSync('web/studio-window-renderer.js', 'utf8');
  assert.match(studio, /createListViewElement/);
  assert.match(studio, /patchRuntimeSelectionKind = 'listview'/);
  assert.match(studio, /context\.dispatch\(control\.id, 'changed', \{ value: label \}\)/);
  assert.match(studio, /patch-listview-detail/);
});

test('Designer creates edits and removes ListView as one source-backed block', () => {
  const base = `window "Designer" as main size 640, 420:
  text "Ready" at 24, 24 size 120, 28
`;
  const added = addDesignerControl(base, 'listview', { windowIndex: 0 });
  const control = listDesignerControls(added).find(item => item.type === 'listview');
  assert.ok(control);
  assert.equal(control.mode, 'details');
  assert.equal(control.items.length, 2);
  assert.match(added, /listview details as listview_1/);

  const edited = updateDesignerListViewData(added, control, {
    mode: 'icons',
    items: [
      { labelExpr: '"Folder"', detail: 'Source folder' },
      { labelExpr: '"File"', imageListId: 'icons', imageItem: 'file', detail: 'Document' }
    ]
  });
  assert.match(edited, /listview icons as listview_1/);
  assert.match(edited, /item "Folder" detail "Source folder"/);
  assert.match(edited, /item "File" image icons\.file detail "Document"/);
  assert.throws(() => compile(edited, { kind: 'window' }), /ImageList 'icons'.*not defined/i);

  const removed = removeDesignerControl(added, control);
  assert.doesNotMatch(removed, /listview|item "Item/);
  assert.doesNotThrow(() => compile(removed, { kind: 'window' }));
});

test('Component Registry 0.11 and Studio authoring surface expose ListView explicitly', () => {
  assert.equal(PATCH_COMPONENT_REGISTRY_VERSION, '0.11');
  const component = patchComponent('listview');
  assert.equal(component.label, 'ListView');
  assert.equal(component.category, 'Data');
  assert.deepEqual(component.properties.map(property => property.name), ['id', 'mode', 'items', 'x', 'y', 'width', 'height']);
  assert.deepEqual(component.events, [{ name: 'changed', label: 'OnChange', value: true }]);
  assert.deepEqual(component.targetSupport, {
    studio: 'supported', web: 'supported', windows: 'unsupported', macos: 'unsupported', linux: 'unsupported', freebsd: 'unsupported'
  });

  const toolbox = fs.readFileSync('web/designer-toolbox.js', 'utf8');
  const editor = fs.readFileSync('web/designer-data-editor.js', 'utf8');
  const keyboard = fs.readFileSync('web/designer-structural-keyboard.js', 'utf8');
  assert.match(toolbox, /id = 'addListview'/);
  assert.match(toolbox, /addDesignerControl\(code\.value, 'listview'/);
  assert.match(editor, /renderListViewEditor/);
  assert.match(editor, /updateDesignerListViewData/);
  assert.match(keyboard, /data-listview-label/);
  assert.match(keyboard, /data-listview-mode/);
});

test('ListView Stage 1 is intentionally top-level and fails closed in Tabs and Panel blocks', () => {
  const nestedTabs = `window "Nested":
  tabs as pages:
    tab "One":
      listview details as files:
        item "File"
    tab "Two":
      text "Two"
`;
  assert.throws(() => compile(nestedTabs, { kind: 'window' }), /ListView Stage 1 is top-level only/i);

  const nestedPanel = `window "Nested":
  panel as content:
    listview details as files:
      item "File"
`;
  assert.throws(() => compile(nestedPanel, { kind: 'window' }), /cannot yet nest.*ListView/i);
});
