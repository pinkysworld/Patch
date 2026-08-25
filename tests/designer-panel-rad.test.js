import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import {
  addDesignerPanelChild,
  duplicateDesignerPanelChild,
  listDesignerPanels,
  moveDesignerPanelChild,
  removeDesignerPanelChild,
  updateDesignerPanelChild
} from '../src/designer-panel.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';
import { DESIGNER_TOOL_CATALOG, filterDesignerTools } from '../web/designer-toolbox.js';
import { panelPreviewLabel } from '../web/designer-panel.js';

const source = `window "Panel demo" as main size 640, 420:\n  panel as tools at 24, 24 size 300, 180:\n    text "Tools"\n    button "Run" as run_button\n    input query\n    slider 0..10 as level step 1\n\nwhen run_button clicked:\n  show "run"\n\nwhen query changed:\n  show value\n\nwhen level changed:\n  show value\n`;

test('Panel RAD model reads existing Panel Stage 1 source and flow children', () => {
  const panels = listDesignerPanels(source, 0);
  assert.equal(panels.length, 1);
  assert.equal(panels[0].id, 'tools');
  assert.deepEqual(panels[0].children.map(child => child.type), ['text', 'button', 'input', 'slider']);
  assert.deepEqual(panels[0].children.map(child => child.id), [null, 'run_button', 'query', 'level']);
  assert.equal(panels[0].x, 24);
  assert.equal(panels[0].width, 300);
  assert.doesNotThrow(() => parse(source));
});

test('Component Palette adds a parseable source-backed Panel with starter children', () => {
  const base = `window "Demo" as main size 520, 300:\n  text "Ready" at 24, 24 size 180, 30\n`;
  const next = addDesignerControl(base, 'panel', { windowIndex: 0 });
  const panel = listDesignerControls(next).find(control => control.type === 'panel');
  assert.ok(panel);
  assert.match(next, /panel as panel_1 at \d+, \d+ size 280, 160:/);
  assert.match(next, /\n    text "Panel"\n    button "Action" as button_1/);
  assert.doesNotThrow(() => parse(next));
  const compiled = compile(next, { name: 'PanelDesignerAdd', kind: 'window' });
  assert.doesNotThrow(() => validateWindowRuntimeSupport(compiled, { allowSlider: true }));
});

test('Panel header remains an ordinary movable and resizable Designer control', () => {
  const panel = listDesignerControls(source).find(control => control.type === 'panel');
  const next = updateDesignerControl(source, panel, { id: 'tools_panel', x: 40, y: 48, width: 340, height: 210 });
  assert.match(next, /panel as tools_panel at 40, 48 size 340, 210:/);
  assert.match(next, /button "Run" as run_button/);
  assert.doesNotThrow(() => parse(next));
});

test('Panel child editor adds, edits, moves and removes ordinary indented Patch controls', () => {
  const panel = listDesignerPanels(source, 0)[0];
  const added = addDesignerPanelChild(source, panel, 'combo');
  assert.equal(added.child.type, 'combo');
  assert.match(added.source, /combo "Option 1", "Option 2", "Option 3" as panel_combo/);

  const edited = updateDesignerPanelChild(added.source, added.child, {
    id: 'mode',
    options: ['"Fast"', '"Safe"']
  });
  assert.match(edited.source, /combo "Fast", "Safe" as mode/);
  const updatedPanel = listDesignerPanels(edited.source, 0)[0];
  const mode = updatedPanel.children.find(child => child.id === 'mode');
  const moved = moveDesignerPanelChild(edited.source, mode, 'earlier');
  assert.equal(moved.moved, true);
  assert.doesNotThrow(() => parse(moved.source));

  const movedPanel = listDesignerPanels(moved.source, 0)[0];
  const movedMode = movedPanel.children.find(child => child.id === 'mode');
  const removed = removeDesignerPanelChild(moved.source, movedMode);
  assert.doesNotMatch(removed, /as mode\b/);
  assert.doesNotThrow(() => parse(removed));
});

