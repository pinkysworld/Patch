import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildCompiledWindowArtifact } from '../src/window-compiled.js';

function compileWindow(source, name = 'CurrentSurface') {
  return compile(source, { name, kind: 'window', entry: 'main.patch' });
}

test('compiled Window artifact accepts current target-neutral RAD controls', () => {
  const source = `create number slider_value = 5
window "Current surface" as main size 640, 480:
  tree as tree1 at 20, 20 size 180, 160:
    node "Root"
      node "Child"
  slider 0..10 as slider_value step 1 at 220, 20 size 200, 36
  paintbox as canvas at 20, 210 size 220, 120
  imagelist as icons size 16, 16:
    image ok from "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg=="
  button "OK" as ok_button image icons.ok at 260, 210 size 120, 36
when tree1 changed:
  show value
when slider_value changed:
  change slider_value:
    set = value
when canvas paint:
  draw clear #ffffff
  draw text "Ready" at 10, 20 color #111111
`;
  const artifact = buildCompiledWindowArtifact(compileWindow(source));
  assert.equal(artifact.format, 'patch-compiled-window-program');
  assert.equal(artifact.project.kind, 'window');
  assert.equal(artifact.formLayout.windows.length, 1);
});

test('Workshop Desk can be emitted as a compiled Window artifact', () => {
  const source = fs.readFileSync(new URL('../examples/workshop-desk.patch', import.meta.url), 'utf8');
  const artifact = buildCompiledWindowArtifact(compileWindow(source, 'WorkshopDesk'));
  assert.equal(artifact.project.kind, 'window');
  assert.equal(artifact.formLayout.windows.length, 3);
});
