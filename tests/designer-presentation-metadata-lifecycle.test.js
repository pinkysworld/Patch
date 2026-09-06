import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { listDesignerControls, removeDesignerControl } from '../src/designer.js';
import {
  readWindowDesignerLock,
  readWindowLayoutPolicy,
  readWindowTabOrder
} from '../src/window-layout-policy.js';
import {
  copyDesignerControlClipboard,
  pasteDesignerControlClipboard
} from '../web/designer-control-clipboard-model.js';
import { duplicateDesignerControl } from '../web/designer-control-duplicate-model.js';

function control(source, type, id = null) {
  const found = listDesignerControls(source).find(item => item.type === type && (id === null || item.id === id));
  assert.ok(found, `missing ${type}${id ? ` '${id}'` : ''}`);
  return found;
}

const checkedSource = `create list features = ["Designer", "Web"]

window "Metadata lifecycle" as main size 640, 420:
  # @layout anchor left right
  # @taborder 4
  # @locked
  # @listbox-mode checked
  listbox "Designer", "Web", "Offline" as features at 24, 64 size 280, 140

when features changed:
  change features:
    set = value
`;

test('CheckedListBox metadata remains transparent to layout, TabOrder and Locked readers', () => {
  const selected = control(checkedSource, 'listbox', 'features');
  assert.deepEqual(readWindowLayoutPolicy(checkedSource, selected.line), { kind: 'anchor', edges: ['left', 'right'] });
  assert.equal(readWindowTabOrder(checkedSource, selected.line), 4);
  assert.equal(readWindowDesignerLock(checkedSource, selected.line), true);
  const compiled = compile(checkedSource);
  const listbox = compiled.ast.find(node => node.kind === 'window').body.find(node => node.control === 'listbox');
  assert.equal(listbox.listboxPresentation, 'checked');
  assert.deepEqual(listbox.layoutPolicy, { kind: 'anchor', edges: ['left', 'right'] });
  assert.equal(listbox.tabOrder, 4);
});

test('Designer delete removes the complete CheckedListBox metadata block without orphan directives', () => {
  const next = removeDesignerControl(checkedSource, control(checkedSource, 'listbox', 'features'));
  assert.doesNotMatch(next, /@layout|@taborder|@locked|@listbox-mode/);
  assert.doesNotMatch(next, /listbox .* as features/);
  assert.doesNotMatch(next, /when features changed/);
  assert.match(next, /create list features = \["Designer", "Web"\]/);
  assert.doesNotThrow(() => compile(next));
});

test('CheckedListBox cut-style clipboard round-trip preserves presentation metadata and backing list state', () => {
  const selected = control(checkedSource, 'listbox', 'features');
  const clipboard = copyDesignerControlClipboard(checkedSource, selected);
  assert.ok(clipboard.lines.includes('# @listbox-mode checked'));
  assert.ok(clipboard.lines.includes('# @layout anchor left right'));
  assert.ok(clipboard.lines.includes('# @taborder 4'));
  assert.ok(clipboard.lines.includes('# @locked'));

  const cutSource = removeDesignerControl(checkedSource, selected);
  const pasted = pasteDesignerControlClipboard(cutSource, clipboard, { windowIndex: 0, offset: false });
  assert.match(pasted.source, /# @listbox-mode checked\n  listbox .* as features/);
  assert.match(pasted.source, /create list features = \["Designer", "Web"\]/);
  assert.doesNotThrow(() => compile(pasted.source));
});

test('Designer duplicate keeps CheckedListBox metadata, allocates TabOrder and creates explicit backing list state', () => {
  const duplicated = duplicateDesignerControl(checkedSource, control(checkedSource, 'listbox', 'features'), { offset: false });
  assert.deepEqual(duplicated.idMap, { features: 'listbox_1' });
  assert.match(duplicated.source, /create list features = \["Designer", "Web"\]\ncreate list listbox_1 = \["Designer", "Web"\]/);
  assert.match(duplicated.source, /# @listbox-mode checked\n  listbox .* as listbox_1/);
  assert.match(duplicated.source, /when listbox_1 changed:/);
  const original = control(duplicated.source, 'listbox', 'features');
  const copy = control(duplicated.source, 'listbox', 'listbox_1');
  assert.equal(readWindowTabOrder(duplicated.source, original.line), 4);
  assert.equal(readWindowTabOrder(duplicated.source, copy.line), 0);
  assert.doesNotThrow(() => compile(duplicated.source));
});

test('PasswordEdit and MaskedEdit metadata are deleted with their Input instead of becoming orphan comments', () => {
  const passwordSource = `create text secret = ""
window "Password" as main size 420, 260:
  # @layout anchor left right
  # @input-mode password
  input secret at 24, 40 size 220, 36
`;
  const withoutPassword = removeDesignerControl(passwordSource, control(passwordSource, 'input', 'secret'));
  assert.doesNotMatch(withoutPassword, /@layout|@input-mode/);
  assert.doesNotThrow(() => compile(withoutPassword));

  const maskedSource = `create text phone = ""
window "Mask" as main size 420, 260:
  # @locked
  # @input-mask "000-000"
  input phone at 24, 40 size 220, 36
`;
  const withoutMask = removeDesignerControl(maskedSource, control(maskedSource, 'input', 'phone'));
  assert.doesNotMatch(withoutMask, /@locked|@input-mask/);
  assert.doesNotThrow(() => compile(withoutMask));
});
