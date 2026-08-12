export const PATCH_ARTIFACT_NAMING_VERSION = 1;

export function patchArtifactStem(name) {
  return String(name ?? 'PatchApp')
    .trim()
    .replace(/[^A-Za-z0-9 _.-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .replace(/[^A-Za-z0-9_-]/g, '_') || 'PatchApp';
}

export function patchArtifactFilename(name, target, options = {}) {
  const stem = patchArtifactStem(name);
  const platform = normalizePlatform(options.platform);
  const kind = options.kind === 'window' ? 'window' : 'console';
  switch (target) {
    case 'project': return `${stem}.patchproject`;
    case 'portable': return `${stem}.patchapp`;
    case 'web': return `${stem}.html`;
    case 'wasm-direct': return `${stem}.direct.wasm`;
    case 'wasm-bootstrap': return `${stem}.bootstrap.wasm`;
    case 'c99': return `${stem}.c`;
    case 'native-ready': return `${stem}-${requiredPlatform(platform)}-${kind}.zip`;
    case 'native-local-kit': return `${stem}-${requiredPlatform(platform)}-${kind}-local-build.zip`;
    case 'native-cloud': return options.aotSingleExe
      ? `${stem}-windows-aot-single-exe.zip`
      : `${stem}-${requiredPlatform(platform)}-${kind}-build.zip`;
    case 'windows-exe': return `${stem}.exe`;
    default: throw new Error(`Unknown Patch artifact naming target '${target}'.`);
  }
}

function normalizePlatform(platform) {
  return platform === undefined || platform === null || platform === '' ? null : String(platform).toLowerCase();
}

function requiredPlatform(platform) {
  if (['windows', 'macos', 'linux', 'freebsd'].includes(platform)) return platform;
  throw new Error(`Patch artifact naming needs a supported platform; got '${platform ?? ''}'.`);
}
