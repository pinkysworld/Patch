import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATCH_DESIGNER_UI_NAMESPACE_VERSION,
  describeDesignerUiId,
  designerUiIdCollision,
  listDesignerUiNamespace
} from '../web/designer-ui-namespace.js';

const source = `window "Namespace" as main size 700, 460:
  button "Save" as save_button at 24, 24 size 120, 36
  panel as tools at 24, 80 size 300, 100:
    text "Tools"
    button "Run" as panel_run
  tabs as workspace at 350, 80 size 300, 220:
    tab "General":
      input tab_name
    tab "Advanced":
      checkbox "Enabled" as tab_enabled
  menu "File":
    item "Open" as open_item
    item "Reset" as reset_item

when save_button clicked:
  confirm "Reset?", "Reset the form?" as reset_confirm

when open_item clicked:
  open file "Open Patch file" as open_result

when reset_item clicked:
  save file "Save Patch file" as save_result
`;

test('Designer UI namespace mirrors the application-wide Window runtime id contract', () => {
  assert.equal(PATCH_DESIGNER_UI_NAMESPACE_VERSION, '0.1');
  const entries = listDesignerUiNamespace(source);
  assert.deepEqual(entries.map(entry => entry.id), [
    'save_button',
    'tools',
    'panel_run',
    'workspace',
    'tab_name',
    'tab_enabled',
    'open_item',
    'reset_item',
    'reset_confirm',
    'open_result',
    'save_result'
  ]);
  assert.equal(entries.find(entry => entry.id === 'panel_run')?.type, 'button');
  assert.equal(entries.find(entry => entry.id === 'workspace')?.type, 'tabs');
  assert.equal(entries.find(entry => entry.id === 'open_item')?.kind, 'menuItem');
  assert.equal(entries.find(entry => entry.id === 'reset_confirm')?.type, 'confirmDialog');
  assert.equal(entries.find(entry => entry.id === 'open_result')?.type, 'openFileDialog');
  assert.equal(entries.find(entry => entry.id === 'save_result')?.type, 'saveFileDialog');
});

test('Designer rename guard catches nested controls, menu items and nested result dialogs', () => {
  assert.equal(designerUiIdCollision(source, 'save_button', 'save_button'), null);
  assert.equal(designerUiIdCollision(source, 'panel_run', 'save_button')?.kind, 'control');
  assert.equal(designerUiIdCollision(source, 'tab_name', 'save_button')?.type, 'input');
  assert.equal(designerUiIdCollision(source, 'open_item', 'save_button')?.kind, 'menuItem');
  assert.equal(designerUiIdCollision(source, 'reset_confirm', 'save_button')?.kind, 'resultDialog');
  assert.equal(designerUiIdCollision(source, 'open_result', 'save_button')?.type, 'openFileDialog');
  assert.equal(designerUiIdCollision(source, 'fresh_name', 'save_button'), null);
});

test('Designer UI namespace diagnostics name conflicting object types clearly', () => {
  const entries = listDesignerUiNamespace(source);
  const byId = id => entries.find(entry => entry.id === id);
  assert.equal(describeDesignerUiId(byId('tools')), 'Panel');
  assert.equal(describeDesignerUiId(byId('workspace')), 'Tabs');
  assert.equal(describeDesignerUiId(byId('open_item')), 'MenuItem');
  assert.equal(describeDesignerUiId(byId('reset_confirm')), 'Confirm dialog');
  assert.equal(describeDesignerUiId(byId('open_result')), 'Open-file dialog');
  assert.equal(describeDesignerUiId(byId('save_result')), 'Save-file dialog');
});

test('Designer UI namespace guard is packaged into Studio and offline PWA graphs', () => {
  const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const sw = fs.readFileSync('web/sw.js', 'utf8');
  const guard = fs.readFileSync('web/designer-ui-namespace.js', 'utf8');
  assert.match(workspace, /import '\.\/designer-ui-namespace\.js'/);
  assert.match(buildSite, /designer-ui-namespace\.js/);
  assert.match(sw, /designer-ui-namespace\.js/);
  assert.match(guard, /Window runtime validator's traversal boundary/);
  assert.doesNotMatch(guard, /localStorage|sessionStorage/);
});
