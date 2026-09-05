import test from 'node:test';
import assert from 'node:assert/strict';
import {
  placeResourcePictureInSource,
  resourcePictureDropLayout
} from '../src/studio-resource-picture-placement.js';
import { listDesignerControls, listDesignerWindows } from '../src/designer.js';
import { formControlDefaultSize } from '../src/form-layout.js';

test('resource Picture drop layout maps and clamps Form coordinates', () => {
  const size = formControlDefaultSize('picture');
  assert.deepEqual(
    resourcePictureDropLayout(
      { clientX: 240, clientY: 180, scrollLeft: 10, scrollTop: 5 },
      { left: 100, top: 80 },
      { width: 640, height: 420 },
      size
    ),
    {
      x: 150,
      y: 105,
      width: size.width,
      height: size.height
    }
  );

  const clamped = resourcePictureDropLayout(
    { clientX: 2000, clientY: 2000 },
    { left: 0, top: 0 },
    { width: 640, height: 420 },
    size
  );
  assert.equal(clamped.x, Math.max(0, 640 - size.width));
  assert.equal(clamped.y, Math.max(0, 420 - size.height));
});

test('placing a project resource creates ordinary visible Picture source at the requested layout', () => {
  const source = `window "Assets" as assets size 640, 420:\n  button "Keep" as keep at 24, 24 size 100, 32\n`;
  const placed = placeResourcePictureInSource(source, 'image.logo', {
    windowIndex: 0,
    layout: { x: 180, y: 90, width: 200, height: 140 }
  });
  const picture = listDesignerControls(placed.source).find(control => control.type === 'picture');
  assert.ok(picture);
  assert.equal(picture.sourceExpr, '"patch-resource:image.logo"');
  assert.deepEqual(
    { x: picture.x, y: picture.y, width: picture.width, height: picture.height },
    { x: 180, y: 90, width: 200, height: 140 }
  );
  assert.match(placed.source, /picture\s+as\s+picture_1\s+from\s+"patch-resource:image\.logo"\s+at\s+180,\s*90\s+size\s+200,\s*140/);
});

test('explicit resource drops do not keep temporary auto-placement Form growth, including at an edge', () => {
  const source = `window "Assets" as assets size 640, 420:\n  button "Low" as low at 24, 350 size 100, 32\n`;
  const size = formControlDefaultSize('picture');
  for (const layout of [
    { x: 40, y: 40, width: size.width, height: size.height },
    { x: 640 - size.width, y: 420 - size.height, width: size.width, height: size.height }
  ]) {
    const placed = placeResourcePictureInSource(source, 'image.small', { windowIndex: 0, layout });
    const form = listDesignerWindows(placed.source)[0];
    assert.equal(form.width, 640);
    assert.equal(form.height, 420);
  }
});

test('Resource Manager exposes drag and keyboard/touch placement affordances through the shared placement model', async () => {
  const fs = await import('node:fs');
  const manager = fs.readFileSync(new URL('../web/resource-manager.js', import.meta.url), 'utf8');
  assert.match(manager, /studio-resource-picture-placement\.js/);
  assert.match(manager, /application\/x-patch-studio-resource/);
  assert.match(manager, /row\.draggable\s*=\s*true/);
  assert.match(manager, /Place on Form/);
  assert.match(manager, /installDesignerResourceDropTarget\(\)/);
  assert.match(manager, /dialog\?\.show\?\.\(\)/);
  assert.match(manager, /dialog\?\.showModal\?\.\(\)/);
});
