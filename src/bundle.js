import { compile } from './compiler.js';

export const PATCHAPP_VERSION = '0.1';

export function buildPatchApp(source, options = {}) {
  const compiled = compile(source, options);
  return {
    format: 'patchapp',
    version: PATCHAPP_VERSION,
    manifest: {
      name: compiled.project.name,
      kind: compiled.project.kind,
      entry: compiled.project.entry,
      patchLanguage: '0.2',
      capabilities: compiled.ir.capabilities,
      targets: options.targets ?? ['portable']
    },
    source: {
      [compiled.project.entry]: source
    },
    ir: compiled.ir,
    assets: {}
  };
}

export function serializePatchApp(bundle) {
  return JSON.stringify(bundle, null, 2) + '\n';
}

export function parsePatchApp(text) {
  const bundle = JSON.parse(text);
  if (bundle?.format !== 'patchapp') throw new Error('This file is not a Patch application bundle.');
  return bundle;
}
