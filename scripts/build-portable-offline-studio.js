#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildOfflineStudioManifest } from './offline-studio-assets.js';

const args = process.argv.slice(2);
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const siteRoot = path.resolve(option('--site') ?? '_site');
const out = path.resolve(option('--out') ?? 'dist-offline-studio-portable');
const skipSiteBuild = args.includes('--skip-site-build');

if (!skipSiteBuild) buildSite();

const manifest = buildOfflineStudioManifest(siteRoot, { patchVersion: pkg.version });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'site'), { recursive: true });

for (const entry of manifest.files) {
  const source = path.join(siteRoot, ...entry.path.split('/'));
  const target = path.join(out, 'site', ...entry.path.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.copyFileSync(path.resolve('scripts/offline-studio-portable-runner.cjs'), path.join(out, 'PatchStudio.cjs'));
fs.writeFileSync(path.join(out, 'offline-studio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(out, 'patch-studio'), unixLauncher(), { mode: 0o755 });
fs.writeFileSync(path.join(out, 'PatchStudio.cmd'), windowsLauncher(), 'utf8');
fs.writeFileSync(path.join(out, 'README.txt'), readme(pkg.version), 'utf8');

console.log(`Built Patch Offline Studio portable bundle ${pkg.version}: ${out}`);
console.log(`  embedded site files: ${manifest.fileCount}`);
console.log(`  site closure sha256: ${manifest.closureSha256}`);
console.log('  runtime: Node.js >= 18 on Windows, macOS, Linux and POSIX/Unix-like hosts');

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

function readme(version) {
  return `Patch Studio Offline IDE ${version}\n\nPortable Node bundle\n====================\n\nThis bundle is the compatibility path for systems without a published self-contained SEA executable, including generic Unix/POSIX hosts such as FreeBSD when a compatible Node.js runtime is installed.\n\nRequirements\n------------\n- Node.js 18 or newer\n- A modern local browser\n\nStart\n-----\nUnix/macOS/Linux: ./patch-studio\nWindows: PatchStudio.cmd\nDirect: node PatchStudio.cjs\n\nThe IDE binds only to 127.0.0.1, uses a random per-process URL prefix, verifies every bundled Studio asset against offline-studio-manifest.json before serving it, and requires no external network access for authoring, Designer, Run or browser-local build targets.\n\nPublished self-contained executables remain the preferred path on supported CPU/OS combinations. Host-native desktop packaging from inside the Offline IDE remains a separate compiler/runtime capability.\n`;
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
