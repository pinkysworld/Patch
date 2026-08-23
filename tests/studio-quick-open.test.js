import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudioQuickOpenItems,
  fuzzyQuickOpenScore,
  rankStudioQuickOpenItems
} from '../web/studio-quick-open.js';

const files = [
  {
    path: 'main.patch',
    content: `create number score = 0

window "Counter" as main:
  text "Score: {score}"

when add_button clicked:
  change score:
    add 1

make reward(player, bonus number 0..10):
  show bonus`
  },
  {
    path: 'forms/settings.patch',
    content: `window "Settings" as settings:
  text "Settings"`
  }
];

test('quick open derives transient file and symbol entries from current project files', () => {
  const items = buildStudioQuickOpenItems(files);
  const fileItems = items.filter(item => item.type === 'file');
  const symbols = items.filter(item => item.type === 'symbol');

  assert.deepEqual(fileItems.map(item => item.file), ['main.patch', 'forms/settings.patch']);
  assert.ok(symbols.some(item => item.file === 'main.patch' && item.label === 'score' && item.symbolKind === 'state' && item.line === 1));
  assert.ok(symbols.some(item => item.file === 'main.patch' && item.label === 'main' && item.symbolKind === 'window'));
  assert.ok(symbols.some(item => item.file === 'main.patch' && item.label === 'add_button' && item.symbolKind === 'event'));
  assert.ok(symbols.some(item => item.file === 'main.patch' && item.label === 'reward' && item.symbolKind === 'recipe'));
  assert.ok(symbols.some(item => item.file === 'forms/settings.patch' && item.label === 'settings' && item.symbolKind === 'window'));
});

test('invalid source keeps its file entry without inventing stale symbol state', () => {
  const items = buildStudioQuickOpenItems([{ path: 'broken.patch', content: 'this is not Patch syntax' }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'file');
  assert.equal(items[0].file, 'broken.patch');
});

test('fuzzy ranking prefers direct and boundary matches while preserving usable subsequence search', () => {
  assert.ok(fuzzyQuickOpenScore('forms/settings.patch', 'settings') > fuzzyQuickOpenScore('forms/settings.patch', 'stg'));
  assert.ok(fuzzyQuickOpenScore('reward recipe main.patch', 'reward') > fuzzyQuickOpenScore('reward recipe main.patch', 'rwd'));
  assert.equal(fuzzyQuickOpenScore('main.patch', 'xyz'), -1);

  const items = buildStudioQuickOpenItems(files);
  const settings = rankStudioQuickOpenItems(items, 'settings');
  assert.equal(settings[0].file, 'forms/settings.patch');

  const reward = rankStudioQuickOpenItems(items, 'reward');
  assert.equal(reward[0].label, 'reward');
  assert.equal(reward[0].type, 'symbol');

  const scoped = rankStudioQuickOpenItems(items, 'settings form');
  assert.ok(scoped.length > 0);
  assert.equal(scoped[0].file, 'forms/settings.patch');
});

test('quick-open model contains no persistence or secondary project index', () => {
  const source = buildStudioQuickOpenItems.toString() + rankStudioQuickOpenItems.toString();
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});
