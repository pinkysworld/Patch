import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  STUDIO_DESIGNER_INSPECTOR_STATE_VERSION,
  clearDesignerInspectorError,
  showDesignerInspectorError,
  syncDesignerInspectorState
} from '../web/designer-ux.js';

function createClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force) values.add(name);
      else values.delete(name);
    },
    contains(name) {
      return values.has(name);
    }
  };
}

function createInspectorDocument() {
  const apply = { disabled: false, title: '' };
  const state = { textContent: '', classList: createClassList() };
  const error = { textContent: '', hidden: true };
  const inspector = {
    querySelector(selector) {
      if (selector === '#designerInspectorApply') return apply;
      if (selector === '#designerInspectorState') return state;
      return null;
    }
  };
  const document = {
    querySelector(selector) {
      if (selector === '#designerInspector') return inspector;
      if (selector === '#designerInspectorApply') return apply;
      if (selector === '#designerInspectorState') return state;
      if (selector === '#designerInspectorError') return error;
      return null;
    }
  };
  return { document, apply, state, error };
}

test('shared Object Inspector contract owns dirty apply and state presentation', () => {
  assert.equal(STUDIO_DESIGNER_INSPECTOR_STATE_VERSION, '0.1');
  const fixture = createInspectorDocument();

  const dirty = syncDesignerInspectorState({ document: fixture.document, dirty: true });
  assert.deepEqual(dirty, { dirty: true, empty: false, apply: true, state: true });
  assert.equal(fixture.apply.disabled, false);
  assert.equal(fixture.apply.title, 'Apply these source-backed property changes');
  assert.equal(fixture.state.textContent, 'Property changes ready to apply.');
  assert.equal(fixture.state.classList.contains('is-dirty'), true);

  syncDesignerInspectorState({ document: fixture.document, dirty: false });
  assert.equal(fixture.apply.disabled, true);
  assert.equal(fixture.apply.title, 'No common property changes to apply');
  assert.equal(fixture.state.textContent, 'Source-backed · up to date.');
  assert.equal(fixture.state.classList.contains('is-dirty'), false);

  syncDesignerInspectorState({ document: fixture.document, dirty: true, empty: true });
  assert.equal(fixture.apply.disabled, true);
  assert.equal(fixture.state.textContent, '');
  assert.equal(fixture.state.classList.contains('is-dirty'), false);
});

test('shared Object Inspector contract supports adapter-specific messages', () => {
  const fixture = createInspectorDocument();
  syncDesignerInspectorState({
    document: fixture.document,
    dirty: true,
    dirtyText: 'StatusBar property changes ready to apply.',
    cleanText: 'Source-backed · dock bottom · up to date.',
    dirtyTitle: 'Apply StatusBar name/text to Patch source',
    cleanTitle: 'StatusBar properties are up to date'
  });
  assert.equal(fixture.apply.title, 'Apply StatusBar name/text to Patch source');
  assert.equal(fixture.state.textContent, 'StatusBar property changes ready to apply.');

  syncDesignerInspectorState({
    document: fixture.document,
    dirty: false,
    dirtyText: 'StatusBar property changes ready to apply.',
    cleanText: 'Source-backed · dock bottom · up to date.',
    dirtyTitle: 'Apply StatusBar name/text to Patch source',
    cleanTitle: 'StatusBar properties are up to date'
  });
  assert.equal(fixture.apply.title, 'StatusBar properties are up to date');
  assert.equal(fixture.state.textContent, 'Source-backed · dock bottom · up to date.');
});

test('shared Object Inspector error lifecycle is explicit and reusable', () => {
  const fixture = createInspectorDocument();
  assert.equal(showDesignerInspectorError(new Error('Invalid StatusBar id'), { document: fixture.document }), true);
  assert.equal(fixture.error.hidden, false);
  assert.equal(fixture.error.textContent, 'Invalid StatusBar id');

  assert.equal(clearDesignerInspectorError({ document: fixture.document }), true);
  assert.equal(fixture.error.hidden, true);
  assert.equal(fixture.error.textContent, '');
});

test('StatusBar is the first specialized adapter on the shared Inspector contract', () => {
  execFileSync(process.execPath, ['--check', 'web/designer-ux.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-statusbar.js'], { stdio: 'pipe' });
  const ux = fs.readFileSync('web/designer-ux.js', 'utf8');
  const statusbar = fs.readFileSync('web/designer-statusbar.js', 'utf8');

  assert.match(ux, /STUDIO_DESIGNER_INSPECTOR_STATE_VERSION/);
  assert.match(ux, /from '\.\/designer-selection\.js'/);
  assert.match(ux, /syncDesignerInspectorState\(\{ document: doc, inspector, dirty \}\)/);
  assert.match(statusbar, /syncDesignerInspectorState/);
  assert.match(statusbar, /showDesignerInspectorError/);
  assert.match(statusbar, /clearDesignerInspectorError/);
  assert.doesNotMatch(statusbar, /function showInspectorError/);
  assert.doesNotMatch(statusbar, /state\.classList\.toggle\('is-dirty', dirty\)/);
});

test('Panel and ImageList reuse the shared Inspector state and error lifecycle', () => {
  execFileSync(process.execPath, ['--check', 'web/designer-panel.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/designer-imagelist.js'], { stdio: 'pipe' });
  const panel = fs.readFileSync('web/designer-panel.js', 'utf8');
  const imagelist = fs.readFileSync('web/designer-imagelist.js', 'utf8');
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');

  assert.match(panel, /syncDesignerInspectorState/);
  assert.match(panel, /showDesignerInspectorError/);
  assert.match(panel, /clearDesignerInspectorError/);
  assert.match(panel, /Panel child property changes ready to apply/);
  assert.doesNotMatch(panel, /function showError/);

  assert.match(imagelist, /showDesignerInspectorError/);
  assert.match(imagelist, /clearDesignerInspectorError/);
  assert.doesNotMatch(imagelist, /function showError/);

  assert.ok(workspace.indexOf("import './designer-ux.js'") < workspace.indexOf("import './designer-panel.js'"));
  assert.ok(workspace.indexOf("import './designer-ux.js'") < workspace.indexOf("import './designer-toolbox.js'"));
});
