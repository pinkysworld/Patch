import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync('web/index.html', 'utf8');
const lifecycle = fs.readFileSync('web/project-lifecycle.js', 'utf8');
const restore = fs.readFileSync('web/project-config-restore.js', 'utf8');
const css = fs.readFileSync('web/project-lifecycle.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio project lifecycle and config restore browser modules are valid JavaScript', () => {
  execFileSync(process.execPath, ['--check', 'web/project-lifecycle.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/project-config-restore.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'src/studio-project.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'src/artifact-name.js'], { stdio: 'pipe' });
});

test('Studio exposes compact Export Import and Recovery controls', () => {
  for (const id of ['exportProject','importProject','recoverProject','importProjectFile']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /class="project-actions"/);
  assert.match(html, /id="recoverProject"[^>]*>Recovery</);
  assert.doesNotMatch(html, /id="recoverProject"[^>]*disabled/);
  assert.match(css, /\.project-actions/);
});

test('project v3 config restore runs after lifecycle and before recovery/playground', () => {
  const lifecycleIndex = html.indexOf('./project-lifecycle.js');
  const restoreIndex = html.indexOf('./project-config-restore.js');
  const recoveryIndex = html.indexOf('./recovery-manager.js');
  const playgroundIndex = html.indexOf('./playground.js');
  assert.ok(lifecycleIndex > 0);
  assert.ok(restoreIndex > lifecycleIndex);
  assert.ok(recoveryIndex > restoreIndex);
  assert.ok(playgroundIndex > recoveryIndex);
  assert.match(restore, /patchStudio\.project\.v3/);
  assert.match(restore, /patchStudio\.project\.v2/);
  assert.match(restore, /state\.buildTarget/);
  assert.match(restore, /state\.nativeBuildMode/);
  assert.match(restore, /buildTarget\?\.dispatchEvent/);
  assert.match(restore, /nativeBuildMode\?\.dispatchEvent/);
});

test('project lifecycle uses v3 canonical stores and retains explicit v2 v1 and scalar migrations', () => {
  for (const marker of [
    "'patchStudio.project.v3'",
    "'patchStudio.project.pending.v3'",
    "'patchStudio.project.v2'",
    "'patchStudio.project.pending.v2'",
    "'patchStudio.project.v1'",
    "'patchStudio.project.pending.v1'",
    "'patchStudio.recovery.v1'",
    "'patchStudio.project.corrupt.v3'",
    "'patchStudio.project'",
    'localStorage.setItem(PENDING_KEY',
    'localStorage.setItem(CURRENT_KEY',
    'removeMigrationStores',
    'writeLegacyCompatibility',
    'quarantineCorruptStore'
  ]) assert.ok(lifecycle.includes(marker), marker);
});

test('project lifecycle persists build settings and active-file source into the canonical bundle', () => {
  assert.match(lifecycle, /const buildTarget = document\.querySelector\('#buildTarget'\)/);
  assert.match(lifecycle, /const nativeBuildMode = document\.querySelector\('#nativeBuildMode'\)/);
  assert.match(lifecycle, /file\.path === activeFilePath/);
  assert.match(lifecycle, /content: code\?\.value \?\? file\.content/);
  assert.match(lifecycle, /buildTarget: buildTarget\?\.value \?\? base\.project\.build\.target/);
  assert.match(lifecycle, /nativeBuildMode: nativeBuildMode\?\.value \?\? base\.project\.build\.nativeMode/);
  assert.match(lifecycle, /for \(const input of \[code, projectName, projectKind, buildTarget, nativeBuildMode\]\)/);
});

test('project lifecycle exports multi-file editor project and build APIs', () => {
  for (const marker of [
    'export function getStudioProjectEditorState()',
    'export function getStudioProjectBundle()',
    'export function getStudioProjectBuildInput()',
    'export function getStudioProjectDiagnosticContext()',
    'export function getStudioProjectFiles()',
    'export function getActiveStudioProjectFile()',
    'export function activateStudioProjectFile(path)',
    "export function addStudioProjectFile(path, content = '')",
    'export function removeStudioProjectFile(path)',
    'export function replaceStudioProjectSource(source, options = {})'
  ]) assert.ok(lifecycle.includes(marker), marker);
  assert.match(lifecycle, /composeStudioProjectSource\(bundle\)/);
  assert.match(lifecycle, /The entry file '\$\{path\}' cannot be removed/);
  assert.match(lifecycle, /patch:studio-active-file-changed/);
  assert.match(lifecycle, /patch:studio-project-files-changed/);
});

test('import validates before replacement and always protects the current project', () => {
  const parseIndex = lifecycle.indexOf('parseStudioProjectBundle(await file.text())');
  const snapshotIndex = lifecycle.indexOf('protectCurrentProject()', parseIndex);
  const applyIndex = lifecycle.indexOf('applyBundleToDom(bundle)', parseIndex);
  assert.ok(parseIndex > 0);
  assert.ok(snapshotIndex > parseIndex);
  assert.ok(applyIndex > snapshotIndex);
  assert.match(lifecycle, /MAX_IMPORT_BYTES = PATCH_STUDIO_MAX_PROJECT_BYTES \+ 1024 \* 1024/);
});

test('managed recovery preserves whole v3 projects and exposes summary create restore export delete and clear operations', () => {
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
  assert.match(lifecycle, /fileCount: state\.files\.length/);
  assert.match(lifecycle, /state\.files\.reduce/);
  assert.match(lifecycle, /let applyingBundle = false/);
  assert.match(lifecycle, /if \(!applyingBundle\) persistDomProject/);
});

test('recovery summaries include build target and recovery remains available before first snapshot', () => {
  assert.match(lifecycle, /buildTarget: state\.buildTarget/);
  assert.match(lifecycle, /recoverButton\.disabled = false/);
  assert.match(lifecycle, /Recovery \(\$\{count\}\)/);
  assert.match(lifecycle, /patch:open-recovery-manager/);
  assert.match(lifecycle, /patch:recovery-changed/);
});

test('corrupt v3 v2 or v1 stores are quarantined before scalar legacy fallback continues', () => {
  const bootstrap = lifecycle.slice(lifecycle.indexOf('function bootstrapProjectStorage()'), lifecycle.indexOf('function installProjectActions()'));
  assert.match(bootstrap, /const pendingKeys = \[PENDING_KEY, V2_PENDING_KEY, V1_PENDING_KEY\]/);
  assert.match(bootstrap, /const currentKeys = \[CURRENT_KEY, V2_CURRENT_KEY, V1_CURRENT_KEY\]/);
  assert.match(bootstrap, /quarantineCorruptStore\(key/);
  assert.match(bootstrap, /localStorage\.getItem\(LEGACY_KEY\)/);
  assert.match(bootstrap, /Recovered legacy local project/);
});

test('PWA cache contains v3 project configuration and shared artifact naming assets', () => {
  assert.match(sw, /const REVISION = '__PATCH_SITE_REV__'/);
  assert.match(sw, /const CACHE_PREFIX = 'patch-studio-'/);
  assert.match(sw, /\.map\(versioned\)/);
  for (const marker of ['./project-lifecycle.js','./project-config-restore.js','./project-lifecycle.css','./recovery-manager.js','./recovery-manager.css','../src/studio-project.js','../src/artifact-name.js']) {
    assert.ok(sw.includes(`'${marker}'`), marker);
  }
});
