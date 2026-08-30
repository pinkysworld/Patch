import { buildStudioDesignModel } from './studio-design-model.js?v=868f0784ca7f3972';

export const PATCH_STUDIO_DESIGN_CACHE_VERSION = '0.1';
export const PATCH_STUDIO_DESIGN_CACHE_DEFAULT_ENTRIES = 8;
export const PATCH_STUDIO_DESIGN_CACHE_MAX_ENTRIES = 32;

/**
 * Bounded source-revision cache for Studio design snapshots.
 *
 * The source string itself is the revision identity. That keeps the browser
 * implementation dependency-free and guarantees exact invalidation. Capacity
 * is intentionally small because snapshots retain AST and UI model objects.
 */
export function createStudioDesignSnapshotCache(options = {}) {
  const capacity = normalizeCapacity(options.capacity);
  const build = typeof options.build === 'function' ? options.build : buildStudioDesignModel;
  const entries = new Map();
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  return Object.freeze({
    version: PATCH_STUDIO_DESIGN_CACHE_VERSION,
    capacity,
    get(source, buildOptions = {}) {
      const key = String(source ?? '');
      if (entries.has(key)) {
        const snapshot = entries.get(key);
        entries.delete(key);
        entries.set(key, snapshot);
        hits += 1;
        return snapshot;
      }
      misses += 1;
      const snapshot = build(key, buildOptions);
      entries.set(key, snapshot);
      while (entries.size > capacity) {
        const oldest = entries.keys().next().value;
        entries.delete(oldest);
        evictions += 1;
      }
      return snapshot;
    },
    has(source) {
      return entries.has(String(source ?? ''));
    },
    clear() {
      entries.clear();
    },
    stats() {
      return Object.freeze({ hits, misses, evictions, entries: entries.size, capacity });
    }
  });
}

function normalizeCapacity(value) {
  if (value === undefined || value === null) return PATCH_STUDIO_DESIGN_CACHE_DEFAULT_ENTRIES;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > PATCH_STUDIO_DESIGN_CACHE_MAX_ENTRIES) {
    throw new RangeError(`Studio design cache capacity must be a whole number from 1 to ${PATCH_STUDIO_DESIGN_CACHE_MAX_ENTRIES}.`);
  }
  return number;
}
