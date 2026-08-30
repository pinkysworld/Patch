import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';
import { duplicateDesignerForm } from '../web/designer-form-duplicate-model.js';
import { listDesignerUiNamespace } from '../web/designer-ui-namespace.js';

test('control duplication reserves MenuItem and result-dialog names from the global UI namespace', () => {
  const source = `window "Main" as main:\n  menu "File":\n    item "Existing" as button_1\n  button "Copy" as copy\n\nconfirm "Question", "Continue?" as button_2\n`;
  const duplicated = duplicateDesignerControl(source, { windowIndex: 0, controlIndex: 0 }, { offset: false });

  assert.equal(duplicated.idMap.copy, 'button_3');
  assert.doesNotThrow(() => parse(duplicated.source));
  const ids = listDesignerUiNamespace(duplicated.source).map(record => record.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('button_1'));
  assert.ok(ids.includes('button_2'));
  assert.ok(ids.includes('button_3'));
});

test('Form duplication renames MenuItems and nested Panel controls through the same namespace', () => {
  const source = `window "Main" as main:\n  menu "File":\n    item "Open" as open_item\n  panel as tools:\n    button "Go" as go\n\nwhen open_item clicked:\n  dialog "Menu", "Open"\n\nwhen go clicked:\n  dialog "Panel", "Go"\n\nconfirm "Reserved", "One" as menu_item_1\nconfirm "Reserved", "Two" as panel_1\nconfirm "Reserved", "Three" as button_1\n`;

  const duplicated = duplicateDesignerForm(source, 0);
  assert.equal(duplicated.controlIdMap.open_item, 'menu_item_2');
  assert.equal(duplicated.controlIdMap.tools, 'panel_2');
  assert.equal(duplicated.controlIdMap.go, 'button_2');
  assert.match(duplicated.source, /when menu_item_2 clicked:/);
  assert.match(duplicated.source, /when button_2 clicked:/);
  assert.doesNotThrow(() => parse(duplicated.source));

  const ids = listDesignerUiNamespace(duplicated.source).map(record => record.id);
  assert.equal(new Set(ids).size, ids.length);
});
