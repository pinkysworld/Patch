import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const lifecycle = fs.readFileSync('web/project-lifecycle.js', 'utf8');
const css = fs.readFileSync('web/project-lifecycle.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio project lifecycle browser module is valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', 'web/project-lifecycle.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'src/studio-project.js'], { stdio: 'pipe' });
});

test('Studio exposes compact Export Import and Recovery controls', () => {
  for (const id of ['exportProject','importProject','recoverProject','importProjectFile']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /class="project-actions"/);
  assert.match(html, /id="recoverProject"[^>]*>Recovery</);
  assert.doesNotMatch(html, /id="recoverProject"[^>]*disabled/);
  assert.match(css, /\.project-actions/);
});

test('project lifecycle bootstraps before recovery manager and playground', () => {
  const lifecycleIndex = html.indexOf('./project-lifecycle.js');
  const recoveryIndex = html.indexOf('./recovery-manager.js');
  const playgroundIndex = html.indexOf('./playground.js');
  assert.ok(lifecycleIndex > 0);
  assert.ok(recoveryIndex > lifecycleIndex);
  assert.ok(playgroundIndex > recoveryIndex);
});

test('project lifecycle keeps canonical pending recovery quarantine and legacy stores', () => {
  for (const marker of [
    "'patchStudio.project.v1'",
    "'patchStudio.project.pending.v1'",
    "'patchStudio.recovery.v1'",
    "'patchStudio.project.corrupt.v1'",
    "'patchStudio.project'",
    'localStorage.setItem(PENDING_KEY',
    'localStorage.setItem(CURRENT_KEY',
    'localStorage.removeItem(PENDING_KEY)',
    'writeLegacyCompatibility',
    'quarantineCorruptStore'
  ]) assert.ok(lifecycle.includes(marker), marker);
});

test('import validates before replacement and always protects the current project', () => {
  const parseIndex = lifecycle.indexOf('parseStudioProjectBundle(await file.text())');
  const snapshotIndex = lifecycle.indexOf('protectCurrentProject()', parseIndex);
  const applyIndex = lifecycle.indexOf('applyBundleToDom(bundle)', parseIndex);
  assert.ok(parseIndex > 0);
  assert.ok(snapshotIndex > parseIndex);
  assert.ok(applyIndex > snapshotIndex);
  assert.match(lifecycle, /MAX_IMPORT_BYTES = PATCH_STUDIO_MAX_SOURCE_BYTES \* 8/);
});

test('managed recovery exports summary create restore export delete and clear operations', () => {
  for (const marker of [
    'export function getRecoverySnapshotSummaries()',
    'export function createManualRecoverySnapshot()',
    'export function restoreRecoverySnapshot(index)',
    'export function exportRecoverySnapshot(index)',
    'export function deleteRecoverySnapshot(index)',
    'export function clearRecoverySnapshots()'
  ]) assert.ok(lifecycle.includes(marker), marker);
  const restoreStart = lifecycle.indexOf('export function restoreRecoverySnapshot(index)');
  const protection = lifecycle.indexOf('protectCurrentProject()', restoreStart);
  const apply = lifecycle.indexOf('applyBundleToDom(selected.project)', restoreStart);
  assert.ok(protection > restoreStart);
  assert.ok(apply > protection);
  assert.match(lifecycle, /let applyingBundle = false/);
  assert.match(lifecycle, /if \(!applyingBundle\) persistDomProject/);
});

test('recovery control remains available even before the first snapshot', () => {
  assert.match(lifecycle, /recoverButton\.disabled = false/);
  assert.match(lifecycle, /Recovery \(\$\{count\}\)/);
  assert.match(lifecycle, /patch:open-recovery-manager/);
  assert.match(lifecycle, /patch:recovery-changed/);
});

test('corrupt pending or canonical stores are quarantined before legacy fallback continues', () => {
  const bootstrap = lifecycle.slice(lifecycle.indexOf('function bootstrapProjectStorage()'), lifecycle.indexOf('function installProjectActions()'));
  assert.match(bootstrap, /quarantineCorruptStore\(PENDING_KEY/);
  assert.match(bootstrap, /quarantineCorruptStore\(CURRENT_KEY/);
  assert.match(bootstrap, /localStorage\.getItem\(LEGACY_KEY\)/);
  assert.match(bootstrap, /Recovered legacy local project/);
});

test('PWA cache contains project lifecycle and recovery manager assets', () => {
  assert.match(sw, /patch-studio-0\.2-beta\.32-/);
  for (const marker of ['./project-lifecycle.js','./project-lifecycle.css','./recovery-manager.js','./recovery-manager.css','../src/studio-project.js']) {
    assert.ok(sw.includes(`'${marker}'`), marker);
  }
});
