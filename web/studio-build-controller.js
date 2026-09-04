import { buildPatchApp, serializePatchApp } from '../src/bundle.js';
import { compileToWasm } from '../src/wasm.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

export const PATCH_STUDIO_BUILD_CONTROLLER_VERSION = '0.1';

export function buildStudioArtifact(target, source, options) {
  const name = String(options?.name ?? 'MyPatchApp');

  if (target === 'web') {
    const built = buildStandaloneWebApp(source, options);
    const output = built.metadata?.projectKind === 'window'
      ? `Built ${name}.html\n\nStandalone single-file Patch Window Web App. Open it directly in a modern browser. The Window UI and event logic execute through Patch's generated browser Window runtime; this target no longer routes Window projects through the Console-only Direct Wasm backend.`
      : `Built ${name}.html\n\nStandalone single-file Patch Console Web App. Open it directly in a modern browser; the direct Patch Wasm module and its tiny host are embedded in the HTML file.`;
    return Object.freeze({
      filename: `${name}.html`,
      data: built.html,
      type: 'text/html',
      ir: built.compiled.ir,
      output
    });
  }

  if (target === 'wasm-direct') {
    if (options?.kind === 'window') {
      throw new Error('Direct WebAssembly currently supports Console projects only. For a Window project choose Standalone Web App or a Windows/macOS/Linux App target.');
    }
    const built = compileToDirectWasm(source, options);
    return Object.freeze({
      filename: `${name}.direct.wasm`,
      data: built.module,
      type: 'application/wasm',
      ir: built.compiled.ir,
      output: `Built ${name}.direct.wasm\n\nThis contains directly lowered Patch Console instructions. It imports patch.show_number and patch.change_number, so use the Patch CLI host, a Console Standalone Web App, or a native Patch console host to run it.`
    });
  }

  if (target === 'wasm-bootstrap') {
    const built = compileToWasm(source, options);
    return Object.freeze({
      filename: `${name}.bootstrap.wasm`,
      data: built.module,
      type: 'application/wasm',
      ir: built.compiled.ir,
      output: `Built ${name}.bootstrap.wasm\n\nAdvanced compatibility artifact: valid Wasm carrying Patch source + Change IR for a Patch host. For a ready-to-run Window build choose Standalone Web App or a Windows/macOS/Linux App target.`
    });
  }

  if (target === 'native-info') {
    return Object.freeze({
      filename: null,
      data: null,
      type: null,
      ir: null,
      output: 'Desktop builds run through Patch\'s platform builders. Window projects use the dedicated Window application path; Console projects use the direct-Wasm console host.\n\nFrom Patch Studio choose Windows App, macOS App or Linux App and press Build.'
    });
  }

  const bundle = buildPatchApp(source, { ...options, targets: ['portable'] });
  return Object.freeze({
    filename: `${name}.patchapp`,
    data: serializePatchApp(bundle),
    type: 'application/json',
    ir: bundle.ir,
    output: `Built ${name}.patchapp\n\nPortable Patch bundle containing the manifest, source and Change IR.`
  });
}

export function installStudioBuildController(options = {}) {
  const doc = options.document ?? globalThis.document;
  const code = options.code ?? doc?.querySelector('#code');
  const buildTarget = options.buildTarget ?? doc?.querySelector('#buildTarget');
  const buildButton = options.buildButton ?? doc?.querySelector('#build');
  const output = options.output ?? doc?.querySelector('#output');
  const changesView = options.changesView ?? doc?.querySelector('#changes');
  const irView = options.irView ?? doc?.querySelector('#ir');
  const projectOptions = options.projectOptions;
  const formatChangeAnalysis = options.formatChangeAnalysis;
  const formatStudioStop = options.formatStudioStop;
  const showTab = options.showTab;

  if (!doc || !code || !buildTarget || !buildButton || !output || !changesView || !irView) return false;
  if (typeof projectOptions !== 'function' || typeof formatChangeAnalysis !== 'function' || typeof formatStudioStop !== 'function' || typeof showTab !== 'function') {
    throw new TypeError('Studio Build controller requires projectOptions, formatChangeAnalysis, formatStudioStop and showTab callbacks.');
  }

  buildButton.addEventListener('click', () => {
    try {
      const built = buildStudioArtifact(buildTarget.value, code.value, projectOptions());
      if (built.filename) downloadStudioArtifact(doc, built.filename, built.data, built.type);
      if (built.ir) {
        irView.textContent = JSON.stringify(built.ir, null, 2);
        changesView.textContent = formatChangeAnalysis(built.ir);
      }
      output.textContent = built.output;
      showTab('output');
    } catch (error) {
      output.textContent = `Build stopped:\n${formatStudioStop(error, 'build')}`;
      showTab('output');
    }
  });
  return true;
}

function downloadStudioArtifact(doc, filename, data, type) {
  const win = doc.defaultView ?? globalThis;
  const BlobCtor = win.Blob ?? globalThis.Blob;
  const URLApi = win.URL ?? globalThis.URL;
  const blob = new BlobCtor([data], { type });
  const url = URLApi.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  win.setTimeout(() => URLApi.revokeObjectURL(url), 1000);
}
