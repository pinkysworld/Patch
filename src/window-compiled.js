import { buildFormLayoutManifest } from './form-layout.js';
import { validateWindowBuild } from './window-build.js';

export const PATCH_COMPILED_WINDOW_VERSION = '0.2';
export const PATCH_COMPILED_WINDOW_FORMAT = 'patch-compiled-window-program';
export const PATCH_COMPILED_WINDOW_IR_VERSION = '0.10';

export class CompiledWindowError extends Error {}

export function buildCompiledWindowArtifact(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new CompiledWindowError('A compiled Patch program is required for a Window artifact.');
  }
  if (compiled.project?.kind !== 'window') {
    throw new CompiledWindowError('Compiled Window artifacts can only be built from Window projects.');
  }
  if (compiled.ir?.version !== PATCH_COMPILED_WINDOW_IR_VERSION) {
    throw new CompiledWindowError(`Compiled Window artifacts require Change IR ${PATCH_COMPILED_WINDOW_IR_VERSION}.`);
  }

  // A compiled Window artifact is target-neutral. Platform/runtime capability
  // validation belongs to the selected build target and is performed by the
  // caller before packaging. Re-running validateWindowRuntimeSupport() here
  // without the caller's versioned capability set used to reject valid modern
  // TreeView/Slider/PaintBox projects after they had already passed preflight.
  validateWindowBuild(compiled);

  const windows = compiled.ast.filter(node => node.kind === 'window');
  if (!windows.length) throw new CompiledWindowError('A Window artifact needs at least one Patch window.');

  return {
    format: PATCH_COMPILED_WINDOW_FORMAT,
    version: PATCH_COMPILED_WINDOW_VERSION,
    irVersion: PATCH_COMPILED_WINDOW_IR_VERSION,
    project: {
      name: compiled.project?.name ?? 'PatchApp',
      kind: 'window',
      entry: compiled.project?.entry ?? 'main.patch'
    },
    program: structuredClone(compiled.ast),
    formLayout: buildFormLayoutManifest(compiled.ast)
  };
}

export function validateCompiledWindowArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') throw new CompiledWindowError('Compiled Window artifact must be an object.');
  if (artifact.format !== PATCH_COMPILED_WINDOW_FORMAT) throw new CompiledWindowError('Compiled Window artifact format is unsupported.');
  if (artifact.version !== PATCH_COMPILED_WINDOW_VERSION) throw new CompiledWindowError(`Compiled Window artifact version '${artifact.version ?? '?'}' is unsupported.`);
  if (artifact.irVersion !== PATCH_COMPILED_WINDOW_IR_VERSION) {
    throw new CompiledWindowError(`Compiled Window artifact requires Change IR ${PATCH_COMPILED_WINDOW_IR_VERSION}.`);
  }
  if (artifact.project?.kind !== 'window') throw new CompiledWindowError('Compiled Window artifact project kind must be window.');
  if (!Array.isArray(artifact.program)) throw new CompiledWindowError('Compiled Window artifact program is missing.');
  const windowCount = artifact.program.filter(node => node?.kind === 'window').length;
  if (!windowCount) throw new CompiledWindowError('Compiled Window artifact contains no Patch window.');
  if (artifact.formLayout?.format !== 'patch-source-backed-form-layout' || !Array.isArray(artifact.formLayout.windows)) {
    throw new CompiledWindowError('Compiled Window artifact Form layout is invalid.');
  }
  if (artifact.formLayout.windows.length !== windowCount) {
    throw new CompiledWindowError('Compiled Window artifact Form layout does not match its executable Window program.');
  }
  return artifact;
}

/** Execute an already-compiled Patch Window program without reparsing source. */
export function runCompiledWindow(runtime, artifact, { reset = true } = {}) {
  validateCompiledWindowArtifact(artifact);
  if (!runtime || typeof runtime.executeBlock !== 'function' || typeof runtime.result !== 'function') {
    throw new CompiledWindowError('A Patch Window runtime is required.');
  }
  if (reset) runtime.reset();
  else runtime.output = [];
  runtime.executeBlock(artifact.program, {});
  return runtime.result();
}
