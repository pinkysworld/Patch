import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const manager = fs.readFileSync('web/resource-manager.js', 'utf8');
const workspace = fs.readFileSync('web/designer-workspace.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio Resources manager is browser-valid and loaded by the Designer workspace', () => {
  execFileSync(process.execPath, ['--check', 'web/resource-manager.js'], { stdio: 'pipe' });
  assert.match(workspace, /import '\.\/resource-manager\.js'/);
  assert.match(manager, /id = 'resourcesProject'/);
  assert.match(manager, /id = 'studioResourceManager'/);
  assert.match(manager, /\+ Add image/);
  assert.match(manager, /Resources \(\$\{count\}\)/);
});

test('Resources manager imports only the bounded canonical image formats through the v4 lifecycle', () => {
  assert.match(manager, /PATCH_STUDIO_IMAGE_MEDIA_TYPES/);
  assert.match(manager, /buildStudioImageResource/);
  assert.match(manager, /addStudioProjectResource\(resource\)/);
  assert.match(manager, /getStudioProjectResources\(\)/);
  assert.match(manager, /removeStudioProjectResource\(resource\.id\)/);
  assert.match(manager, /image\/png,image\/jpeg,image\/webp,image\/svg\+xml/);
});

test('resource deletion fails closed while visible Patch source still references the logical locator', () => {
  assert.match(manager, /const locator = `patch-resource:\$\{resource\.id\}`/);
  assert.match(manager, /getStudioProjectFiles\(\)\.filter\(file => file\.content\.includes\(locator\)\)/);
  assert.match(manager, /Cannot remove \$\{resource\.id\}: referenced by/);
});

test('Picture resource picker writes an ordinary visible patch-resource source expression', () => {
  assert.match(manager, /id = 'designerPictureChooseResource'/);
  assert.match(manager, /Choose resource…/);
  assert.match(manager, /studioResourceSourceExpression\(resource\.id\)/);
  assert.match(manager, /updateDesignerControl\(code\.value, selection, \{ sourceExpr \}\)/);
  assert.match(manager, /code\.dispatchEvent\(new Event\('input'/);
  assert.match(manager, /code\.dispatchEvent\(new Event\('change'/);
});

test('public Site and PWA contain the Resources manager and canonical resource model', () => {
  assert.match(buildSite, /'designer-workspace\.js','resource-manager\.js'/);
  assert.ok(sw.includes("'./resource-manager.js'"));
  assert.ok(sw.includes("'../src/studio-resources.js'"));
});
