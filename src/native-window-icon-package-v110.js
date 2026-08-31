import { sealNativeGuiRuntimeV19 } from './sealed-native-gui-v19.js';
import { validateNativeGuiIRV19 } from './native-gui-ir-v19.js';
import { planNativeWindowIconPackaging } from './native-window-icon-packaging.js';
import { resourceById, resourceBytes } from './studio-resources.js';
import {
  embedWindowsPeApplicationIconV110,
  inspectWindowsPeApplicationIconV110
} from './windows-pe-icon-v110.js';

export const PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_VERSION = '0.2';
export const PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_ID = 'native-window-icon-package-v110/0.2';

export class NativeWindowIconPackageV110Error extends Error {
  constructor(message, code = 'NATIVE_WINDOW_ICON_PACKAGE_V110') {
    super(message);
    this.name = 'NativeWindowIconPackageV110Error';
    this.code = code;
  }
}

/**
 * Build a materialization-neutral package plan for the experimental
 * IR 1.9 / payload v19 / runtime v1.10 Window-icon line.
 *
 * v0.2 closes the Windows single-EXE gap: when an application icon exists,
 * the runtime template must carry the reserved windows-pe-icon-v110/0.1
 * resource slot and the project 256x256 PNG is embedded into the sealed EXE
 * in place. macOS and Linux continue to compose their package metadata around
 * the same sealed payload. This does not promote the Current Ready contract.
 */
export function createNativeWindowIconPackagePlanV110(runtimeBytes, ir, options = {}) {
  const platform = normalizePlatform(options.platform);
  const nativeGui = validateNativeGuiIRV19(ir);
  const resources = options.resources ?? [];
  const name = safeName(options.name ?? 'PatchApp');
  const stem = fileStem(name);
  const sealed = sealNativeGuiRuntimeV19(runtimeBytes, nativeGui, { platform, resources });
  const icons = planNativeWindowIconPackaging(nativeGui, resources, { name });
  const files = [];

  if (platform === 'windows') {
    let executableBytes = sealed;
    let peIconEmbedded = false;
    let windowsPeIcon = null;

    if (icons.hasApplicationIcon) {
      const resourceId = icons.applicationIcon?.resourceId;
      const resource = resourceById(resources, resourceId);
      if (!resource) {
        throw new NativeWindowIconPackageV110Error(
          `Windows application icon resource '${resourceId ?? ''}' is missing from the project resource inventory.`,
          'NATIVE_WINDOW_ICON_PACKAGE_V110_RESOURCE_MISSING'
        );
      }
      executableBytes = embedWindowsPeApplicationIconV110(sealed, resourceBytes(resource));
      windowsPeIcon = inspectWindowsPeApplicationIconV110(executableBytes);
      peIconEmbedded = true;
    }

    files.push(file(`${stem}.exe`, executableBytes, 0o100755));
    // Keep the deterministic ICO as packaging/provenance material. The EXE is
    // self-contained and does not depend on this sidecar after v0.2 embedding.
    if (icons.windows) files.push(file(icons.windows.filename, icons.windows.bytes, 0o100644));
    return freezePlan({
      platform,
      name,
      stem,
      sealed,
      icons,
      outputKind: 'experimental Windows runtime-v1.10 self-contained package plan',
      executable: `${stem}.exe`,
      bundle: null,
      files,
      peIconEmbedded,
      windowsPeIcon
    });
  }

  if (platform === 'macos') {
    const bundle = `${stem}.app`;
    const executable = `${bundle}/Contents/MacOS/${stem}`;
    files.push(file(executable, sealed, 0o100755));
    if (icons.macos) {
      files.push(file(`${bundle}/${icons.macos.bundlePath}`, icons.macos.bytes, 0o100644));
    }
    files.push(file(`${bundle}/Contents/Info.plist`, textBytes(macInfoPlist(name, stem, icons.macos)), 0o100644));
    files.push(file(`${bundle}/Contents/PkgInfo`, textBytes('APPL????'), 0o100644));
    return freezePlan({
      platform,
      name,
      stem,
      sealed,
      icons,
      outputKind: 'experimental macOS runtime-v1.10 app bundle plan',
      executable,
      bundle,
      files,
      peIconEmbedded: null,
      windowsPeIcon: null
    });
  }

  if (platform === 'linux') {
    files.push(file(stem, sealed, 0o100755));
    if (icons.linux) {
      files.push(file(icons.linux.iconPath, icons.linux.iconBytes, 0o100644));
      files.push(file(icons.linux.desktopPath, icons.linux.desktopBytes, 0o100644));
    }
    return freezePlan({
      platform,
      name,
      stem,
      sealed,
      icons,
      outputKind: 'experimental Linux runtime-v1.10 desktop package plan',
      executable: stem,
      bundle: null,
      files,
      peIconEmbedded: null,
      windowsPeIcon: null
    });
  }

  throw new NativeWindowIconPackageV110Error(`Unsupported runtime-v1.10 package platform '${platform}'.`);
}