test('renaming and deleting Panel children keeps matching event handlers source-correct', () => {
  const panel = listDesignerPanels(source, 0)[0];
  const run = panel.children.find(child => child.id === 'run_button');
  const renamed = updateDesignerPanelChild(source, run, { id: 'execute_button', textExpr: '"Execute"' });
  assert.match(renamed.source, /button "Execute" as execute_button/);
  assert.match(renamed.source, /when execute_button clicked:/);
  assert.doesNotMatch(renamed.source, /when run_button clicked:/);

  const nextPanel = listDesignerPanels(renamed.source, 0)[0];
  const execute = nextPanel.children.find(child => child.id === 'execute_button');
  const removed = removeDesignerPanelChild(renamed.source, execute);
  assert.doesNotMatch(removed, /execute_button/);
  assert.doesNotThrow(() => parse(removed));
});

test('duplicating a Panel child gives it a fresh id and copies its source-visible handler', () => {
  const panel = listDesignerPanels(source, 0)[0];
  const run = panel.children.find(child => child.id === 'run_button');
  const result = duplicateDesignerPanelChild(source, run);
  assert.ok(result.child.id);
  assert.notEqual(result.child.id, 'run_button');
  assert.match(result.source, new RegExp(`when ${result.child.id} clicked:`));
  assert.match(result.source, /when run_button clicked:/);
  assert.doesNotThrow(() => parse(result.source));
});

test('generic RAD Duplicate Control recursively remaps Panel and child ids plus handlers', () => {
  const panel = listDesignerControls(source).find(control => control.type === 'panel');
  const duplicated = duplicateDesignerControl(source, panel, { offset: false });
  assert.ok(duplicated.idMap.tools);
  assert.ok(duplicated.idMap.run_button);
  assert.ok(duplicated.idMap.query);
  assert.ok(duplicated.idMap.level);
  for (const oldId of ['tools', 'run_button', 'query', 'level']) {
    assert.notEqual(duplicated.idMap[oldId], oldId);
  }
  assert.match(duplicated.source, new RegExp(`when ${duplicated.idMap.run_button} clicked:`));
  assert.match(duplicated.source, new RegExp(`when ${duplicated.idMap.query} changed:`));
  assert.match(duplicated.source, new RegExp(`when ${duplicated.idMap.level} changed:`));
  assert.doesNotThrow(() => parse(duplicated.source));
  const compiled = compile(duplicated.source, { name: 'PanelDuplicate', kind: 'window' });
  assert.doesNotThrow(() => validateWindowRuntimeSupport(compiled, { allowSlider: true }));
});

test('deleting a whole Panel removes orphan handlers belonging to nested children', () => {
  const panel = listDesignerControls(source).find(control => control.type === 'panel');
  const removed = removeDesignerControl(source, panel);
  assert.doesNotMatch(removed, /panel as tools/);
  assert.doesNotMatch(removed, /when run_button clicked:/);
  assert.doesNotMatch(removed, /when query changed:/);
  assert.doesNotMatch(removed, /when level changed:/);
  assert.doesNotThrow(() => parse(removed));
});

test('Panel appears in the searchable Containers palette and has compact preview labels', () => {
  const panelTool = DESIGNER_TOOL_CATALOG.find(tool => tool.type === 'panel');
  assert.deepEqual(panelTool, { group: 'Containers', type: 'panel', buttonId: 'addPanel', label: 'Panel' });
  assert.deepEqual(filterDesignerTools('panel').map(tool => tool.type), ['panel']);
  assert.equal(panelPreviewLabel({ type: 'button', id: 'go', textExpr: '"Go"' }), 'Go');
  assert.equal(panelPreviewLabel({ type: 'slider', id: 'level', min: 0, max: 10 }), 'level 0..10');
});

test('Panel RAD ships in the content-addressed Studio and offline PWA graph', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const browser = fs.readFileSync('web/designer-panel.js', 'utf8');
  const css = fs.readFileSync('web/designer-panel.css', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-panel\.js'/);
  assert.match(browser, /Panel children/);
  assert.match(browser, /Panel Stage 1 uses source-backed flow layout/);
  assert.match(css, /patch-panel-flow/);
  assert.match(buildSite, /designer-panel\.js/);
  assert.match(buildSite, /designer-panel\.css/);
  assert.match(buildSite, /designer-panel\.js','designer-data/);
  assert.match(sw, /designer-panel\.js/);
  assert.match(sw, /designer-panel\.css/);
  assert.match(sw, /src\/designer-panel\.js/);
});
