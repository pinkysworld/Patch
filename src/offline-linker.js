import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile } from './compiler.js';
import { compileToDirectWasm } from './wasm-direct.js';
import { compileToC99 } from './c99.js';
import { validateWindowRuntimeSupport } from './window-build.js';
import { buildFrozenNativeGuiIR, sealFrozenNativeGuiRuntime } from './native-frozen-contract.js';
import { buildCurrentNativeGuiIR, sealCurrentNativeGuiRuntime } from './native-current-contract.js';
import { sealConsoleRuntimeBinary } from './prebuilt-native.js';

export const PATCH_OFFLINE_LINKER_VERSION = '0.1';

export class OfflineLinkError extends Error {}

export function createOfflineLinkPlan(source, options = {}) {
  const platform = normalizePlatform(options.platform ?? process.platform);
  const name = safeName(options.name ?? 'PatchApp');
  const entry = options.entry ?? 'main.patch';
  const compiled = compile(String(source ?? ''), { name, entry });
  const kind = compiled.project.kind === 'window' ? 'window' : 'console';

  if (platform === 'freebsd') {
    if (kind !== 'console') throw new OfflineLinkError('FreeBSD offline linking currently supports Console projects only.');
    const c99 = compileToC99(String(source ?? ''), { name, kind: 'console', entry });
    return {
      format: 'patch-offline-link-plan',
      version: PATCH_OFFLINE_LINKER_VERSION,
      platform,
      kind,
      name,
      outputKind: 'FreeBSD native executable via portable C99',
      suggestedOutput: fileStem(name),
      cSource: c99.source,
      files: []
    };
  }

  if (kind === 'console') {
    const direct = compileToDirectWasm(String(source ?? ''), { name, kind: 'console', entry });
    if (platform === 'macos' && !options.consoleRuntime && options.nodeRuntime) {
      return macNodeConsolePlan({ name, module: direct.module, nodeRuntime: requiredRuntime(options.nodeRuntime, 'macOS embedded Node') });
    }
    const runtime = requiredRuntime(options.consoleRuntime, `${platform} Console`);
    const sealed = sealConsoleRuntimeBinary(runtime, { name, wasm: direct.module });
    return binaryPlan({ platform, kind, name, sealed });
  }

  const guiPayloadVersion = normalizeGuiPayloadVersion(options.guiPayloadVersion ?? 17);
  validateWindowRuntimeSupport(compiled, {
    allowTables: true,
    allowLists: true,
    allowListControls: true,
    allowMenuDecorations: true,
    allowTree: true,
    allowSlider: guiPayloadVersion === 17,
    allowPaintBox: guiPayloadVersion === 17
  });
  const nativeGui = guiPayloadVersion === 17
    ? buildCurrentNativeGuiIR(compiled)
    : buildFrozenNativeGuiIR(compiled);
  const runtime = requiredRuntime(options.guiRuntime, `${platform} Window`);
  const sealed = guiPayloadVersion === 12
    ? sealFrozenNativeGuiRuntime(runtime, nativeGui, { platform })
    : sealCurrentNativeGuiRuntime(runtime, nativeGui, { platform });
  return binaryPlan({ platform, kind, name, sealed });
}

export function materializeOfflineLinkPlan(plan, options = {}) {
  if (!plan || plan.format !== 'patch-offline-link-plan' || plan.version !== PATCH_OFFLINE_LINKER_VERSION) {
    throw new OfflineLinkError('Unsupported offline link plan.');
  }

  if (plan.platform === 'freebsd') return materializeFreeBsd(plan, options);

  if (plan.platform === 'macos') {
    const appPath = ensureMacApp(options.out ?? plan.suggestedOutput);
    fs.rmSync(appPath, { recursive: true, force: true });
    for (const file of plan.files) {
      const target = path.join(appPath, ...file.path.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.bytes);
      if (file.mode) fs.chmodSync(target, file.mode);
    }
    return { ...plan, output: appPath };
  }

  const output = normalizeBinaryOutput(options.out ?? plan.suggestedOutput, plan.platform);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, plan.files[0].bytes);
  if (plan.platform !== 'windows') fs.chmodSync(output, 0o755);
  return { ...plan, output };
}

export function linkPatchSource(source, options = {}) {
  const plan = createOfflineLinkPlan(source, options);
  return materializeOfflineLinkPlan(plan, options);
}

function binaryPlan({ platform, kind, name, sealed }) {
  const stem = fileStem(name);
  if (platform === 'windows') {
    return {
      format: 'patch-offline-link-plan', version: PATCH_OFFLINE_LINKER_VERSION,
      platform, kind, name, outputKind: 'Windows executable', suggestedOutput: `${stem}.exe`,
      files: [{ path: `${stem}.exe`, bytes: sealed, mode: 0o755 }]
    };
  }
  if (platform === 'linux') {
    return {
      format: 'patch-offline-link-plan', version: PATCH_OFFLINE_LINKER_VERSION,
      platform, kind, name, outputKind: 'Linux executable', suggestedOutput: stem,
      files: [{ path: stem, bytes: sealed, mode: 0o755 }]
    };
  }
  if (platform === 'macos') {
    return {
      format: 'patch-offline-link-plan', version: PATCH_OFFLINE_LINKER_VERSION,
      platform, kind, name, outputKind: 'macOS .app bundle', suggestedOutput: `${stem}.app`,
      files: [
        { path: `Contents/MacOS/${stem}`, bytes: sealed, mode: 0o755 },
        { path: 'Contents/Info.plist', bytes: textBytes(macInfoPlist(name, stem)), mode: 0o644 },
        { path: 'Contents/PkgInfo', bytes: textBytes('APPL????'), mode: 0o644 }
      ]
    };
  }
  throw new OfflineLinkError(`Unsupported offline link platform '${platform}'.`);
}

