import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_WINDOW_ICON_POLICY,
  PATCH_WINDOW_ICON_POLICY_ID,
  formatPatchWindowDeclaration,
  nativeWindowIconUnsupportedMessage,
  parsePatchWindowDeclaration,
  selectApplicationWindowIcon
} from '../src/window-icon.js';

test('Window declarations parse and format optional icon sources', () => {
  const parsed = parsePatchWindowDeclaration(
    'window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":'
  );
  assert.equal(parsed.titleExpr, '"Counter"');
  assert.equal(parsed.id, 'counter');
  assert.equal(parsed.width, 520);
  assert.equal(parsed.height, 360);
  assert.equal(parsed.iconExpr, '"patch-resource:app.icon"');
  assert.equal(
    formatPatchWindowDeclaration(parsed),
    'window "Counter" as counter size 520, 360 icon "patch-resource:app.icon":'
  );
});

test('Window declaration codec omits icon by default and preserves titles that mention icon', () => {
  const plain = parsePatchWindowDeclaration('window "Main" as main size 640, 420:');
  assert.equal(plain.iconExpr, null);
  assert.equal(formatPatchWindowDeclaration(plain), 'window "Main" as main size 640, 420:');

  const titled = parsePatchWindowDeclaration('window "Click icon here" as main:');
  assert.equal(titled.titleExpr, '"Click icon here"');
  assert.equal(titled.id, 'main');
  assert.equal(titled.iconExpr, null);
});

test('Window declaration codec requires width and height as one pair', () => {
  assert.throws(
    () => formatPatchWindowDeclaration({ titleExpr: '"Main"', id: 'main', width: 640, height: null }),
    /both width and height/
  );
  assert.throws(
    () => formatPatchWindowDeclaration({ titleExpr: '"Main"', id: 'main', width: null, height: 420 }),
    /both width and height/
  );
});

test('Window icon resolution prefers the first Form icon as the application icon', () => {
  const app = selectApplicationWindowIcon([
    { kind: 'window', id: 'plain', titleExpr: '"Plain"' },
    { kind: 'window', id: 'branded', titleExpr: '"Branded"', iconExpr: '"patch-resource:app.icon"', line: 6 }
  ]);
  assert.equal(app.windowId, 'branded');
  assert.equal(app.resourceId, 'app.icon');
  assert.equal(app.line, 6);
});

test('Window icon source policy advertises the promoted Current Ready native contract', () => {
  assert.equal(PATCH_WINDOW_ICON_POLICY_ID, 'window-icon/1.0');
  assert.deepEqual(PATCH_WINDOW_ICON_POLICY.currentReady, { nativeGuiIR: '1.9', payload: 19, runtime: '1.10' });
  assert.equal(PATCH_WINDOW_ICON_POLICY.native, 'current-ready');
  assert.match(PATCH_WINDOW_ICON_POLICY.reason, /Current Ready on Windows, macOS and Linux/);
});

test('legacy pre-v19 native GUI contracts report Window icons instead of silently dropping them', () => {
  assert.equal(nativeWindowIconUnsupportedMessage({ titleExpr: '"Main"' }), null);
  const diagnostic = nativeWindowIconUnsupportedMessage({ id: 'main', iconExpr: '"patch-resource:app.icon"' }, 2);
  assert.match(diagnostic, /line 2: legacy native GUI Form 'main' does not transport icon/);
  assert.match(diagnostic, /compatibility contract remains fail-closed/);
  assert.match(diagnostic, /Current Ready Native GUI IR 1\.9 \/ payload v19 \/ runtime v1\.10/);
});
