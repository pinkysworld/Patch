import { createStudioDesignSnapshotCache } from '../src/studio-design-cache.js';
import { listDesignerControlsFromAst, listDesignerWindowsFromAst } from '../src/designer.js';

export const PATCH_STUDIO_DESIGN_SNAPSHOTS_VERSION = '0.1';
export const PATCH_STUDIO_DESIGN_DESCRIPTOR_CACHE_ENTRIES = 8;

const designSnapshots = createStudioDesignSnapshotCache({ capacity: PATCH_STUDIO_DESIGN_DESCRIPTOR_CACHE_ENTRIES });
const descriptorSnapshots = new Map();
let descriptorHits = 0;
let descriptorMisses = 0;
let descriptorEvictions = 0;

/**
 * Shared browser-side source-revision service for design-time readers.
 *
 * Exact source text is the revision identity. The primary Designer and
 * specialized adapters can therefore reuse one declaration-only design model
 * and one bounded set of source descriptors without maintaining private caches.
 * Descriptor extraction delegates to the canonical AST readers in
 * src/designer.js and reuses the declaration-only design snapshot AST, so the
 * first descriptor read does not parse the same source revision again.
 */
export function getStudioDesignSnapshot(source, options = {}) {
  return designSnapshots.get(String(source ?? ''), options);
}

export function getStudioDesignerDescriptors(source) {
  const key = String(source ?? '');
  if (descriptorSnapshots.has(key)) {
    const current = descriptorSnapshots.get(key);
    descriptorSnapshots.delete(key);
    descriptorSnapshots.set(key, current);
    descriptorHits += 1;
    return current;
  }

  descriptorMisses += 1;
  const design = getStudioDesignSnapshot(key);
  const snapshot = Object.freeze({
    windows: freezeDescriptors(listDesignerWindowsFromAst(design.ast)),
    controls: freezeDescriptors(listDesignerControlsFromAst(design.ast))
  });
  descriptorSnapshots.set(key, snapshot);
  while (descriptorSnapshots.size > PATCH_STUDIO_DESIGN_DESCRIPTOR_CACHE_ENTRIES) {
    const oldest = descriptorSnapshots.keys().next().value;
    descriptorSnapshots.delete(oldest);
    descriptorEvictions += 1;
  }
  return snapshot;
}

export function getStudioDesignerWindows(source) {
  return getStudioDesignerDescriptors(source).windows;
}

export function getStudioDesignerControls(source) {
  return getStudioDesignerDescriptors(source).controls;
}

export function studioDesignSnapshotStats() {
  return Object.freeze({
    version: PATCH_STUDIO_DESIGN_SNAPSHOTS_VERSION,
    design: designSnapshots.stats(),
    descriptors: Object.freeze({
      hits: descriptorHits,
      misses: descriptorMisses,
      evictions: descriptorEvictions,
      entries: descriptorSnapshots.size,
      capacity: PATCH_STUDIO_DESIGN_DESCRIPTOR_CACHE_ENTRIES
    })
  });
}

export function clearStudioDesignSnapshots() {
  designSnapshots.clear();
  descriptorSnapshots.clear();
}

function freezeDescriptors(items) {
  return Object.freeze(items.map(item => deepFreeze(item)));
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
    return Object.freeze(value);
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
