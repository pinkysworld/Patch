import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import {
  applyWindowResizePolicy,
  buildWindowLayoutPolicyManifest,
  validateWindowLayoutPolicyManifest
} from '../src/window-layout-policy.js';

test('compiler extracts parser-transparent layout policies into a separate runtime manifest', () => {
  const source = 'window "Main" as main size 640, 420:\n  # @layout anchor left right top\n  button "Save" as save at 24, 24 size 120, 36\n  # @layout dock bottom\n  text "Ready" at 24, 360 size 200, 30\n';
  const compiled = compile(source);
  assert.equal(compiled.ir.version, '0.10');
  assert.equal(compiled.windowLayoutPolicy.format, 'patch-window-layout-policy');
  assert.equal(compiled.windowLayoutPolicy.version, '0.1');
  assert.deepEqual(compiled.windowLayoutPolicy.windows[0].controls.map(item => item.policy), [
    { kind: 'anchor', edges: ['left', 'right', 'top'] },
    { kind: 'dock', side: 'bottom' }
  ]);
  assert.equal('windowLayoutPolicy' in compiled.ir, false);
  validateWindowLayoutPolicyManifest(compiled.windowLayoutPolicy);
});

test('Table participates in the same source-backed layout policy resolution as other controls', () => {
  const source = `window "Data" as main size 640, 420:
  # @layout anchor left right top bottom
  table "Name", "Role" as people at 24, 24 size 592, 330:
    row "Ada", "Engineer"
    row "Grace", "Scientist"
`;
  const compiled = compile(source);
  assert.deepEqual(compiled.windowLayoutPolicy.windows[0].controls[0].policy, {
    kind: 'anchor',
    edges: ['left', 'right', 'top', 'bottom']
  });
  assert.deepEqual(compiled.ast[0].body[0].layoutPolicy, {
    kind: 'anchor',
    edges: ['left', 'right', 'top', 'bottom']
  });
});

test('runtime anchor and dock math matches Designer resize behavior', () => {
  const layout = { x: 100, y: 60, width: 200, height: 40 };
  assert.deepEqual(
    applyWindowResizePolicy(layout, { kind: 'anchor', edges: ['right', 'bottom'] }, { deltaWidth: 80, deltaHeight: 50, width: 720, height: 470 }),
    { x: 180, y: 110, width: 200, height: 40 }
  );
  assert.deepEqual(
    applyWindowResizePolicy(layout, { kind: 'dock', side: 'fill' }, { deltaWidth: 80, deltaHeight: 50, width: 720, height: 470 }),
    { x: 0, y: 0, width: 720, height: 470 }
  );
});

test('manifest control ordering follows source-backed Form control ordering', () => {
  const source = 'window "Main" size 500, 300:\n  button "A" as a at 10, 10 size 80, 30\n  # @layout anchor right bottom\n  button "B" as b at 400, 250 size 80, 30\n';
  const compiled = compile(source);
  const manifest = buildWindowLayoutPolicyManifest(source, compiled.ast);
  assert.equal(manifest.windows[0].width, 500);
  assert.equal(manifest.windows[0].height, 300);
  assert.deepEqual(manifest.windows[0].controls[0].policy, { kind: 'fixed' });
  assert.deepEqual(manifest.windows[0].controls[1].policy, { kind: 'anchor', edges: ['right', 'bottom'] });
});
