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
  assert.match(css, /\.project-actions/);
  assert.match(css, /button:disabled/);
});

test('project lifecycle bootstraps before playground reads legacy storage', () => {
  const lifecycleIndex = html.indexOf('./project-lifecycle.js');
  const playgroundIndex = html.indexOf('./playground.js');
  assert.ok(lifecycleIndex > 0);
  assert.ok(playgroundIndex > lifecycleIndex);
});

test('project lifecycle keeps canonical pending and legacy compatibility stores', () => {
  for (const marker of [
    "'patchStudio.project.v1'",
    "'patchStudio.project.pending.v1'",
    "'patchStudio.recovery.v1'",
    "'patchStudio.project'",
    'localStorage.setItem(PENDING_KEY',
    'localStorage.setItem(CURRENT_KEY',
    'localStorage.removeItem(PENDING_KEY)',
    'writeLegacyCompatibility'
  ]) assert.ok(lifecycle.includes(marker), marker);
});

test('import validates before replacing source and recovery snapshots protect replacements', () => {
  const parseIndex = lifecycle.indexOf('parseStudioProjectBundle(await file.text())');
  const snapshotIndex = lifecycle.indexOf("persistDomProject({ snapshot: 'force' })", parseIndex);
  const applyIndex = lifecycle.indexOf('applyBundleToDom(bundle)', parseIndex);
  assert.ok(parseIndex > 0);
  assert.ok(snapshotIndex > parseIndex);
  assert.ok(applyIndex > snapshotIndex);
  assert.match(lifecycle, /PATCH_STUDIO_MAX_SOURCE_BYTES/);
  assert.match(lifecycle, /Recover the Patch Studio snapshot/);
});

test('PWA cache advances and includes every project lifecycle asset', () => {
  assert.match(sw, /forms8-ux11-project1/);
  for (const marker of ['./project-lifecycle.js','./project-lifecycle.css','../src/studio-project.js']) {
    assert.ok(sw.includes(`'${marker}'`), marker);
  }
});
