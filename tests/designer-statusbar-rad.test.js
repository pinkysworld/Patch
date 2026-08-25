import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDesignerControl,
  listDesignerControls,
  removeDesignerControl,
  updateDesignerControl
} from '../src/designer.js';
import {
  applyWindowResizePolicy,
  readWindowLayoutPolicy
} from '../src/window-layout-policy.js';
import { buildStandaloneWebApp } from '../src/webapp.js';
import { listDesignerStatusBars, statusBarPreviewText } from '../web/designer-statusbar.js';

test('StatusBar RAD authoring creates one source-backed bottom-docked Form chrome control', () => {
  const source = `window "Demo" as main size 640, 420:\n  button "Save" as save at 24, 24 size 120, 36\n`;
  const next = addDesignerControl(source, 'statusbar', { windowIndex: 0 });
  assert.match(next, /  # @layout dock bottom\n  statusbar "Ready" as statusbar_1 at 0, 392 size 640, 28/);

  const bars = listDesignerStatusBars(next, 0);
  assert.equal(bars.length, 1);
  assert.deepEqual(
    { type: bars[0].type, id: bars[0].id, textExpr: bars[0].textExpr, x: bars[0].x, y: bars[0].y, width: bars[0].width, height: bars[0].height },
    { type: 'statusbar', id: 'statusbar_1', textExpr: '"Ready"', x: 0, y: 392, width: 640, height: 28 }
  );
  assert.deepEqual(readWindowLayoutPolicy(next, bars[0].line), { kind: 'dock', side: 'bottom' });
  assert.throws(() => addDesignerControl(next, 'statusbar', { windowIndex: 0 }), /already has a StatusBar/i);
});

test('StatusBar Object Inspector source mutation edits name/text while preserving dock geometry', () => {
  const source = addDesignerControl(`window "Demo" as main size 640, 420:\n`, 'statusbar');
  const bar = listDesignerControls(source).find(control => control.type === 'statusbar');
  const updated = updateDesignerControl(source, bar, { id: 'app_status', textExpr: '"Working"' });
  const next = listDesignerControls(updated).find(control => control.type === 'statusbar');

  assert.match(updated, /statusbar "Working" as app_status at 0, 392 size 640, 28/);
  assert.deepEqual(readWindowLayoutPolicy(updated, next.line), { kind: 'dock', side: 'bottom' });
  assert.equal(statusBarPreviewText(next), 'Working');
  assert.deepEqual(
    applyWindowResizePolicy(
      { x: next.x, y: next.y, width: next.width, height: next.height },
      { kind: 'dock', side: 'bottom' },
      { deltaWidth: 160, deltaHeight: 80, width: 800, height: 500 }
    ),
    { x: 0, y: 472, width: 800, height: 28 }
  );
});

test('removing a source-backed StatusBar also removes its layout directive', () => {
  const source = addDesignerControl(`window "Demo" as main size 640, 420:\n`, 'statusbar');
  const bar = listDesignerControls(source).find(control => control.type === 'statusbar');
  const removed = removeDesignerControl(source, bar);
  assert.doesNotMatch(removed, /statusbar/i);
  assert.doesNotMatch(removed, /@layout dock bottom/i);
  assert.equal(listDesignerStatusBars(removed).length, 0);
});

test('Standalone Window Web App renders StatusBar instead of silently dropping it', () => {
  const source = addDesignerControl(`window "Demo" as main size 640, 420:\n  text "Hello" at 24, 24 size 160, 30\n`, 'statusbar');
  const built = buildStandaloneWebApp(source, { name: 'StatusDemo', kind: 'window' });
  assert.equal(built.metadata.statusBarStage, 1);
  assert.equal(built.metadata.statusBarMode, 'source-backed-bottom-docked');
  assert.match(built.html, /control\?\.type==='statusbar'/);
  assert.match(built.html, /className='patch-statusbar'/);
  assert.match(built.html, /position:absolute!important/);
  assert.match(built.html, /bottom:0!important/);
});
