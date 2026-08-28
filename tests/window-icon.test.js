import test from 'node:test';
import assert from 'node:assert/strict';
import {
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

test('Window icon resolution prefers the first Form icon as the application icon', () => {
  const app = selectApplicationWindowIcon([
    { kind: 'window', id: 'plain', titleExpr: '"Plain"' },
    { kind: 'window', id: 'branded', titleExpr: '"Branded"', iconExpr: '"patch-resource:app.icon"', line: 6 }
  ]);
  assert.equal(app.windowId, 'branded');
  assert.equal(app.resourceId, 'app.icon');
  assert.equal(app.line, 6);
});

test('native GUI 1.4 reports Window icons instead of silently dropping them', () => {
  assert.equal(nativeWindowIconUnsupportedMessage({ titleExpr: '"Main"' }), null);
  assert.match(
    nativeWindowIconUnsupportedMessage({ id: 'main', iconExpr: '"patch-resource:app.icon"' }, 2),
    /line 2: native GUI 1\.4 Form 'main' does not transport icon/
  );
  assert.match(
    nativeWindowIconUnsupportedMessage({ id: 'main', iconExpr: '"patch-resource:app.icon"' }, 2),
    PATCH_WINDOW_ICON_POLICY_ID === 'window-icon/1.0' ? /fail-closed/ : /./
  );
});
