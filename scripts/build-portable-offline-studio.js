#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildOfflineStudioManifest } from './offline-studio-assets.js';
import { installOfflineStudioSiteOverlay } from './offline-studio-site-overlay.js';
import { offlineStudioLocalBuildMetadata } from './offline-studio-local-build-assets.js';

const args = process.argv.slice(2);
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const siteRoot = path.resolve(option('--site') ?? '_site');
const out = path.resolve(option('--out') ?? 'dist-offline-studio-portable');
const offlineCompiler = option('--offline-compiler');
const skipSiteBuild = args.includes('--skip-site-build');

if (!skipSiteBuild) buildSite();
installOfflineStudioSiteOverlay(siteRoot);

const baseManifest = buildOfflineStudioManifest(siteRoot, { patchVersion: pkg.version });
const localBuild = offlineStudioLocalBuildMetadata(offlineCompiler);
const manifest = Object.freeze(localBuild ? { ...baseManifest, localBuild } : { ...baseManifest });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'site'), { recursive: true });

for (const entry of manifest.files) {
  const source = path.join(siteRoot, ...entry.path.split('/'));
  const target = path.join(out, 'site', ...entry.path.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.copyFileSync(path.resolve('scripts/offline-studio-portable-runner.cjs'), path.join(out, 'PatchStudio.cjs'));
fs.copyFileSync(path.resolve('src/offline-studio-build-bridge-core.cjs'), path.join(out, 'offline-studio-build-bridge-core.cjs'));
fs.copyFileSync(path.resolve('scripts/offline-studio-compiler-builder.cjs'), path.join(out, 'offline-studio-compiler-builder.cjs'));
if (localBuild) {
  const compilerTarget = path.join(out, ...localBuild.compilerFile.split('/'));
  fs.mkdirSync(path.dirname(compilerTarget), { recursive: true });
  fs.copyFileSync(path.resolve(offlineCompiler), compilerTarget);
  if (process.platform !== 'win32') fs.chmodSync(compilerTarget, 0o700);
}
fs.writeFileSync(path.join(out, 'offline-studio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(out, 'patch-studio'), unixLauncher(), { mode: 0o755 });
fs.writeFileSync(path.join(out, 'PatchStudio.cmd'), windowsLauncher(), 'utf8');
fs.writeFileSync(path.join(out, 'README.txt'), readme(pkg.version, localBuild), 'utf8');

console.log(`Built Patch Offline Studio portable bundle ${pkg.version}: ${out}`);
console.log(`  embedded site files: ${manifest.fileCount}`);
console.log(`  site closure sha256: ${manifest.closureSha256}`);
console.log('  runtime: Node.js >= 18 on Windows, macOS, Linux and POSIX/Unix-like hosts');
console.log(`  installed host build: ${localBuild ? `${localBuild.platform}/${localBuild.arch}; use --workspace <directory>` : 'compiler not packaged'}`);

function buildSite() {
  const built = spawnSync(process.execPath, ['scripts/build-site.js'], { stdio: 'inherit' });
  if (built.error) fail(`Could not start Patch Studio site build: ${built.error.message}`);
  if (built.status !== 0) fail(`Patch Studio site build failed with status ${built.status}.`);
}

function unixLauncher() {
  return `#!/bin/sh\nset -eu\nDIR=$(CDPATH= cd "$(dirname "$0")" && pwd)\nexec node "$DIR/PatchStudio.cjs" "$@"\n`;
}

function windowsLauncher() {
  return '@echo off\r\nsetlocal\r\nnode "%~dp0PatchStudio.cjs" %*\r\n';
}

function readme(version, localBuild) {
  const nativeBuild = localBuild
    ? `Installed host build\n--------------------\nThis package includes a SHA-256 pinned Patch offline compiler for ${localBuild.platform}/${localBuild.arch}. Start Patch Studio with an explicit workspace authority:\n\n  ${process.platform === 'win32' ? 'PatchStudio.cmd --workspace C:\\path\\to\\project' : './patch-studio --workspace /path/to/project'}\n\nThe browser receives only a per-launch bearer capability for the versioned snapshot/build/artifact endpoints. Source snapshots and native outputs remain inside the opened workspace. No arbitrary shell command, executable path or output path is accepted.\n\n`
    : 'Installed host build\n--------------------\nThis compatibility bundle does not contain a matching host-native Patch compiler. Browser-local Ready builds remain available. A package assembled with --offline-compiler enables the authenticated workspace build bridge.\n\n';
  return `Patch Studio Offline IDE ${version}\n\nPortable Node bundle\n====================\n\nThis bundle is the compatibility path for systems without a published self-contained SEA executable, including generic Unix/POSIX hosts such as FreeBSD when a compatible Node.js runtime is installed.\n\nRequirements\n------------\n- Node.js 18 or newer\n- A modern local browser\n\nStart\n-----\nUnix/macOS/Linux: ./patch-studio\nWindows: PatchStudio.cmd\nDirect: node PatchStudio.cjs\n\nThe IDE binds only to 127.0.0.1, uses a random per-process URL prefix, verifies every bundled Studio asset against offline-studio-manifest.json before serving it, and requires no external network access for authoring, Designer, Run or browser-local build targets.\n\n${nativeBuild}Published self-contained executables remain the preferred path on supported CPU/OS combinations.\n`;
}

function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} needs a value.`);
  return value;
}

function fail(message) {
  console.error(`Patch Offline Studio portable builder: ${message}`);
  process.exit(2);
}