function macNodeConsolePlan({ name, module, nodeRuntime }) {
  const stem = fileStem(name);
  const launcher = `#!/bin/sh\nset -eu\nDIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$DIR/../Resources/node" "$DIR/../Resources/run.cjs" "$@"\n`;
  const runner = `'use strict';\nconst fs=require('node:fs');\nconst path=require('node:path');\n(async()=>{\n  const wasm=fs.readFileSync(path.join(__dirname,'app.wasm'));\n  const instantiated=await WebAssembly.instantiate(wasm,{patch:{show_number(value){process.stdout.write(String(value)+'\\n');},change_number(){}}});\n  const instance=instantiated.instance||instantiated;\n  instance.exports.run();\n})().catch(error=>{console.error('Patch app stopped: '+(error?.stack||error?.message||String(error)));process.exitCode=2;});\n`;
  return {
    format: 'patch-offline-link-plan', version: PATCH_OFFLINE_LINKER_VERSION,
    platform: 'macos', kind: 'console', name,
    outputKind: 'macOS portable Console .app bundle', suggestedOutput: `${stem}.app`,
    files: [
      { path: `Contents/MacOS/${stem}`, bytes: textBytes(launcher), mode: 0o755 },
      { path: 'Contents/Resources/node', bytes: nodeRuntime, mode: 0o755 },
      { path: 'Contents/Resources/run.cjs', bytes: textBytes(runner), mode: 0o644 },
      { path: 'Contents/Resources/app.wasm', bytes: module, mode: 0o644 },
      { path: 'Contents/Info.plist', bytes: textBytes(macInfoPlist(name, stem)), mode: 0o644 },
      { path: 'Contents/PkgInfo', bytes: textBytes('APPL????'), mode: 0o644 }
    ]
  };
}

function materializeFreeBsd(plan, options) {
  if (process.platform !== 'freebsd' && options.allowHostCCompiler !== true) {
    throw new OfflineLinkError('FreeBSD native linking must run on FreeBSD. Use the FreeBSD offline compiler kit on the target system.');
  }
  const output = options.out ?? plan.suggestedOutput;
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-freebsd-link-'));
  const cFile = path.join(temp, `${fileStem(plan.name)}.c`);
  try {
    fs.writeFileSync(cFile, plan.cSource, 'utf8');
    const result = spawnSync(options.cc ?? 'cc', ['-std=c99', '-O2', '-o', path.resolve(output), cFile, '-lm'], {
      stdio: options.quiet ? 'pipe' : 'inherit', encoding: 'utf8'
    });
    if (result.error) throw new OfflineLinkError(`Could not start the C compiler: ${result.error.message}`);
    if (result.status !== 0) {
      const detail = options.quiet ? `\n${result.stderr || result.stdout || ''}` : '';
      throw new OfflineLinkError(`FreeBSD C99 linking failed.${detail}`);
    }
    fs.chmodSync(output, 0o755);
    return { ...plan, output };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function requiredRuntime(value, label) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new OfflineLinkError(`${label} linking needs the runtime embedded in the Patch offline compiler.`);
}

function normalizeGuiPayloadVersion(value) {
  const version = Number(value);
  if (version === 12 || version === 17) return version;
  throw new OfflineLinkError(`Offline Window linking supports sealed GUI payload v12 or v17, not '${value}'.`);
}

function normalizePlatform(value) {
  const platform = String(value ?? '').toLowerCase();
  if (platform === 'win32' || platform === 'windows') return 'windows';
  if (platform === 'darwin' || platform === 'macos' || platform === 'osx') return 'macos';
  if (platform === 'linux') return 'linux';
  if (platform === 'freebsd') return 'freebsd';
  throw new OfflineLinkError(`Offline linking is not available for '${value}'.`);
}

function normalizeBinaryOutput(value, platform) {
  const output = String(value);
  if (platform === 'windows' && !output.toLowerCase().endsWith('.exe')) return `${output}.exe`;
  return output;
}
function ensureMacApp(value) {
  const output = String(value);
  return output.toLowerCase().endsWith('.app') ? output : `${output}.app`;
}
function safeName(value) {
  const cleaned = String(value).trim().replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s+/g, ' ').slice(0, 80);
  return cleaned || 'PatchApp';
}
function fileStem(value) { return safeName(value).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp'; }
function textBytes(value) { return new TextEncoder().encode(String(value)); }
function macInfoPlist(name, executable) {
  const bundlePart = fileStem(name).toLowerCase().replace(/_/g, '-');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>CFBundleName</key><string>${xml(name)}</string>\n<key>CFBundleDisplayName</key><string>${xml(name)}</string>\n<key>CFBundleExecutable</key><string>${xml(executable)}</string>\n<key>CFBundleIdentifier</key><string>org.patchlang.offline.${xml(bundlePart)}</string>\n<key>CFBundlePackageType</key><string>APPL</string>\n<key>CFBundleShortVersionString</key><string>0.2</string>\n<key>CFBundleVersion</key><string>1</string>\n<key>LSMinimumSystemVersion</key><string>11.0</string>\n<key>NSHighResolutionCapable</key><true/>\n</dict></plist>\n`;
}
function xml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[c]); }
