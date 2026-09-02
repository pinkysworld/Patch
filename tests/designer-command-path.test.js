import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listDesignerControls } from '../src/designer.js';

test('shared Designer command executor owns delete duplicate reveal and clipboard semantics', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelector() { return null; },
    addEventListener() {}
  };
  try {
    const {
      DESIGNER_CONTROL_COMMANDS,
      executeDesignerControlCommand
    } = await import(`../web/designer-core-selection.js?command-path-test=${Date.now()}`);

    const source = `window "Demo" as main size 640, 420:\n  button "Save" as save at 24, 24 size 120, 36\n  input name at 24, 76 size 220, 36\n\nwhen save clicked:\n  show "saved"\n`;
    const selection = { windowIndex: 0, controlIndex: 0, adapter: 'core' };

    const reveal = executeDesignerControlCommand(source, selection, DESIGNER_CONTROL_COMMANDS.REVEAL_SOURCE);
    assert.equal(reveal.source, source);
    assert.equal(reveal.control.id, 'save');
    assert.equal(reveal.line, 2);

    const copy = executeDesignerControlCommand(source, selection, DESIGNER_CONTROL_COMMANDS.COPY);
    assert.equal(copy.source, source);
    assert.match(copy.clipboardText, /patch-designer-control-clipboard/);
    assert.equal(copy.nextControl.id, 'save');

    const cut = executeDesignerControlCommand(source, selection, DESIGNER_CONTROL_COMMANDS.CUT);
    assert.deepEqual(listDesignerControls(cut.source).map(control => control.id), ['name']);
    assert.match(cut.clipboardText, /patch-designer-control-clipboard/);
    assert.equal(cut.nextControl, null);

    const paste = executeDesignerControlCommand(
      source,
      null,
      DESIGNER_CONTROL_COMMANDS.PASTE,
      { clipboardText: copy.clipboardText, windowIndex: 0 }
    );
    const pastedControls = listDesignerControls(paste.source);
    assert.equal(pastedControls.length, 3);
    assert.ok(paste.nextControl);
    assert.notEqual(paste.nextControl.id, 'save');
    assert.equal(pastedControls.at(-1).id, paste.nextControl.id);

    const emptyFormSource = `window "Empty" as empty size 640, 420:\n`;
    const pasteIntoEmpty = executeDesignerControlCommand(
      emptyFormSource,
      null,
      DESIGNER_CONTROL_COMMANDS.PASTE,
      { clipboardText: copy.clipboardText, windowIndex: 0 }
    );
    const emptyFormControls = listDesignerControls(pasteIntoEmpty.source);
    assert.equal(emptyFormControls.length, 1);
    assert.equal(emptyFormControls[0].id, 'save');
    assert.equal(pasteIntoEmpty.nextControl.id, 'save');
    assert.match(pasteIntoEmpty.source, /when save clicked:/);

    const duplicate = executeDesignerControlCommand(source, selection, DESIGNER_CONTROL_COMMANDS.DUPLICATE);
    const duplicatedControls = listDesignerControls(duplicate.source);
    assert.equal(duplicatedControls.length, 3);
    assert.ok(duplicate.nextControl);
    assert.notEqual(duplicate.nextControl.id, 'save');
    assert.equal(duplicatedControls[1].id, duplicate.nextControl.id);

    const removed = executeDesignerControlCommand(source, selection, DESIGNER_CONTROL_COMMANDS.DELETE);
    assert.deepEqual(listDesignerControls(removed.source).map(control => control.id), ['name']);
    assert.equal(removed.nextControl, null);

    assert.throws(
      () => executeDesignerControlCommand(source, selection, 'designer.control.unknown'),
      /Unknown Designer control command/
    );
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('Inspector and clipboard surfaces share stable command IDs and one dispatch event', () => {
  const core = fs.readFileSync('web/designer-core-selection.js', 'utf8');
  const duplicate = fs.readFileSync('web/designer-control-duplicate.js', 'utf8');

  assert.match(core, /DESIGNER_CONTROL_COMMAND_EVENT = 'patch-designer-control-command'/);
  assert.match(core, /DELETE: 'designer\.control\.delete'/);
  assert.match(core, /DUPLICATE: 'designer\.control\.duplicate'/);
  assert.match(core, /REVEAL_SOURCE: 'designer\.control\.reveal-source'/);
  assert.match(core, /COPY: 'designer\.control\.copy'/);
  assert.match(core, /CUT: 'designer\.control\.cut'/);
  assert.match(core, /PASTE: 'designer\.control\.paste'/);
  assert.match(core, /canvas\.addEventListener\(DESIGNER_CONTROL_COMMAND_EVENT, handleDesignerControlCommand\)/);
  assert.match(core, /dispatchDesignerControlCommand\(DESIGNER_CONTROL_COMMANDS\.DELETE/);
  assert.match(core, /dispatchDesignerControlCommand\(DESIGNER_CONTROL_COMMANDS\.REVEAL_SOURCE/);
  assert.match(core, /validateDesignerControlClipboardSemantics/);
  assert.match(core, /copyDesignerControlClipboard/);
  assert.match(core, /pasteDesignerControlClipboard/);
  assert.match(duplicate, /dispatchDesignerControlCommand\(DESIGNER_CONTROL_COMMANDS\.DUPLICATE/);
  assert.doesNotMatch(duplicate, /duplicateDesignerControl/);
  assert.doesNotMatch(duplicate, /code\.value\s*=/);
});
