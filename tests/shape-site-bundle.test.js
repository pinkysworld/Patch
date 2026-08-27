import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const worker = fs.readFileSync('web/sw.js', 'utf8');
const parser = fs.readFileSync('src/parser.js', 'utf8');
const shapeSource = fs.readFileSync('src/shape-source.js', 'utf8');

test('Shape parser dependencies are part of public Studio and offline packaging contracts', () => {
  assert.match(buildSite, /'shape-control\.js'/);
  assert.match(buildSite, /'shape-source\.js'/);
  assert.match(parser, /from '\.\/shape-source\.js'/);
  assert.match(shapeSource, /from '\.\/shape-control\.js'/);
  assert.match(worker, /'\.\.\/src\/shape-control\.js'/);
  assert.match(worker, /'\.\.\/src\/shape-source\.js'/);
  assert.match(buildSite, /validatePaperPrivacyBoundary\(\)/);
  assert.doesNotMatch(worker, /\.\/paper\.html/);
});
