import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const manager = fs.readFileSync('web/recovery-manager.js', 'utf8');
const css = fs.readFileSync('web/recovery-manager.css', 'utf8');
const html = fs.readFileSync('web/index.html', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Recovery manager browser module is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', 'web/recovery-manager.js'], { stdio: 'pipe' });
});

test('Recovery manager uses lifecycle exports instead of reading localStorage directly', () => {
  for (const marker of [
    'clearRecoverySnapshots','createManualRecoverySnapshot','deleteRecoverySnapshot',
    'exportRecoverySnapshot','getRecoverySnapshotSummaries','restoreRecoverySnapshot'
  ]) assert.ok(manager.includes(marker), marker);
  assert.doesNotMatch(manager, /localStorage/);
  assert.match(manager, /from '\.\/project-lifecycle\.js'/);
});

test('Recovery manager exposes five local snapshot actions', () => {
  for (const label of ['Snapshot now','Clear all','Restore','Export','Delete','Close']) {
    assert.ok(manager.includes(label), label);
  }
  assert.match(manager, /patch:open-recovery-manager/);
  assert.match(manager, /patch:recovery-changed/);
  assert.match(manager, /showModal/);
  assert.match(manager, /aria-labelledby/);
  assert.match(manager, /aria-live="polite"/);
});

test('Restore and destructive recovery actions require confirmation', () => {
  assert.match(manager, /Restore .*current project will be saved as a recovery snapshot first/);
  assert.match(manager, /Delete the recovery snapshot/);
  assert.match(manager, /Delete all local Patch Studio recovery snapshots/);
  assert.ok((manager.match(/window\.confirm/g) ?? []).length >= 3);
});

test('Recovery manager is compact scrollable and responsive', () => {
  for (const marker of ['.recovery-dialog','.recovery-list','overflow: auto','scrollbar-gutter: stable','@media (max-width: 620px)']) {
    assert.ok(css.includes(marker), marker);
  }
});

test('Recovery manager ships in Studio and PWA cache', () => {
  assert.ok(html.includes('./recovery-manager.js'));
  assert.ok(html.indexOf('./recovery-manager.js') > html.indexOf('./project-lifecycle.js'));
  for (const marker of ['./recovery-manager.js','./recovery-manager.css']) {
    assert.ok(sw.includes(`'${marker}'`), marker);
  }
});
