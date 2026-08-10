import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export class NativeGuiHostError extends Error {}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function nativeGuiHostPlan(platform = process.platform) {
  if (platform === 'win32') {
    return {
      platform: 'windows',
      backend: 'win32',
      shell: 'native-win32',
      script: path.join(ROOT, 'scripts', 'build-native-win32.js'),
      outputKind: 'Windows .exe'
    };
  }
  if (platform === 'darwin') {
    return {
      platform: 'macOS',
      backend: 'appkit',
      shell: 'native-appkit',
      script: path.join(ROOT, 'scripts', 'build-native-appkit.js'),
      outputKind: 'macOS .app'
    };
  }
  if (platform === 'linux') {
    return {
      platform: 'Linux',
      backend: 'gtk3',
      shell: 'native-gtk3',
      script: path.join(ROOT, 'scripts', 'build-native-gtk.js'),
      outputKind: 'Linux executable'
    };
  }
  throw new NativeGuiHostError(`Native Patch GUI output is not available on host platform '${platform}' yet. Supported hosts are Windows, macOS and Linux.`);
}

export function buildNativeGuiForHost(sourcePath, options = {}) {
  const plan = nativeGuiHostPlan(options.platform ?? process.platform);
  const name = options.name ?? 'PatchApp';
  const outDir = options.outDir ?? 'dist';
  const args = [plan.script, sourcePath, name, outDir];
  if (options.emitOnly) args.push('--emit-only');
  if (options.smoke) args.push('--smoke');

  const run = spawnSync(process.execPath, args, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
    env: process.env
  });
  if (run.error) throw run.error;
  if (run.status !== 0) {
    const detail = options.capture ? String(run.stderr || run.stdout || '').trim() : '';
    throw new NativeGuiHostError(
      `Native ${plan.platform} GUI build failed${detail ? `: ${detail}` : ` with status ${run.status}`}.`
    );
  }
  return {
    ...plan,
    name,
    outDir: path.resolve(outDir),
    stdout: options.capture ? run.stdout : null,
    stderr: options.capture ? run.stderr : null
  };
}
