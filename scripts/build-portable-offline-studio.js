#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildOfflineStudioManifest } from './offline-studio-assets.js';
import { installOfflineStudioSiteOverlay } from './offline-studio-site-overlay.js';

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
const localBuild = offlineCompiler ? compilerMetadata(offlineCompiler) : null;
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
fs.copyFileSync(path.resolve('scripts/offline-studio-build-bridge.cjs'), path.join(out, 'offline-studio-build-bridge.cjs'));
if (localBuild) {
  const compilerTarget = path.join(out, ...localBuild.compilerFile.split('/'));
  fs.mkdirSync(path.dirname(compilerTarget), { recursive: true });
  fs.copyFileSync(path.resolve(offlineCompiler), compilerTarget);
  if (process.platform !== 'win32') fs.chmodSync(compilerTarget, 0o755);
}
fs.writeFileSync(path.join(out, 'offline-studio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(out, 'patch-studio'), unixLauncher(), { mode: 0o755 });
fs.writeFileSync(path.join(out, 'PatchStudio.cmd'), windowsLauncher(), 'utf8');
fs.writeFileSync(path.join(out, 'README.txt'), readme(pkg.version, localBuild), 'utf8');

console.log(`Built Patch Offline Studio portable bundle ${pkg.version}: ${out}`);
console.log(`  embedded site files: ${manifest.fileCount}`);
console.log(`  site closure sha256: ${manifest.closureSha256}`);
console.log('  runtime: Node.js >= 18 on Windows, macOS, Linux and POSIX/Unix-like hosts');
console.log(`  local native build: ${localBuild ? `${localBuild.platform}/${localBuild.arch} compiler ${localBuild.compilerSha256.slice(0, 12)}…` : 'bridge present, compiler not packaged'}`);

function buildSite() {
  const built = spawnSync(process.execPath, ['scripts/build-site.js'], { stdio: 'inherit' });
  if (built.error) fail(`Could not start Patch Studio site build: ${built.error.message}`);
  if (built.status !== 0) fail(`Patch Studio site build failed with status ${built.status}.`);
}

function compilerMetadata(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`--offline-compiler does not name a file: ${absolute}`);
  const bytes = fs.readFileSync(absolute);
  const compilerFile = process.platform === 'win32' ? 'compiler/patch.exe' : 'compiler/patch';
  return Object.freeze({
    contract: 'patch-offline-studio-build-bridge/0.1',
    platform: normalizePlatform(process.platform),
    arch: process.arch,
    compilerFile,
    compilerSize: bytes.length,
    compilerSha256: crypto.createHash('sha256').update(bytes).digest('hex')
  });
}

function unixLauncher() {
  return `#!/bin/sh\nset -eu\nDIR=$(CDPATH= cd "$(dirname "$0")" && pwd)\nexec node "$DIR/PatchStudio.cjs" "$@"\n`;
}

function windowsLauncher() {
  return '@echo off\r\nsetlocal\r\nnode "%~dp0PatchStudio.cjs" %*\r\n';
}

function readme(version, localBuild) {
  const native = localBuild
    ? `This package also contains a SHA-256 pinned Patch offline compiler for ${localBuild.platform}/${localBuild.arch}. When the matching native target is selected, Patch Studio can invoke that compiler through the localhost-only patch-offline-studio-build-bridge/0.1 contract. The bridge accepts versioned Patch build requests only; it does not expose a general shell or arbitrary filesystem API.\n`
    : 'The authenticated local-build bridge is present, but this compatibility package does not contain a host-native Patch compiler. Browser-local Ready builds remain available; host-native linking becomes available when a matching compiler is packaged with the bundle.\n';
  return `Patch Studio Offline IDE ${version}\n\nPortable Node bundle\n====================\n\nThis bundle is the compatibility path for systems without a published self-contained SEA executable, including generic Unix/POSIX hosts such as FreeBSD when a compatible Node.js runtime is installed.\n\nRequirements\n------------\n- Node.js 18 or newer\n- A modern local browser\n\nStart\n-----\nUnix/macOS/Linux: ./patch-studio\nWindows: PatchStudio.cmd\nDirect: node PatchStudio.cjs\n\nThe IDE binds only to 127.0.0.1, uses a random per-process URL prefix, verifies every bundled Studio asset against offline-studio-manifest.json before serving it, and requires no external network access for authoring, Designer, Run or browser-local build targets.\n\n${native}\nPublished self-contained executables remain the preferred path on supported CPU/OS combinations.\n`;
}

function normalizePlatform(value) {
  if (value === 'win32') return 'windows';
  if (value === 'darwin') return 'macos';
  if (value === 'linux') return 'linux';
  if (value === 'freebsd') return 'freebsd';
  return String(value);
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
