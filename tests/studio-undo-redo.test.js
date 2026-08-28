import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const source = fs.readFileSync('web/studio-command-palette.js', 'utf8');
const backlog = fs.readFileSync('docs/RAD_STUDIO_MASTER_BACKLOG.md', 'utf8');

test('Studio undo/redo history is syntax-valid, bounded and source-backed', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-command-palette.js'], { stdio: 'pipe' });
  assert.match(source, /STUDIO_EDIT_HISTORY_VERSION = '0\.1'/);
  assert.match(source, /STUDIO_EDIT_HISTORY_LIMIT = 80/);
  assert.match(source, /sourceByFile = new Map\(\)/);
  assert.match(source, /activateStudioProjectFile/);
  assert.match(source, /sourceEditor\.dispatchEvent\(new Event\('input'/);
  assert.match(source, /sourceEditor\.dispatchEvent\(new Event\('change'/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('Studio edit history coalesces trusted typing but keeps Designer rewrites atomic', () => {
  assert.match(source, /event\.isTrusted === true/);
  assert.match(source, /kind: trustedTyping \? 'typing' : 'studio'/);
  assert.match(source, /editUndo\[editUndo\.length - 1\] = Object\.freeze\(\{ \.\.\.previous, after \}\)/);
  assert.match(source, /else \{\s*pushBounded\(editUndo/s);
  assert.match(source, /editRedo\.length = 0/);
});

test('Studio undo/redo keyboard contract is global for Designer and explicit for source editor', () => {
  assert.match(source, /window\.addEventListener\('keydown', handleHistoryShortcut, \{ capture: true \}\)/);
  assert.match(source, /key === 'z' && event\.shiftKey/);
  assert.match(source, /key === 'y' && !event\.shiftKey/);
  assert.match(source, /key === 'z' && !event\.shiftKey/);
  assert.match(source, /target !== sourceEditor/);
  assert.match(source, /document\.querySelector\('dialog\[open\]'\)/);
});

test('Undo and Redo are discoverable through the existing command palette', () => {
  assert.match(source, /command\('undo-edit', 'Undo Studio edit'/);
  assert.match(source, /'Ctrl\/Cmd \+ Z'/);
  assert.match(source, /command\('redo-edit', 'Redo Studio edit'/);
  assert.match(source, /'Ctrl\/Cmd \+ Shift \+ Z'/);
});

test('history resets across project/resource replacement boundaries rather than replaying stale source', () => {
  assert.match(source, /patch:studio-project-files-changed', resetStudioEditHistory/);
  assert.match(source, /patch:studio-project-resources-changed', resetStudioEditHistory/);
  assert.match(source, /patch:studio-project-loaded', resetStudioEditHistory/);
  assert.match(source, /patch:studio-active-file-changed', refreshActiveFileBaseline/);
});

test('RAD master backlog still defines source-backed undo/redo as a P0 correctness requirement', () => {
  assert.match(backlog, /## P0\.2 Undo\/Redo transaction model/);
  assert.match(backlog, /Ctrl\/Cmd\+Z and Ctrl\/Cmd\+Shift\+Z/);
  assert.match(backlog, /coalesce one drag\/resize into one history entry/);
});
