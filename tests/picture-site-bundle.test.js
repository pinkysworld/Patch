import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const worker = fs.readFileSync('web/sw.js', 'utf8');
const parser = fs.readFileSync('src/parser.js', 'utf8');
const designer = fs.readFileSync('src/designer.js', 'utf8');
const toolbox = fs.readFileSync('web/designer-toolbox.js', 'utf8');
const pictureSource = fs.readFileSync('src/picture-source.js', 'utf8');

test('Picture display codec is part of public Studio and offline packaging contracts', () => {
  assert.match(buildSite, /'picture-control\.js'/);
  assert.match(buildSite, /'picture-source\.js'/);
  assert.match(parser, /from '\.\/picture-source\.js'/);
  assert.match(pictureSource, /from '\.\/picture-control\.js'/);
  assert.match(designer, /formatPatchPictureDeclaration/);
  assert.match(worker, /'\.\.\/src\/picture-control\.js'/);
  assert.match(worker, /'\.\.\/src\/picture-source\.js'/);
  assert.match(toolbox, /designerInspectorPictureFit/);
  assert.match(toolbox, /designerInspectorPictureProportional/);
  assert.match(toolbox, /designerInspectorPictureCenter/);
  assert.match(toolbox, /designerInspectorPictureOpacity/);
  assert.match(toolbox, /designerInspectorPictureDescription/);
  assert.match(toolbox, /fail-closes other display values/);
});
