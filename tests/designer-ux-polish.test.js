import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  formatDesignerFormSummary,
  formatDesignerSelectionSummary
} from '../web/designer-ux.js';

test('Designer selection context summarizes type, id, Form and multi-selection', () => {
  assert.equal(formatDesignerSelectionSummary(null), 'No control selected');
  assert.equal(formatDesignerSelectionSummary({ type: 'button', id: 'save', windowIndex: 0 }), 'Button · save · Form 1');
  assert.equal(formatDesignerSelectionSummary({ type: 'tree', id: 'files', windowIndex: 1 }, 3), 'TreeView · files · Form 2 · 3 selected');
  assert.equal(formatDesignerSelectionSummary({ type: 'text', windowIndex: 2 }), 'Text · Form 3');
});

test('Designer Form settings summary keeps source-backed dimensions visible', () => {
  assert.equal(formatDesignerFormSummary(null), 'Form settings');
  assert.equal(formatDesignerFormSummary({ width: 720, height: 480 }), 'Form settings · 720×480');
  assert.equal(formatDesignerFormSummary({ width: null, height: null }), 'Form settings · 640×420');
});

test('Designer UX keeps common actions source-backed and keyboard accessible', () => {
  const source = fs.readFileSync('web/designer-ux.js', 'utf8');
  assert.match(source, /DESIGNER_SELECTION_EVENT/);
  assert.match(source, /clearDesignerSelection/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /Focus selected/);
  assert.match(source, /Focus form/);
  assert.match(source, /Property changes ready to apply/);
  assert.match(source, /Source-backed · up to date/);
  assert.match(source, /designer-form-settings/);
  assert.match(source, /formSettingsOpen/);
});

test('public Studio and offline PWA package the Designer UX module and stylesheet', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-ux\.js'/);
  assert.match(buildSite, /'designer-ux\.css'/);
  assert.match(buildSite, /'designer-ux\.js'/);
  assert.match(sw, /'\.\/designer-ux\.css'/);
  assert.match(sw, /'\.\/designer-ux\.js'/);
});
