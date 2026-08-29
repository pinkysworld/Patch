import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioDesignSnapshotCache } from '../src/studio-design-cache.js';

const playground = fs.readFileSync('web/playground.js', 'utf8');
const siteBuilder = fs.readFileSync('scripts/build-site.js', 'utf8');
const serviceWorker = fs.readFileSync('web/sw.js', 'utf8');
const roadmap = fs.readFileSync('docs/ROADMAP.md', 'utf8');
const backlog = fs.readFileSync('docs/RAD_STUDIO_MASTER_BACKLOG.md', 'utf8');
const handoff = fs.readFileSync('docs/GPT.md', 'utf8');

test('Designer refresh consumes the declaration-only design snapshot cache', () => {
  assert.match(playground, /import \{ createStudioDesignSnapshotCache \} from '\.\.\/src\/studio-design-cache\.js';/);
  assert.match(playground, /const designerDesignCache = createStudioDesignSnapshotCache\(\);/);

  const start = playground.indexOf('function refreshDesigner(');
  const end = playground.indexOf('function scheduleDesigner()', start);
  assert.notEqual(start, -1, 'refreshDesigner must exist');
  assert.notEqual(end, -1, 'scheduleDesigner must follow refreshDesigner');
  const refresh = playground.slice(start, end);

  assert.match(refresh, /const preview = designerDesignCache\.get\(code\.value\);/);
  assert.doesNotMatch(refresh, /PatchInterpreter/);
  assert.doesNotMatch(refresh, /\.run\(code\.value\)/);
  assert.match(refresh, /renderWindows\(designerCanvas, preview\.ui, false(?:, \{ materialization \})?\)/);
});

test('Designer cache snapshot keeps initial declarations and never executes application behavior', () => {
  const cache = createStudioDesignSnapshotCache();
  const source = `create number count = 1

make bump():
  change count:
    add 50

do bump()
change count:
  add 10
repeat 3:
  change count:
    add 1

window "Design" as main size 320, 180:
  text "Count {count}" at 20, 20 size 180, 28
`;

  const first = cache.get(source);
  const second = cache.get(source);
  assert.equal(first, second, 'exact source revision should reuse one immutable design snapshot');
  assert.equal(first.state.count, 1, 'Designer must retain declared initial state instead of executed state');
  assert.equal(first.ui.length, 1);
  assert.equal(first.ui[0].title, 'Design');
  assert.ok(first.skipped.some(item => item.kind === 'call'));
  assert.ok(first.skipped.some(item => item.kind === 'change'));
  assert.ok(first.skipped.some(item => item.kind === 'repeat'));
  assert.deepEqual(cache.stats(), { hits: 1, misses: 1, evictions: 0, entries: 1, capacity: 8 });
});

test('public and Offline Studio module closure packages the design model and cache', () => {
  for (const name of ['studio-design-model.js', 'studio-design-cache.js']) {
    assert.ok(siteBuilder.includes(`'${name}'`), `site builder must package src/${name}`);
    assert.ok(serviceWorker.includes(`../src/${name}`), `offline cache must package src/${name}`);
  }
});

test('R0 status documents do not keep primary Designer integration in the open queue', () => {
  assert.match(roadmap, /primary `refreshDesigner\(\)` consumes the shared declaration-only design cache/);
  assert.match(backlog, /primary `refreshDesigner\(\)` consumes the bounded declaration-only design snapshot cache/);
  assert.match(handoff, /primary `refreshDesigner\(\)` uses the bounded declaration-only design snapshot cache/);

  const stale = [
    /\[ \] wire the non-executing design model into the primary `refreshDesigner\(\)` path/,
    /wire the design model\/cache into primary `refreshDesigner\(\)`;/
  ];
  for (const pattern of stale) {
    assert.doesNotMatch(roadmap, pattern);
    assert.doesNotMatch(backlog, pattern);
    assert.doesNotMatch(handoff, pattern);
  }
});
