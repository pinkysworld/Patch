import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const palette = fs.readFileSync('web/studio-command-palette.js', 'utf8');
const core = fs.readFileSync('web/designer-core-selection.js', 'utf8');

test('Designer command surfaces 0.2 expose conventional Copy Cut Paste shortcuts only inside the Designer canvas', () => {
  assert.match(palette, /STUDIO_DESIGNER_COMMAND_SURFACES_VERSION = '0\.2'/);
  assert.match(palette, /canvas\.contains\(event\.target\)/);
  assert.match(palette, /event\.target\?\.matches\?\.\('input, textarea, select'\)/);
  assert.match(palette, /key === 'c'/);
  assert.match(palette, /key === 'x'/);
  assert.match(palette, /key === 'v'/);
  assert.match(palette, /DESIGNER_CONTROL_COMMANDS\.COPY/);
  assert.match(palette, /DESIGNER_CONTROL_COMMANDS\.CUT/);
  assert.match(palette, /DESIGNER_CONTROL_COMMANDS\.PASTE/);
  assert.match(palette, /allowWithoutSelection: true/);
});

test('Command Palette exposes Copy Cut Paste through the same stable Designer command IDs', () => {
  assert.match(palette, /command\('designer-control-copy', 'Copy selected control'/);
  assert.match(palette, /command\('designer-control-cut', 'Cut selected control'/);
  assert.match(palette, /command\('designer-control-paste', 'Paste control into active Form'/);
  assert.match(palette, /'Ctrl\/Cmd \+ C'/);
  assert.match(palette, /'Ctrl\/Cmd \+ X'/);
  assert.match(palette, /'Ctrl\/Cmd \+ V'/);
  assert.match(palette, /dispatchDesignerControlCommand\(command, detail\)/);
  assert.doesNotMatch(palette, /copyDesignerControlClipboard|pasteDesignerControlClipboard|removeDesignerControl|code\.value\s*=/);
});

test('shared core owns clipboard mutation, browser clipboard fallback and semantic validation', () => {
  assert.match(core, /COPY: 'designer\.control\.copy'/);
  assert.match(core, /CUT: 'designer\.control\.cut'/);
  assert.match(core, /PASTE: 'designer\.control\.paste'/);
  assert.match(core, /copyDesignerControlClipboard/);
  assert.match(core, /pasteDesignerControlClipboard/);
  assert.match(core, /validateDesignerControlClipboardSemantics/);
  assert.match(core, /designerClipboardText/);
  assert.match(core, /navigator\?\.clipboard\?\.writeText/);
  assert.match(core, /navigator\?\.clipboard\?\.readText/);
  assert.match(core, /patch-designer-control-clipboard/);
});
