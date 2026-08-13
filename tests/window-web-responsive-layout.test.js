import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStandaloneWebApp } from '../src/webapp.js';

test('standalone Window Web app embeds runtime anchor and dock policies', () => {
  const source = 'window "Main" as main size 640, 420:\n  # @layout anchor left right top\n  button "Save" as save at 24, 24 size 120, 36\n  # @layout dock bottom\n  text "Ready" at 24, 360 size 200, 30\n';
  const built = buildStandaloneWebApp(source, { name: 'ResponsiveApp', kind: 'window' });
  assert.equal(built.metadata.formLayoutVersion, '0.1');
  assert.equal(built.metadata.windowLayoutPolicyVersion, '0.1');
  assert.match(built.html, /const PATCH_WINDOW_LAYOUT_POLICY=/);
  assert.match(built.html, /"kind":"anchor","edges":\["left","right","top"\]/);
  assert.match(built.html, /"kind":"dock","side":"bottom"/);
});

test('standalone Window Web runtime observes actual Form resizing without cumulative geometry drift', () => {
  const source = 'window "Main" size 500, 300:\n  # @layout anchor right bottom\n  button "Move" as move at 390, 250 size 90, 30\n';
  const { html } = buildStandaloneWebApp(source, { kind: 'window' });
  assert.match(html, /shell\.style\.resize='both'/);
  assert.match(html, /new ResizeObserver\(\(\)=>patchApplyFormLayout\(\)\)/);
  assert.match(html, /const dw=size\.width-size\.baseWidth/);
  assert.match(html, /const dh=size\.height-size\.baseHeight/);
  assert.match(html, /PATCH_WINDOW_RUNTIME_SIZES=new Map\(\)/);
  assert.match(html, /PATCH_WINDOW_RUNTIME_SIZES\.get\(index\)/);
});

test('runtime resize keeps semantic Change IR untouched', () => {
  const source = 'window "Main" size 500, 300:\n  # @layout dock fill\n  text "Fill" at 10, 10 size 100, 30\n';
  const built = buildStandaloneWebApp(source, { kind: 'window' });
  assert.equal(built.compiled.ir.version, '0.10');
  assert.equal('windowLayoutPolicy' in built.compiled.ir, false);
  assert.equal(built.compiled.windowLayoutPolicy.windows[0].controls[0].policy.kind, 'dock');
});
