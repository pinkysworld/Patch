import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import {
  PATCH_DESIGNER_PANEL_MODEL_VERSION,
  listDesignerPanels,
  updateDesignerPanelChild
} from '../src/designer-panel.js';
import { buildCurrentNativeGuiIR } from '../src/native-current-contract.js';

const SOURCE = `window "Panel Stage 2" as main size 640, 420:
  panel as tools at 24, 24 size 360, 220:
    text "Legacy flow child"
    button "Run" as run_button at 18, 32 size 120, 36
    input query at 18, 84 size 220, 32
`;

test('Panel Stage 2 parser accepts panel-local at/size while legacy children remain flow', () => {
  const ast = parse(SOURCE);
  const panel = ast[0].body.find(node => node.kind === 'uiControl' && node.control === 'panel');
  assert.ok(panel);
  assert.equal(panel.body.length, 3);
  assert.equal(panel.body[0].layout, undefined);
  assert.deepEqual(panel.body[1].layout, { x: 18, y: 32, width: 120, height: 36 });
  assert.deepEqual(panel.body[2].layout, { x: 18, y: 84, width: 220, height: 32 });
});

test('Panel Designer model exposes and round-trips relative child geometry', () => {
  assert.equal(PATCH_DESIGNER_PANEL_MODEL_VERSION, '0.2');
  const panel = listDesignerPanels(SOURCE, 0)[0];
  assert.equal(panel.children[0].positioned, false);
  assert.equal(panel.children[1].positioned, true);
  assert.deepEqual(
    [panel.children[1].x, panel.children[1].y, panel.children[1].width, panel.children[1].height],
    [18, 32, 120, 36]
  );

  const changed = updateDesignerPanelChild(SOURCE, {
    windowIndex: 0,
    panelIndex: 0,
    childIndex: 1
  }, {
    x: 44,
    y: 56,
    width: 140,
    height: 40
  });
  assert.match(changed.source, /button "Run" as run_button at 44, 56 size 140, 40/);
  assert.deepEqual(
    [changed.child.x, changed.child.y, changed.child.width, changed.child.height],
    [44, 56, 140, 40]
  );
});

test('Panel Designer can move a positioned child back to legacy flow layout', () => {
  const changed = updateDesignerPanelChild(SOURCE, {
    windowIndex: 0,
    panelIndex: 0,
    childIndex: 1
  }, { positioned: false });
  assert.match(changed.source, /button "Run" as run_button\n/);
  assert.doesNotMatch(changed.source, /run_button at /);
  assert.equal(changed.child.positioned, false);
});

test('Current Ready native fails closed for Panel Stage 2 relative child layout', () => {
  const compiled = compile(SOURCE, { name: 'PanelStage2', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => buildCurrentNativeGuiIR(compiled),
    /Panel Stage 2 relative child layout.*not supported by Current Ready native 1\.10/i
  );
});

test('Current Ready native keeps legacy flow Panels accepted', () => {
  const compiled = compile(`window "Legacy Panel" as main:
  panel as tools:
    text "Flow"
    button "Run" as run_button
`, { name: 'LegacyPanel', kind: 'window', entry: 'main.patch' });
  assert.doesNotThrow(() => buildCurrentNativeGuiIR(compiled));
});
