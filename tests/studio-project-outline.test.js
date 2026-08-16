import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from '../src/parser.js';
import { buildOutlineModel, lineSelectionRange } from '../web/studio-outline.js';

const html = fs.readFileSync('web/index.html', 'utf8');
const css = fs.readFileSync('web/studio-outline.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');

test('Project Outline groups source-backed Forms, state, events and recipes', () => {
  const source = `create number score = 0
window "Main" as main:
  text "Score"
  button "Add" as add

when add clicked:
  change score:
    add 1`;
  const ast = parse(source);
  ast.push({ kind: 'recipe', name: 'recalculate', line: 9 });
  const model = buildOutlineModel(ast);

  assert.deepEqual(model.map(group => group.key), ['forms', 'state', 'events', 'recipes']);
  assert.deepEqual(model[0].items[0], { kind: 'window', line: 2, label: 'main', meta: 'Main' });
  assert.deepEqual(model[1].items[0], { kind: 'state', line: 1, label: 'score', meta: 'number' });
  assert.deepEqual(model[2].items[0], { kind: 'event', line: 6, label: 'add', meta: 'clicked' });
  assert.deepEqual(model[3].items[0], { kind: 'recipe', line: 9, label: 'recalculate', meta: 'recipe' });
});

test('Project Outline computes exact editor line selection ranges', () => {
  const source = 'first\nsecond line\nthird';
  assert.deepEqual(lineSelectionRange(source, 2), { line: 2, start: 6, end: 17 });
  assert.deepEqual(lineSelectionRange(source, 99), { line: 3, start: 18, end: 23 });
  assert.equal(lineSelectionRange(source, 0), null);
});

test('Studio ships an accessible responsive outline without shrinking Designer', () => {
  for (const marker of [
    'class="source-workspace"',
    'aria-label="Project outline"',
    'id="projectOutlineTree"',
    'id="projectOutlineStatus"',
    './studio-outline.css',
    './studio-outline.js'
  ]) assert.ok(html.includes(marker), marker);

  for (const marker of [
    'grid-template-columns: minmax(190px, 230px) minmax(0, 1fr)',
    '@media (max-width: 760px)',
    '.project-outline-tree',
    'button.outline-item:focus-visible'
  ]) assert.ok(css.includes(marker), marker);

  assert.ok(html.indexOf('class="source-workspace"') < html.indexOf('class="pane result-pane"'));
});

test('Project Outline assets participate in public site revisioning and offline cache', () => {
  for (const marker of ['studio-outline.css', 'studio-outline.js']) assert.ok(buildSite.includes(marker), marker);
  for (const marker of ["'./studio-outline.css'", "'./studio-outline.js'"]) assert.ok(sw.includes(marker), marker);
});
