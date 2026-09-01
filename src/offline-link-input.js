import fs from 'node:fs';
import path from 'node:path';
import {
  PATCH_STUDIO_PROJECT_FORMAT,
  composeStudioProjectSource,
  parseStudioProjectBundle
} from './studio-project.js';

export class OfflineLinkInputError extends Error {
  constructor(message, code = 'OFFLINE_LINK_INPUT') {
    super(message);
    this.name = 'OfflineLinkInputError';
    this.code = code;
  }
}

/**
 * Read either ordinary Patch source or a Patch Studio project-v4 bundle.
 *
 * Project bundles are the only offline link input that can carry binary
 * project resources. They reuse Studio's existing bounded resource validation
 * and never introduce a second resource manifest or network lookup path.
 */
export function readOfflineLinkInput(filePath) {
  const file = path.resolve(String(filePath ?? ''));
  if (!filePath || !fs.existsSync(file)) {
    throw new OfflineLinkInputError(`Patch link input is missing: ${filePath || '?'}.`, 'OFFLINE_LINK_INPUT_MISSING');
  }
  const text = fs.readFileSync(file, 'utf8');
  const extension = path.extname(file).toLowerCase();
  const projectCandidate = extension === '.patchproject' || hasProjectBundleMarker(text);

  if (!projectCandidate) {
    return Object.freeze({
      format: 'patch-source',
      source: text,
      name: null,
      entry: path.basename(file),
      resources: Object.freeze([]),
      project: null
    });
  }

  let bundle;
  try {
    bundle = parseStudioProjectBundle(text);
  } catch (error) {
    throw new OfflineLinkInputError(
      `Patch Studio project link input is invalid: ${error?.message ?? String(error)}`,
      error?.code ?? 'OFFLINE_LINK_PROJECT_INVALID'
    );
  }
  const composition = composeStudioProjectSource(bundle);
  return Object.freeze({
    format: PATCH_STUDIO_PROJECT_FORMAT,
    source: composition.source,
    name: bundle.project.name,
    entry: bundle.project.entry,
    resources: Object.freeze(bundle.resources.map(resource => Object.freeze({ ...resource }))),
    project: bundle
  });
}

function hasProjectBundleMarker(text) {
  const trimmed = String(text ?? '').trimStart();
  if (!trimmed.startsWith('{')) return false;
  try {
    const value = JSON.parse(trimmed);
    return value?.format === PATCH_STUDIO_PROJECT_FORMAT;
  } catch {
    return false;
  }
}
