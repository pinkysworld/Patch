import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import {
  listDesignerControls,
  listDesignerControlsFromAst,
  listDesignerWindows,
  listDesignerWindowsFromAst
} from '../src/designer.js';

const designerSource = fs.readFileSync('src/designer.js', 'utf8');
const snapshotService = fs.readFileSync('web/studio-design-snapshots.js', 'utf8');

for (const fixture of ['examples/counter-window.patch', 'examples/workshop-desk.patch']) {
  test(`AST Designer descriptors preserve canonical source-reader output for ${fixture}`, () => {
    const source = fs.readFileSync(fixture, 'utf8');
    const ast = parse(source);
    assert.deepEqual(listDesignerWindowsFromAst(ast), listDesignerWindows(source));
    assert.deepEqual(listDesignerControlsFromAst(ast), listDesignerControls(source));
  });
}

test('canonical source readers delegate to the AST descriptor readers', () => {
  assert.match(designerSource, /return listDesignerWindowsFromAst\(parse\(source\)\);/);
  assert.match(designerSource, /return listDesignerControlsFromAst\(parse\(source\)\);/);
});

test('shared Studio descriptor service derives first-read descriptors from the cached design AST', () => {
  assert.match(snapshotService, /listDesignerControlsFromAst/);
  assert.match(snapshotService, /listDesignerWindowsFromAst/);
  assert.match(snapshotService, /const design = getStudioDesignSnapshot\(key\);/);
  assert.match(snapshotService, /listDesignerWindowsFromAst\(design\.ast\)/);
  assert.match(snapshotService, /listDesignerControlsFromAst\(design\.ast\)/);
  assert.doesNotMatch(snapshotService, /\blistDesignerWindows\(key\)/);
  assert.doesNotMatch(snapshotService, /\blistDesignerControls\(key\)/);
});
