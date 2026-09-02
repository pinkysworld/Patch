import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const palette = fs.readFileSync('web/studio-command-palette.js', 'utf8');

test('Designer command surfaces reuse the stable shared command contract', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-command-palette.js'], { stdio: 'pipe' });
  assert.match(palette, /STUDIO_DESIGNER_COMMAND_SURFACES_VERSION = '0\.1'/);
  assert.match(palette, /currentDesignerSelection/);
  assert.match(palette, /DESIGNER_CONTROL_COMMANDS/);
  assert.match(palette, /dispatchDesignerControlCommand/);
  assert.match(palette, /runSelectedDesignerControlCommand/);
  assert.match(palette, /dispatchDesignerControlCommand\(command, \{ origin \}\)/);
  assert.doesNotMatch(palette, /removeDesignerControl|duplicateDesignerControl|updateDesignerControl/);
  assert.doesNotMatch(palette, /code\.value\s*=/);
});

test('Command Palette exposes Delete Duplicate and Reveal Source through the shared command IDs', () => {
  assert.match(palette, /command\('designer-control-duplicate', 'Duplicate selected control'/);
  assert.match(palette, /DESIGNER_CONTROL_COMMANDS\.DUPLICATE/);
  assert.match(palette, /'Ctrl\/Cmd \+ Shift \+ D'/);
  assert.match(palette, /command\('designer-control-delete', 'Delete selected control'/);
  assert.match(palette, /DESIGNER_CONTROL_COMMANDS\.DELETE/);
  assert.match(palette, /'Delete'/);
  assert.match(palette, /command\('designer-control-reveal-source', 'Reveal selected control source'/);
  assert.match(palette, /DESIGNER_CONTROL_COMMANDS\.REVEAL_SOURCE/);
});

test('Designer keyboard shortcuts are scoped to a focused Designer control and avoid editable controls', () => {
  assert.match(palette, /installDesignerControlCommandShortcuts\(\)/);
  assert.match(palette, /event\.target\?\.closest\?\.\('\.designer-control'\)/);
  assert.match(palette, /canvas\.contains\(control\)/);
  assert.match(palette, /document\.querySelector\('dialog\[open\]'\)/);
  assert.match(palette, /event\.target\?\.matches\?\.\('input, textarea, select'\)/);
  assert.match(palette, /event\.key\.toLowerCase\(\) === 'd'/);
  assert.match(palette, /event\.key === 'Delete'/);
  assert.match(palette, /duplicate \? DESIGNER_CONTROL_COMMANDS\.DUPLICATE : DESIGNER_CONTROL_COMMANDS\.DELETE/);
  assert.match(palette, /designer-multi-selected/);
});
