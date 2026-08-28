import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  designerEventSpec,
  ensureDesignerEventHandler,
  findDesignerEventHandler
} from '../web/designer-event-inspector.js';
import { listDesignerFocusOrder, reorderDesignerFocusOrder } from '../web/designer-focus-order.js';
import {
  DESIGNER_TOOL_CATALOG,
  filterDesignerTools,
  groupedDesignerTools
} from '../web/designer-toolbox.js';

test('RAD Events inspector maps current control types to Patch event contracts', () => {
  assert.deepEqual(designerEventSpec('button'), { event: 'clicked', label: 'OnClick', value: false });
  assert.deepEqual(designerEventSpec('input'), { event: 'changed', label: 'OnChange', value: true });
  assert.deepEqual(designerEventSpec('timer'), { event: 'ticked', label: 'OnTick', value: false });
  assert.deepEqual(designerEventSpec('picture'), { event: 'clicked', label: 'OnClick', value: false });
  assert.deepEqual(designerEventSpec('paintbox'), { event: 'paint', label: 'OnPaint', value: false });
  assert.equal(designerEventSpec('imagelist'), null);
  assert.equal(designerEventSpec('panel'), null);
  assert.equal(designerEventSpec('statusbar'), null);
});

test('RAD Events inspector creates ordinary visible Patch source and never duplicates an existing handler', () => {
  const source = `window "Demo" as main size 480, 280:\n  button "Save" as save_button at 24, 24 size 120, 36\n`;
  const created = ensureDesignerEventHandler(source, 'save_button', 'button');
  assert.equal(created.created, true);
  assert.match(created.source, /when save_button clicked:\n  show "save_button clicked"/);
  assert.equal(created.handler.line, 4);
  const reopened = ensureDesignerEventHandler(created.source, 'save_button', 'button');
  assert.equal(reopened.created, false);
  assert.equal(reopened.source, created.source);
  assert.equal((created.source.match(/when save_button clicked:/g) ?? []).length, 1);
});

test('RAD Events inspector creates value-aware changed handlers and locates source offsets', () => {
  const source = `create text name = "Ada"\nwindow "Demo" as main size 480, 280:\n  input name at 24, 24 size 220, 36\n`;
  const result = ensureDesignerEventHandler(source, 'name', 'input');
  assert.match(result.source, /when name changed:\n  show value/);
  const found = findDesignerEventHandler(result.source, 'name', 'changed');
  assert.ok(found);
  assert.equal(result.source.slice(found.start, found.end), 'when name changed:');
});

test('RAD Events inspector rejects anonymous and eventless controls', () => {
  assert.throws(() => ensureDesignerEventHandler('window "X":\n  text "Hi"\n', '', 'text'), /needs a named Patch id/i);
  assert.throws(() => ensureDesignerEventHandler('window "X":\n  panel as p:\n    text "Hi"\n', 'p', 'panel'), /does not expose a Patch event/i);
  assert.throws(() => ensureDesignerEventHandler('window "X":\n  imagelist as images size 16, 16:\n', 'images', 'imagelist'), /does not expose a Patch event/i);
});

test('searchable Component Palette filters labels types and categories without a second component model', () => {
  assert.equal(DESIGNER_TOOL_CATALOG.length, 18);
  assert.deepEqual(filterDesignerTools('tree').map(tool => tool.type), ['tree']);
  assert.deepEqual(filterDesignerTools('choice').map(tool => tool.type), ['radio', 'combo', 'listbox', 'slider']);
  assert.deepEqual(filterDesignerTools('box').map(tool => tool.type), ['checkbox', 'combo', 'listbox', 'paintbox']);
  assert.deepEqual(filterDesignerTools('container').map(tool => tool.type), ['tabs', 'panel']);
  assert.deepEqual(filterDesignerTools('panel').map(tool => tool.type), ['panel']);
  assert.deepEqual(filterDesignerTools('graphics').map(tool => tool.type), ['picture', 'shape', 'paintbox']);
  assert.deepEqual(filterDesignerTools('picture').map(tool => tool.type), ['picture']);
  assert.deepEqual(filterDesignerTools('shape').map(tool => tool.type), ['shape']);
  assert.deepEqual(filterDesignerTools('paint').map(tool => tool.type), ['paintbox']);
  assert.deepEqual(filterDesignerTools('chrome').map(tool => tool.type), ['statusbar']);
  assert.deepEqual(filterDesignerTools('status').map(tool => tool.type), ['statusbar']);
  assert.deepEqual(filterDesignerTools('nonvisual').map(tool => tool.type), ['timer', 'imagelist']);
  assert.deepEqual(filterDesignerTools('timer').map(tool => tool.type), ['timer']);
  assert.deepEqual(filterDesignerTools('image').map(tool => tool.type), ['imagelist']);
  assert.equal(filterDesignerTools('does-not-exist').length, 0);
  const groups = groupedDesignerTools(filterDesignerTools('data'));
  assert.deepEqual(groups.map(group => group.group), ['Data']);
  assert.deepEqual(groups[0].tools.map(tool => tool.type), ['table', 'tree']);
});

