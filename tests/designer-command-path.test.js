import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listDesignerControls } from '../src/designer.js';

test('shared Designer command executor owns delete duplicate and reveal-source semantics', async () => {
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

    const source = `window "Demo" as main size 640, 420:\n  button "Save" as save at 24, 24 size 120, 36\n  input name at 24, 76 size 220, 36\n`;
    const selection = { windowIndex: 0, controlIndex: 0, adapter: 'core' };

    const reveal = executeDesignerControlCommand(source, selection, DESIGNER_CONTROL_COMMANDS.REVEAL_SOURCE);
    assert.equal(reveal.source, source);
    assert.equal(reveal.control.id, 'save');
    assert.equal(reveal.line, 2);

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

test('Inspector Delete Duplicate and Reveal Source share stable command IDs and one dispatch event', () => {
  const core = fs.readFileSync('web/designer-core-selection.js', 'utf8');
  const duplicate = fs.readFileSync('web/designer-control-duplicate.js', 'utf8');

  assert.match(core, /DESIGNER_CONTROL_COMMAND_EVENT = 'patch-designer-control-command'/);
  assert.match(core, /DELETE: 'designer\.control\.delete'/);
  assert.match(core, /DUPLICATE: 'designer\.control\.duplicate'/);
  assert.match(core, /REVEAL_SOURCE: 'designer\.control\.reveal-source'/);
  assert.match(core, /canvas\.addEventListener\(DESIGNER_CONTROL_COMMAND_EVENT, handleDesignerControlCommand\)/);
  assert.match(core, /executeDesignerControlCommand\(code\.value, selection, command\)/);
  assert.match(core, /dispatchDesignerControlCommand\(DESIGNER_CONTROL_COMMANDS\.DELETE/);
  assert.match(core, /dispatchDesignerControlCommand\(DESIGNER_CONTROL_COMMANDS\.REVEAL_SOURCE/);
  assert.match(duplicate, /dispatchDesignerControlCommand\(DESIGNER_CONTROL_COMMANDS\.DUPLICATE/);
  assert.doesNotMatch(duplicate, /duplicateDesignerControl/);
  assert.doesNotMatch(duplicate, /code\.value\s*=/);
});
