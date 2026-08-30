import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';
import { buildCompiledWindowArtifact } from '../src/window-compiled.js';

const source = fs.readFileSync('examples/workshop-desk.patch', 'utf8');

test('compiled Window artifact does not discard target capabilities after preflight', () => {
  const compiled = compile(source, { name: 'WorkshopDesk', kind: 'window', entry: 'main.patch' });

  const support = validateWindowRuntimeSupport(compiled, {
    allowTables: true,
    allowLists: true,
    allowListControls: true,
    allowMenuDecorations: true,
    allowTree: true,
    allowSlider: true,
    allowPaintBox: true
  });

  assert.equal(support.treeViews, 2);
  assert.equal(support.sliders, 4);
  assert.equal(support.paintboxes, 1);

  const artifact = buildCompiledWindowArtifact(compiled);
  assert.equal(artifact.format, 'patch-compiled-window-program');
  assert.equal(artifact.project.kind, 'window');
  assert.equal(artifact.formLayout.windows.length, 6);
});

test('legacy runtime capability validation remains fail-closed when TreeView is not enabled', () => {
  const compiled = compile(source, { name: 'WorkshopDesk', kind: 'window', entry: 'main.patch' });
  assert.throws(
    () => validateWindowRuntimeSupport(compiled, {
      allowTables: true,
      allowLists: true,
      allowListControls: true,
      allowMenuDecorations: true,
      allowSlider: true,
      allowPaintBox: true
    }),
    /TreeView is not enabled for this Window target/
  );
});
