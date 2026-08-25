import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { PatchInterpreter } from '../src/interpreter.js';
import {
  DESIGNER_PANEL_CHILD_TYPES,
  addDesignerPanel,
  addDesignerPanelChild,
  listDesignerPanels,
  moveDesignerPanelChild,
  removeDesignerPanel,
  removeDesignerPanelChild,
  updateDesignerPanel
} from '../src/designer-panel.js';

test('Panel interpreter UI model preserves nested flow controls', () => {
  const source = `create text name = "Ada"\nwindow "Panel" as main size 640, 420:\n  panel as card at 24, 24 size 320, 180:\n    text "Customer"\n    input name\n    button "Save" as save_button\n`;
  const result = new PatchInterpreter().run(source);
  assert.equal(result.ui[0].controls[0].type, 'panel');
  assert.equal(result.ui[0].controls[0].id, 'card');
  assert.deepEqual(result.ui[0].controls[0].children.map(control => control.type), ['text', 'input', 'button']);
  assert.equal(result.ui[0].controls[0].children[1].value, 'Ada');
});

test('Panel Designer adds a positioned source-backed container before bottom StatusBar chrome', () => {
  const source = `window "Demo" as main size 640, 420:\n  button "Go" as go at 24, 24 size 120, 36\n  # @layout dock bottom\n  statusbar "Ready" as statusbar_1 at 0, 392 size 640, 28\n`;
  const added = addDesignerPanel(source, { windowIndex: 0 });
  parse(added.source);
  assert.equal(added.panel.id, 'panel_1');
  assert.equal(added.panel.width, 280);
  assert.equal(added.panel.height, 160);
  assert.ok(added.source.indexOf('panel as panel_1') < added.source.indexOf('# @layout dock bottom'));
  assert.ok(added.source.indexOf('# @layout dock bottom') < added.source.indexOf('statusbar "Ready"'));
  assert.deepEqual(added.panel.children, []);
});

test('Panel outer id and geometry remain ordinary source-backed properties', () => {
  const added = addDesignerPanel('window "Demo" as main size 640, 420:\n');
  const next = updateDesignerPanel(added.source, added.panel, {
    id: 'details_panel', x: 48, y: 72, width: 360, height: 220
  });
  parse(next);
  const panel = listDesignerPanels(next)[0];
  assert.deepEqual(
    { id: panel.id, x: panel.x, y: panel.y, width: panel.width, height: panel.height },
    { id: 'details_panel', x: 48, y: 72, width: 360, height: 220 }
  );
  assert.match(next, /panel as details_panel at 48, 72 size 360, 220:/);
});

test('Panel Stage 1 adds every supported child as flow-layout Patch source', () => {
  let state = addDesignerPanel('window "Demo" as main size 640, 420:\n');
  for (const type of DESIGNER_PANEL_CHILD_TYPES) {
    state = addDesignerPanelChild(state.source, state.panel, type);
  }
  parse(state.source);
  const panel = state.panel;
  assert.deepEqual(panel.children.map(child => child.type), DESIGNER_PANEL_CHILD_TYPES);
  const block = state.source.slice(state.source.indexOf('panel as '));
  assert.doesNotMatch(block.split('\n').slice(1).join('\n'), /\sat\s+\d+\s*,/);
  const ids = panel.children.map(child => child.id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
});

test('Panel Stage 1 rejects unsupported nested container and asset controls', () => {
  const added = addDesignerPanel('window "Demo" as main size 640, 420:\n');
  for (const type of ['panel', 'tabs', 'table', 'tree', 'timer', 'statusbar', 'picture']) {
    assert.throws(() => addDesignerPanelChild(added.source, added.panel, type), /Panel Stage 1 cannot add/i);
  }
});

test('Panel child reorder is deterministic and stays parseable', () => {
  let state = addDesignerPanel('window "Demo" as main size 640, 420:\n');
  state = addDesignerPanelChild(state.source, state.panel, 'input');
  state = addDesignerPanelChild(state.source, state.panel, 'button');
  state = addDesignerPanelChild(state.source, state.panel, 'checkbox');
  const moved = moveDesignerPanelChild(state.source, state.panel, 2, 'earlier');
  assert.equal(moved.moved, true);
  assert.deepEqual(moved.panel.children.map(child => child.type), ['input', 'checkbox', 'button']);
  parse(moved.source);
  const boundary = moveDesignerPanelChild(moved.source, moved.panel, 0, 'earlier');
  assert.equal(boundary.moved, false);
  assert.equal(boundary.source, moved.source);
});

test('removing a Panel child removes its matching event handler only', () => {
  const source = `window "Demo" as main size 640, 420:\n  panel as card at 24, 24 size 280, 160:\n    button "Save" as save_button\n    input name\n\nwhen save_button clicked:\n  show "saved"\n\nwhen name changed:\n  show value\n`;
  const panel = listDesignerPanels(source)[0];
  const removed = removeDesignerPanelChild(source, panel, 0);
  parse(removed.source);
  assert.doesNotMatch(removed.source, /save_button/);
  assert.match(removed.source, /input name/);
  assert.match(removed.source, /when name changed:/);
});

test('removing a Panel removes the complete block and all child handlers', () => {
  const source = `window "Demo" as main size 640, 420:\n  # @layout anchor left top\n  panel as card at 24, 24 size 280, 160:\n    button "Save" as save_button\n    input name\n  button "Outside" as outside at 340, 24 size 120, 36\n\nwhen save_button clicked:\n  show "saved"\nwhen name changed:\n  show value\nwhen outside clicked:\n  show "outside"\n`;
  const panel = listDesignerPanels(source)[0];
  const next = removeDesignerPanel(source, panel);
  parse(next);
  assert.doesNotMatch(next, /panel as card/);
  assert.doesNotMatch(next, /# @layout anchor left top/);
  assert.doesNotMatch(next, /save_button|when name changed:/);
  assert.match(next, /button "Outside" as outside/);
  assert.match(next, /when outside clicked:/);
});

test('Panel ids remain unique across top-level and nested UI declarations', () => {
  const source = `window "Demo" as main size 640, 420:\n  button "Go" as duplicate_id at 24, 24 size 120, 36\n  panel as card at 24, 80 size 280, 160:\n    input nested_id\n`;
  const panel = listDesignerPanels(source)[0];
  assert.throws(() => updateDesignerPanel(source, panel, { id: 'duplicate_id' }), /already used/i);
  assert.throws(() => updateDesignerPanel(source, panel, { id: 'nested_id' }), /already used/i);
});
