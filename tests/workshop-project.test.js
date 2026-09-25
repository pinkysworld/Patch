import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseStudioProjectBundle, composeStudioProjectSource } from '../src/studio-project.js';
import { compile } from '../src/compiler.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const PROJECT_PATH = 'examples/workshop-desk.patchproject';
const SOURCE_DIR = 'examples/workshop-desk';
const bundle = parseStudioProjectBundle(fs.readFileSync(PROJECT_PATH, 'utf8'));
const composition = composeStudioProjectSource(bundle);
const restore = fs.readFileSync('web/project-config-restore.js', 'utf8');
const embeddedModule = fs.readFileSync('web/workshop-desk-project.js', 'utf8');

function embeddedWorkshopProject() {
  const tick = String.fromCharCode(96);
  const marker = 'export const WORKSHOP_DESK_PROJECT = String.raw' + tick;
  const start = embeddedModule.indexOf(marker);
  assert.ok(start >= 0, 'Workshop payload module must embed the canonical Project-v4 bundle');
  const contentStart = start + marker.length;
  const end = embeddedModule.indexOf(tick + ';', contentStart);
  assert.ok(end > contentStart, 'Embedded Workshop project terminator is missing');
  return embeddedModule.slice(contentStart, end);
}

test('Workshop Desk is a synchronized multi-file Project-v4 fixture', () => {
  assert.equal(bundle.version, 4);
  assert.equal(bundle.project.name, 'Workshop Desk');
  assert.equal(bundle.project.kind, 'window');
  assert.equal(bundle.project.entry, 'main.patch');
  assert.equal(bundle.project.build.target, 'web');
  assert.deepEqual(bundle.files.map(file => file.path), ['main.patch', 'model.patch', 'logic.patch']);
  assert.deepEqual(bundle.resources.map(resource => resource.id), ['workshop.mark']);

  for (const file of bundle.files) {
    const canonical = fs.readFileSync(path.join(SOURCE_DIR, file.path), 'utf8');
    assert.equal(file.content, canonical, file.path + ' must stay synchronized with the Project-v4 bundle');
  }

  assert.equal(embeddedWorkshopProject(), fs.readFileSync(PROJECT_PATH, 'utf8'));
});

test('Workshop Project-v4 resource is consumed by application chrome, Picture, PaintBox and ImageList-backed Buttons', () => {
  assert.match(composition.source, /window "Workshop Desk" as main size 1080, 720 icon "patch-resource:workshop\.mark"/);
  assert.match(composition.source, /picture as workshop_logo from "patch-resource:workshop\.mark"/);
  assert.match(composition.source, /picture as gallery_picture from "patch-resource:workshop\.mark"/);
  assert.match(composition.source, /draw image "patch-resource:workshop\.mark"/);
  assert.match(composition.source, /imagelist as desk_images[\s\S]*?image mark from "patch-resource:workshop\.mark"/);
  assert.match(composition.source, /button "Studio Features" as components_button image desk_images\.mark/);
  assert.match(composition.source, /imagelist as gallery_images[\s\S]*?image mark from "patch-resource:workshop\.mark"/);
  assert.match(composition.source, /button "Resource button" as gallery_resource_button image gallery_images\.mark/);
  assert.match(composition.source, /button "Refresh demo" as gallery_refresh image gallery_images\.mark/);
});

test('Workshop Project-v4 builds its declared Web target with project resources', () => {
  const compiled = compile(composition.source, {
    name: bundle.project.name,
    kind: bundle.project.kind,
    entry: bundle.project.entry
  });
  assert.ok(compiled.ast);

  const built = buildStandaloneWebApp(composition.source, {
    name: bundle.project.name,
    kind: bundle.project.kind,
    entry: bundle.project.entry,
    resources: bundle.resources
  });
  assert.equal(built.metadata.projectKind, 'window');
  assert.equal(built.metadata.version, '0.10');
  assert.match(built.html, /rel="icon"/);
  assert.match(built.html, /data:image\/png;base64/);
  assert.match(built.html, /patch-button-image/);
  assert.match(built.html, /calculate_quote/);
  assert.match(built.html, /saved_customer/);
});

test('Studio intercepts Workshop selection before the legacy single-file loader and adopts the complete project atomically', () => {
  assert.match(restore, /import \{ WORKSHOP_DESK_PROJECT \} from '\.\/workshop-desk-project\.js'/);
  assert.match(restore, /sample\.value !== 'studioShowcase' && sample\.value !== 'workshopDesk'/);
  assert.match(restore, /if \(sample\.value === 'workshopDesk'\) loadWorkshopDeskProject\(\)/);
  assert.match(restore, /loadStudioProject\(WORKSHOP_DESK_PROJECT/);
  assert.match(restore, /event\.stopImmediatePropagation\(\)/);
  assert.match(restore, /live\.files = incoming\.files\.map/);
  assert.match(restore, /live\.resources = incoming\.resources\.map/);
  assert.match(restore, /persistStudioProjectFromDom\(\{ snapshot: 'force' \}\)/);
  assert.match(restore, /activateStudioProjectFile\(incoming\.project\.entry\)/);
});
