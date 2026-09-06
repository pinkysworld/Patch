import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseStudioProjectBundle } from '../src/studio-project.js';

const restore = fs.readFileSync('web/project-config-restore.js', 'utf8');
const payloadModule = fs.readFileSync('web/studio-showcase-project.js', 'utf8');
const canonical = fs.readFileSync('examples/patch-studio-showcase.patchproject', 'utf8');

function embeddedShowcaseProject() {
  const marker = 'export const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw`';
  const start = payloadModule.indexOf(marker);
  assert.ok(start >= 0, 'Showcase payload module must embed the offline Showcase project');
  const contentStart = start + marker.length;
  const end = payloadModule.indexOf('`;', contentStart);
  assert.ok(end > contentStart, 'Embedded Showcase project terminator is missing');
  return payloadModule.slice(contentStart, end);
}

test('built-in Patch Studio Showcase stays byte-for-byte synchronized with the canonical project-v4 fixture', () => {
  const embedded = embeddedShowcaseProject();
  assert.equal(embedded, canonical);
  const bundle = parseStudioProjectBundle(embedded);
  assert.equal(bundle.project.name, 'Patch Studio Showcase');
  assert.equal(bundle.version, 4);
  assert.deepEqual(bundle.files.map(file => file.path), ['main.patch', 'forms.patch', 'logic.patch']);
  assert.deepEqual(bundle.resources.map(resource => resource.id), ['showcase.logo']);
  assert.match(restore, /import \{ PATCH_STUDIO_SHOWCASE_PROJECT \} from '\.\/studio-showcase-project\.js'/);
  assert.doesNotMatch(restore, /const PATCH_STUDIO_SHOWCASE_PROJECT = String\.raw/);
});

test('Showcase appears as an explicit repeatable Example load without replacing startup restoration', () => {
  assert.match(restore, /option\.value = 'studioShowcase'/);
  assert.match(restore, /option\.textContent = 'Patch Studio Showcase'/);
  assert.match(restore, /if \(sample && hasOption\(sample, 'counterWindow'\)\) sample\.value = 'counterWindow'/);
  assert.match(restore, /if \(sample\.value !== 'studioShowcase'\) return;/);
  assert.match(restore, /event\.stopImmediatePropagation\(\)/);
  assert.match(restore, /document\.querySelector\('#tabDesigner'\)\?\.click\(\)/);
});

test('Showcase load is atomic at project persistence level and restores all v4 surfaces', () => {
  const firstPersist = restore.indexOf("persistStudioProjectFromDom({ snapshot: 'none' })");
  const getLive = restore.indexOf('const live = getStudioProjectBundle()', firstPersist);
  const files = restore.indexOf('live.files = incoming.files.map', getLive);
  const resources = restore.indexOf('live.resources = incoming.resources.map', files);
  const forcedPersist = restore.indexOf("persistStudioProjectFromDom({ snapshot: 'force' })", resources);
  const activate = restore.indexOf('activateStudioProjectFile(incoming.project.entry)', forcedPersist);

  assert.ok(firstPersist >= 0, 'Current editor state must be flushed before replacement');
  assert.ok(getLive > firstPersist, 'Loader must adopt into current v4 state only after flushing it');
  assert.ok(files > getLive && resources > files, 'Loader must replace both multi-file sources and resources');
  assert.ok(forcedPersist > resources, 'Complete incoming bundle must be persisted once after adoption');
  assert.ok(activate > forcedPersist, 'Entry file activation must happen after canonical persistence');
  assert.match(restore, /patch:studio-project-files-changed/);
  assert.match(restore, /patch:studio-project-resources-changed/);
  assert.match(restore, /incoming\.project\.build\.target/);
  assert.match(restore, /incoming\.project\.build\.nativeMode/);
});
