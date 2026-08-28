import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public Studio and offline PWA package Button ImageList consumer modules', () => {
  const parser = fs.readFileSync('src/parser.js', 'utf8');
  const designer = fs.readFileSync('src/designer.js', 'utf8');
  const toolbox = fs.readFileSync('web/designer-toolbox.js', 'utf8');
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const worker = fs.readFileSync('web/sw.js', 'utf8');
  assert.match(parser, /from '\.\/button-image\.js'/);
  assert.match(designer, /from '\.\/button-image\.js'/);
  assert.match(toolbox, /installButtonImageInspector/);
  assert.match(toolbox, /designerInspectorButtonImage/);
  assert.match(playground, /patch-button-image/);
  assert.match(buildSite, /'button-image\.js'/);
  assert.match(worker, /'\.\.\/src\/button-image\.js'/);
});
