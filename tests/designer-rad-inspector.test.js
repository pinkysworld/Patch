import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  designerEventSpec,
  ensureDesignerEventHandler,
  findDesignerEventHandler
} from '../web/designer-event-inspector.js';
import { listDesignerFocusOrder } from '../web/designer-focus-order.js';
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
});

test('searchable Component Palette filters labels types and categories without a second component model', () => {
  assert.equal(DESIGNER_TOOL_CATALOG.length, 11);
  assert.deepEqual(filterDesignerTools('tree').map(tool => tool.type), ['tree']);
  assert.deepEqual(filterDesignerTools('choice').map(tool => tool.type), ['radio', 'combo', 'listbox', 'slider']);
  assert.deepEqual(filterDesignerTools('box').map(tool => tool.type), ['checkbox', 'combo', 'listbox']);
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

test('RAD Object Inspector Component Palette and Focus Order are packaged into the Studio offline graph', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const eventInspector = fs.readFileSync('web/designer-event-inspector.js', 'utf8');
  const focusOrder = fs.readFileSync('web/designer-focus-order.js', 'utf8');
  const toolbox = fs.readFileSync('web/designer-toolbox.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-event-inspector\.js'/);
  assert.match(workspace, /import '\.\/designer-focus-order\.js'/);
  assert.match(eventInspector, /designerPropertiesTab/);
  assert.match(eventInspector, /designerEventsTab/);
  assert.match(eventInspector, /designerObjectSelect/);
  assert.match(eventInspector, /Create handler/);
  assert.match(eventInspector, /dblclick/);
  assert.match(focusOrder, /Focus Order · Stage 1/);
  assert.match(focusOrder, /Independent Delphi-style TabOrder metadata is a later contract/);
  assert.match(toolbox, /designerComponentSearch/);
  assert.match(toolbox, /filterDesignerTools/);
  assert.match(buildSite, /designer-event-inspector\.js/);
  assert.match(buildSite, /designer-focus-order\.js/);
  assert.match(sw, /designer-event-inspector\.js/);
  assert.match(sw, /designer-focus-order\.js/);
});
