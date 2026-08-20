import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { listDesignerControls } from '../src/designer.js';
import { listDesignerTabPageControls } from '../src/designer-tabs-nested.js';
import {
  designerTabPageControlActionAvailability,
  duplicateDesignerTabPageControl,
  moveDesignerTabPageControl
} from '../web/designer-tabs-control-model.js';

const source = `window "Settings" as main size 640, 420:
  tabs as settings at 24, 64 size 500, 280:
    tab "General":
      button "Save" as save
      table "Name", "Value" as prefs:
        row "Theme", "System"
      tree as nav:
        node "Root"
          node "Child"
    tab "Advanced":
      text "Advanced"

when save clicked:
  show "saved"
`;

function tabs(text = source) {
  return listDesignerControls(text).find(control => control.type === 'tabs');
}

test('nested control reorder moves complete multi-line blocks and keeps source parseable', () => {
  const result = moveDesignerTabPageControl(source, tabs(), 0, 2, 'up');
  assert.equal(result.controlIndex, 1);
  assert.doesNotThrow(() => parse(result.source));
  const controls = listDesignerTabPageControls(result.source, tabs(result.source), 0);
  assert.deepEqual(controls.map(control => control.type), ['button', 'tree', 'table']);
  assert.equal(controls[1].treeNodes[0].children[0].labelExpr, '"Child"');
  assert.deepEqual(controls[2].rows, [['"Theme"', '"System"']]);
  assert.match(result.source, /tree as nav:\n        node "Root"\n          node "Child"\n      table "Name", "Value" as prefs:/);
});

test('nested control boundary moves are deterministic no-ops', () => {
  assert.equal(moveDesignerTabPageControl(source, tabs(), 0, 0, 'up').source, source);
  assert.equal(moveDesignerTabPageControl(source, tabs(), 0, 2, 'down').source, source);
  assert.deepEqual(designerTabPageControlActionAvailability(source, tabs(), 0, 0), {
    up: false,
    down: true,
    duplicate: true
  });
});

test('duplicating a named nested control assigns a globally unique id and duplicates its event handlers', () => {
  const result = duplicateDesignerTabPageControl(source, tabs(), 0, 0);
  assert.equal(result.controlIndex, 1);
  assert.equal(result.id, 'button_1');
  assert.doesNotThrow(() => parse(result.source));
  const controls = listDesignerTabPageControls(result.source, tabs(result.source), 0);
  assert.deepEqual(controls.slice(0, 2).map(control => control.id), ['save', 'button_1']);
  assert.match(result.source, /button "Save" as save\n      button "Save" as button_1/);
  assert.match(result.source, /when save clicked:\n  show "saved"/);
  assert.match(result.source, /when button_1 clicked:\n  show "saved"/);
});

test('duplicating Table and TreeView preserves their complete nested structures with fresh ids', () => {
  const tableCopy = duplicateDesignerTabPageControl(source, tabs(), 0, 1);
  assert.equal(tableCopy.id, 'table_1');
  assert.doesNotThrow(() => parse(tableCopy.source));
  let controls = listDesignerTabPageControls(tableCopy.source, tabs(tableCopy.source), 0);
  assert.deepEqual(controls[1].rows, [['"Theme"', '"System"']]);
  assert.deepEqual(controls[2].rows, [['"Theme"', '"System"']]);
  assert.equal(controls[2].id, 'table_1');

  const treeCopy = duplicateDesignerTabPageControl(source, tabs(), 0, 2);
  assert.equal(treeCopy.id, 'tree_1');
  assert.doesNotThrow(() => parse(treeCopy.source));
  controls = listDesignerTabPageControls(treeCopy.source, tabs(treeCopy.source), 0);
  assert.equal(controls[2].treeNodes[0].children[0].labelExpr, '"Child"');
  assert.equal(controls[3].treeNodes[0].children[0].labelExpr, '"Child"');
  assert.equal(controls[3].id, 'tree_1');
});

test('nested control actions fail closed for invalid selection and direction', () => {
  assert.throws(() => moveDesignerTabPageControl(source, tabs(), 0, 99, 'up'), /selection is invalid/);
  assert.throws(() => duplicateDesignerTabPageControl(source, tabs(), 99, 0), /Tab page selection is invalid/);
  assert.throws(() => moveDesignerTabPageControl(source, tabs(), 0, 0, 'left'), /direction must be 'up' or 'down'/);
});

test('Tabs page control action UI closes stale nested structure state and restores action focus after source rewrite', () => {
  const ui = fs.readFileSync('web/designer-tabs-control-actions.js', 'utf8');
  assert.match(ui, /data-tabs-page-control-action/);
  assert.match(ui, /closeOpenStructureEditor\(\)/);
  assert.match(ui, /\[data-tabs-close-structure\]/);
  assert.match(ui, /pendingFocus/);
  assert.match(ui, /update|setSource/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|Change History/);
});

test('public Studio and offline PWA package Tabs page control actions', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const build = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-tabs-control-actions\.js'/);
  assert.match(build, /designer-tabs-control-model\.js/);
  assert.match(build, /designer-tabs-control-actions\.js/);
  assert.match(sw, /'\.\/designer-tabs-control-model\.js'/);
  assert.match(sw, /'\.\/designer-tabs-control-actions\.js'/);
  execFileSync(process.execPath, ['--check', 'web/designer-tabs-control-model.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-tabs-control-actions.js'], { stdio: 'pipe' });
});
