import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioDesignSnapshotCache } from '../src/studio-design-cache.js';

test('Studio design snapshot cache reuses exact source revisions', () => {
  let builds = 0;
  const cache = createStudioDesignSnapshotCache({
    build(source) {
      builds += 1;
      return Object.freeze({ source, builds });
    }
  });
  const first = cache.get('window "One":\n  text "A"');
  const second = cache.get('window "One":\n  text "A"');
  assert.equal(first, second);
  assert.equal(builds, 1);
  assert.deepEqual(cache.stats(), { hits: 1, misses: 1, evictions: 0, entries: 1, capacity: 8 });
});

test('Studio design snapshot cache invalidates when source changes', () => {
  const cache = createStudioDesignSnapshotCache();
  const first = cache.get('window "One":\n  text "A"');
  const second = cache.get('window "One":\n  text "B"');
  assert.notEqual(first, second);
  assert.equal(cache.stats().misses, 2);
});

test('Studio design snapshot cache evicts least recently used revision', () => {
  const cache = createStudioDesignSnapshotCache({ capacity: 2 });
  const one = 'window "One":\n  text "1"';
  const two = 'window "Two":\n  text "2"';
  const three = 'window "Three":\n  text "3"';
  cache.get(one);
  cache.get(two);
  cache.get(one);
  cache.get(three);
  assert.equal(cache.has(one), true);
  assert.equal(cache.has(two), false);
  assert.equal(cache.has(three), true);
  assert.deepEqual(cache.stats(), { hits: 1, misses: 3, evictions: 1, entries: 2, capacity: 2 });
});

test('Studio design snapshot cache clear drops retained revisions without resetting diagnostics counters', () => {
  const cache = createStudioDesignSnapshotCache({ capacity: 2 });
  cache.get('window "One":\n  text "1"');
  cache.clear();
  assert.equal(cache.stats().entries, 0);
  assert.equal(cache.stats().misses, 1);
});
