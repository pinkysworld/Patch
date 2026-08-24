import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parser.js';
import { buildOutlineModel, lineSelectionRange } from '../src/studio-outline-model.js';

const html = fs.readFileSync('web/index.html', 'utf8');
const tree = fs.readFileSync('web/studio-outline.js', 'utf8');
const css = fs.readFileSync('web/studio-outline.css', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');

test('Project Tree model groups source-backed Forms, state, events and recipes', () => {
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

test('Project Tree exposes Thing records and own-field symbols from the parser model', () => {
  const source = `create thing player:
  name = "Sam"
  score = 0
`;
  const model = buildOutlineModel(parse(source));
  assert.deepEqual(model.map(group => group.key), ['state']);
  assert.deepEqual(model[0].items, [
    { kind: 'state', line: 1, label: 'player', meta: 'thing' },
    { kind: 'field', line: 2, label: 'player.name', meta: 'thing field' },
    { kind: 'field', line: 3, label: 'player.score', meta: 'thing field' }
  ]);
});

test('Project Tree exposes recipe parameters as Param symbols from the parser model', () => {
  const source = `create number score = 0
make reward(bonus number 0..5):
  change score:
    add bonus
`;
  const model = buildOutlineModel(parse(source));
  const recipes = model.find(group => group.key === 'recipes');
  assert.deepEqual(recipes.items, [
    { kind: 'recipe', line: 2, label: 'reward', meta: 'recipe' },
    { kind: 'param', line: 2, label: 'reward.bonus', meta: 'number 0..5' }
  ]);
});

test('Project Tree computes exact active-file editor line selection ranges', () => {
  const source = 'first\nsecond line\nthird';
  assert.deepEqual(lineSelectionRange(source, 2), { line: 2, start: 6, end: 17 });
  assert.deepEqual(lineSelectionRange(source, 99), { line: 3, start: 18, end: 23 });
  assert.equal(lineSelectionRange(source, 0), null);
});

test('Studio Project Tree browser module is valid JavaScript and uses the shared model', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-outline.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'src/studio-outline-model.js'], { stdio: 'pipe' });
  assert.match(tree, /studio-outline-model\.js/);
  assert.match(tree, /getStudioProjectFiles/);
  assert.match(tree, /activateStudioProjectFile/);
  assert.match(tree, /addStudioProjectFile/);
  assert.match(tree, /removeStudioProjectFile/);
  assert.match(tree, /data-project-action="file"/);
  assert.match(tree, /data-project-action="form"/);
  assert.match(tree, /Project Tree/);
});

test('Project Tree keeps build/run consumers on the composed v3 project source without replacing the visible editor source', () => {
  assert.match(tree, /getStudioProjectBuildInput/);
  assert.match(tree, /Object\.defineProperty\(code, 'value'/);
  assert.match(tree, /virtualSource \?\? descriptor\.get\.call\(this\)/);
  assert.match(tree, /event\.target\.closest\?\.\('#run, #build'\)/);
  assert.match(tree, /queueMicrotask\(\(\) => \{ virtualSource = null; \}\)/);
});

test('Studio ships an accessible responsive project tree without shrinking Designer', () => {
  for (const marker of [
    'class="source-workspace"',
    'aria-label="Project outline"',
    'id="projectOutlineTree"',
    'id="projectOutlineStatus"',
    './studio-outline.css',
    './studio-outline.js'
  ]) assert.ok(html.includes(marker), marker);

  for (const marker of [
    'grid-template-columns: minmax(210px, 270px) minmax(0, 1fr)',
    '@media (max-width: 760px)',
    '.project-outline-tree',
    '.outline-file-section.active',
    'button.outline-item:focus-visible',
    'button.outline-action:focus-visible',
    '.editor-tabs',
    '.editor-tab[aria-selected="true"]'
  ]) assert.ok(css.includes(marker), marker);

  assert.ok(html.indexOf('class="source-workspace"') < html.indexOf('class="pane result-pane"'));
});

test('Project Tree assets and shared model participate in public site revisioning and offline cache', () => {
  for (const marker of ['studio-outline.css', 'studio-outline.js', 'studio-outline-model.js']) assert.ok(buildSite.includes(marker), marker);
  for (const marker of ["'./studio-outline.css'", "'./studio-outline.js'", "'../src/studio-outline-model.js'"]) assert.ok(sw.includes(marker), marker);
});
