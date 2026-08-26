import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDesignerControl,
  listDesignerControls,
  updateDesignerControl
} from '../src/designer.js';
import { compile } from '../src/compiler.js';

test('Designer can add Picture with the canonical default geometry', () => {
  const source = `window "Gallery" as form_1 size 640, 420:\n  text "Title"\n`;
  const next = addDesignerControl(source, 'picture', { windowIndex: 0 });
  const picture = listDesignerControls(next).find(control => control.type === 'picture');

  assert.ok(picture);
  assert.equal(picture.id, 'picture_1');
  assert.equal(picture.sourceExpr, null);
  assert.deepEqual(
    { x: picture.x, y: picture.y, width: picture.width, height: picture.height },
    { x: 24, y: 66, width: 180, height: 120 }
  );
  assert.match(next, /picture as picture_1 at 24, 66 size 180, 120/);
  assert.doesNotThrow(() => compile(next, { name: 'PictureDesignerAdd' }));
});

test('Designer can edit Picture name, source expression and geometry without hidden form state', () => {
  const source = `window "Gallery" as form_1 size 640, 420:\n  picture as picture_1 at 24, 24 size 180, 120\n\nwhen picture_1 clicked:\n  show "clicked"\n`;
  const picture = listDesignerControls(source)[0];
  const next = updateDesignerControl(source, picture, {
    id: 'hero_image',
    sourceExpr: '"images/hero.png"',
    x: 40,
    y: 50,
    width: 320,
    height: 180
  });
  const updated = listDesignerControls(next)[0];

  assert.equal(updated.id, 'hero_image');
  assert.equal(updated.sourceExpr, '"images/hero.png"');
  assert.deepEqual(
    { x: updated.x, y: updated.y, width: updated.width, height: updated.height },
    { x: 40, y: 50, width: 320, height: 180 }
  );
  assert.match(next, /picture as hero_image from "images\/hero\.png" at 40, 50 size 320, 180/);
  assert.match(next, /when hero_image clicked:/);
  assert.doesNotThrow(() => compile(next, { name: 'PictureDesignerEdit' }));
});

test('clearing Picture source returns to a source-less Picture declaration', () => {
  const source = `window "Gallery":\n  picture as logo from "logo.png" at 10, 20 size 180, 120\n`;
  const picture = listDesignerControls(source)[0];
  const next = updateDesignerControl(source, picture, { sourceExpr: '' });
  const updated = listDesignerControls(next)[0];

  assert.equal(updated.sourceExpr, null);
  assert.match(next, /picture as logo at 10, 20 size 180, 120/);
  assert.doesNotMatch(next, /from\s+/);
});

test('legacy text-form Picture remains stable when only its layout changes', () => {
  const source = `window "Legacy":\n  picture "Preview" as preview at 10, 20 size 180, 120\n`;
  const picture = listDesignerControls(source)[0];
  const next = updateDesignerControl(source, picture, { x: 12, y: 24 });

  assert.match(next, /picture "Preview" as preview at 12, 24 size 180, 120/);
  assert.doesNotThrow(() => compile(next, { name: 'LegacyPictureDesigner' }));
});
