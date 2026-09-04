#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = path.resolve(option('--out') ?? 'dist-offline-studio-runtime-kit');
const portableOut = path.join(out, 'app');
const offlineCompiler = option('--offline-compiler');
const portableArgs = [
  'scripts/build-portable-offline-studio.js',
  '--out', portableOut
];
if (offlineCompiler) portableArgs.push('--offline-compiler', path.resolve(offlineCompiler));

const built = spawnSync(process.execPath, portableArgs, { stdio: 'inherit', env: process.env });
if (built.error) fail(`could not start portable Offline Studio builder: ${built.error.message}`);
if (built.status !== 0) fail(`portable Offline Studio builder exited with status ${built.status}`);

const runtimeDir = path.join(portableOut, 'runtime');
fs.mkdirSync(runtimeDir, { recursive: true });
const runtimeName = process.platform === 'win32' ? 'node.exe' : 'node';
const runtimeTarget = path.join(runtimeDir, runtimeName);
fs.copyFileSync(process.execPath, runtimeTarget);
if (process.platform !== 'win32') fs.chmodSync(runtimeTarget, 0o755);

if (process.platform === 'win32') {
  fs.writeFileSync(path.join(portableOut, 'PatchStudio.cmd'), '@echo off\r\nsetlocal\r\n"%~dp0runtime\\node.exe" "%~dp0PatchStudio.cjs" %*\r\n', 'utf8');
} else {
  fs.writeFileSync(path.join(portableOut, 'patch-studio'), '#!/bin/sh\nset -eu\nDIR=$(CDPATH= cd "$(dirname "$0")" && pwd)\nexec "$DIR/runtime/node" "$DIR/PatchStudio.cjs" "$@"\n', { mode: 0o755 });
}

const metadata = {
  format: 'patch-offline-studio-runtime-kit',
  version: 1,
  platform: process.platform,
  arch: process.arch,
  node: process.versions.node,
  runtime: `runtime/${runtimeName}`,
  entrypoint: process.platform === 'win32' ? 'PatchStudio.cmd' : 'patch-studio',
  localBuildCompiler: Boolean(offlineCompiler)
};
fs.writeFileSync(path.join(portableOut, 'runtime-kit.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
fs.appendFileSync(path.join(portableOut, 'README.txt'), `\nEmbedded runtime kit\n--------------------\nThis package includes the exact Node ${process.versions.node} ${process.platform}/${process.arch} runtime used by CI. No separately installed Node runtime is required.\n`, 'utf8');

console.log(`Built Patch Offline Studio runtime kit: ${portableOut}`);
console.log(`  host: ${process.platform} ${process.arch}`);
console.log(`  embedded Node: ${process.versions.node}`);
console.log(`  installed host build compiler: ${offlineCompiler ? path.resolve(offlineCompiler) : 'not packaged'}`);

function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} needs a value.`);
  return value;
}

function fail(message) {
  console.error(`Patch Offline Studio runtime-kit builder: ${message}`);
  process.exit(2);
}