test('Focus Order Stage 1 derives focusable named controls from visible source order', () => {
  const source = `window "Demo" as main size 640, 420:\n  text "Heading" at 24, 20 size 200, 30\n  input name at 24, 64 size 220, 36\n  button "Save" as save_button at 24, 112 size 120, 36\n  table "A" as rows at 24, 164 size 300, 120:\n    row "1"\n`;
  const order = listDesignerFocusOrder(source, 0);
  assert.deepEqual(order.map(item => item.id), ['name', 'save_button', 'rows']);
  assert.deepEqual(order.map(item => item.focusIndex), [0, 1, 2]);
  assert.deepEqual(order.map(item => item.type), ['input', 'button', 'table']);
});

test('Focus Order earlier and later cross intervening non-focusable source blocks', () => {
  const source = `window "Demo" as main size 640, 420:\n  input first at 24, 24 size 200, 36\n  text "Decorative" at 24, 70 size 180, 30\n  button "Second" as second at 24, 112 size 120, 36\n  text "More decoration" at 24, 160 size 180, 30\n  input third at 24, 204 size 200, 36\n`;
  const initial = listDesignerFocusOrder(source, 0);
  assert.deepEqual(initial.map(item => item.id), ['first', 'second', 'third']);

  const second = initial.find(item => item.id === 'second');
  const earlier = reorderDesignerFocusOrder(source, second, 'earlier');
  assert.equal(earlier.moved, true);
  assert.deepEqual(listDesignerFocusOrder(earlier.source, 0).map(item => item.id), ['second', 'first', 'third']);

  const movedSecond = listDesignerFocusOrder(earlier.source, 0).find(item => item.id === 'second');
  const later = reorderDesignerFocusOrder(earlier.source, movedSecond, 'later');
  assert.equal(later.moved, true);
  assert.deepEqual(listDesignerFocusOrder(later.source, 0).map(item => item.id), ['first', 'second', 'third']);
});

test('RAD Object Inspector Component Palette Focus Order and R1 components are packaged into the Studio offline graph', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const eventInspector = fs.readFileSync('web/designer-event-inspector.js', 'utf8');
  const focusOrder = fs.readFileSync('web/designer-focus-order.js', 'utf8');
  const toolbox = fs.readFileSync('web/designer-toolbox.js', 'utf8');
  const statusbar = fs.readFileSync('web/designer-statusbar.js', 'utf8');
  const paintbox = fs.readFileSync('web/designer-paintbox.js', 'utf8');
  const imagelist = fs.readFileSync('web/designer-imagelist.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-event-inspector\.js'/);
  assert.match(workspace, /import '\.\/designer-focus-order\.js'/);
  assert.match(workspace, /import '\.\/designer-statusbar\.js'/);
  assert.match(eventInspector, /designerPropertiesTab/);
  assert.match(eventInspector, /designerEventsTab/);
  assert.match(eventInspector, /designerObjectSelect/);
  assert.match(eventInspector, /Create handler/);
  assert.match(eventInspector, /paintbox: Object\.freeze\(\{ event: 'paint', label: 'OnPaint'/);
  assert.match(eventInspector, /draw clear transparent/);
  assert.match(eventInspector, /dblclick/);
  assert.match(focusOrder, /Focus Order · Stage 1/);
  assert.match(focusOrder, /Independent Delphi-style TabOrder metadata is a later contract/);
  assert.match(focusOrder, /reorderDesignerFocusOrder/);
  assert.match(toolbox, /designer-component-palette/);
  assert.match(toolbox, /designerInspectorPictureSource/);
  assert.match(toolbox, /designerInspectorPictureFit/);
  assert.match(toolbox, /designerInspectorPictureDescription/);
  assert.match(toolbox, /designerInspectorButtonImage/);
  assert.match(buildSite, /'button-image\.js'/);
  assert.match(sw, /'\.\.\/src\/button-image\.js'/);
  assert.match(toolbox, /import '\.\/designer-imagelist\.js'/);
  assert.match(statusbar, /import '\.\/designer-paintbox\.js'/);
  assert.doesNotMatch(statusbar, /import '\.\/designer-imagelist\.js'/);
  assert.match(statusbar, /StatusBar/);
  assert.match(paintbox, /patch-paintbox-designer-control/);
  assert.match(imagelist, /designerInspectorImageListField/);
  assert.match(imagelist, /import\('\.\/resource-manager\.js'\)/);
  assert.match(imagelist, /patchImagelistHidden/);
  assert.match(buildSite, /'component-registry\.js'/);
  assert.match(buildSite, /'imagelist-control\.js'/);
  assert.match(buildSite, /'button-image\.js'/);
  assert.match(buildSite, /'designer-toolbox\.js'/);
  assert.match(buildSite, /'designer-paintbox\.js'/);
  assert.match(buildSite, /'designer-imagelist\.js'/);
  assert.match(buildSite, /'designer-imagelist\.css'/);
  assert.match(sw, /'\.\.\/src\/component-registry\.js'/);
  assert.match(sw, /'\.\.\/src\/imagelist-control\.js'/);
  assert.match(sw, /'\.\/designer-toolbox\.js'/);
  assert.match(sw, /'\.\/designer-paintbox\.js'/);
  assert.match(sw, /'\.\/designer-imagelist\.js'/);
  assert.match(sw, /'\.\/designer-imagelist\.css'/);
});