function freezePlan({ platform, name, stem, sealed, icons, outputKind, executable, bundle, files, peIconEmbedded, windowsPeIcon }) {
  return Object.freeze({
    id: PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_ID,
    version: PATCH_NATIVE_WINDOW_ICON_PACKAGE_V110_VERSION,
    experimental: true,
    currentProductPromoted: false,
    nativeGuiIr: '1.9',
    payload: 19,
    runtime: '1.10',
    platform,
    name,
    stem,
    outputKind,
    executable,
    bundle,
    peIconEmbedded,
    windowsPeIcon,
    sealedBytes: sealed,
    iconPackaging: icons,
    files: Object.freeze(files)
  });
}

function file(path, bytes, mode) {
  return Object.freeze({ path, bytes: toBytes(bytes), mode });
}

function macInfoPlist(name, executable, icon) {
  const bundlePart = fileStem(name).toLowerCase().replace(/_/g, '-');
  const iconEntry = icon
    ? `\n<key>CFBundleIconFile</key><string>${xml(icon.plistValue)}</string>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>CFBundleName</key><string>${xml(name)}</string>\n<key>CFBundleDisplayName</key><string>${xml(name)}</string>\n<key>CFBundleExecutable</key><string>${xml(executable)}</string>\n<key>CFBundleIdentifier</key><string>org.patchlang.experimental.${xml(bundlePart)}</string>\n<key>CFBundlePackageType</key><string>APPL</string>\n<key>CFBundleShortVersionString</key><string>0.2</string>\n<key>CFBundleVersion</key><string>1</string>${iconEntry}\n<key>LSMinimumSystemVersion</key><string>11.0</string>\n<key>NSHighResolutionCapable</key><true/>\n</dict></plist>\n`;
}

function normalizePlatform(value) {
  const platform = String(value ?? '').trim().toLowerCase();
  if (platform === 'windows' || platform === 'win32') return 'windows';
  if (platform === 'macos' || platform === 'darwin' || platform === 'osx') return 'macos';
  if (platform === 'linux') return 'linux';
  throw new NativeWindowIconPackageV110Error(
    `Runtime-v1.10 Window icon packaging supports Windows, macOS or Linux, not '${value ?? ''}'.`,
    'NATIVE_WINDOW_ICON_PACKAGE_V110_PLATFORM'
  );
}
function safeName(value) {
  const cleaned = String(value ?? '').trim().replace(/[\r\n\0]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
  return cleaned || 'PatchApp';
}
function fileStem(value) {
  return safeName(value).replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}
function textBytes(value) {
  return new TextEncoder().encode(String(value));
}
function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new NativeWindowIconPackageV110Error('Package files require byte data.', 'NATIVE_WINDOW_ICON_PACKAGE_V110_BYTES');
}
function xml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}
