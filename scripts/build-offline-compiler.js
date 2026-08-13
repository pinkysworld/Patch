#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const platform = normalizePlatform(option('--platform') ?? process.platform);
const out = path.resolve(option('--out') ?? defaultOutput(platform));
const consoleRuntime = option('--console-runtime');
const guiRuntime = option('--gui-runtime');

if (platform !== normalizePlatform(process.platform)) {
  fail(`Build this offline compiler on its target OS. Host is ${process.platform}, requested ${platform}.`);
}
if (platform !== 'freebsd' && (!consoleRuntime || !guiRuntime)) {
  fail(`${platform} offline compiler builds require both --console-runtime and --gui-runtime.`);
}

const srcFiles = collectFiles('src', file => file.endsWith('.js'));
if (!srcFiles.includes('src/cli-entry.js') || !srcFiles.includes('src/offline-linker.js')) {
  fail('Offline compiler source graph is incomplete.');
}
const sourceHash = hashFiles(srcFiles);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-compiler-'));

try {
  const manifestPath = path.join(temp, 'patch-offline-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    format: 'patch-offline-compiler-manifest',
    version: pkg.version,
    platform,
    arch: process.arch,
    sourceHash,
    runtimeEncoding: 'gzip'
  }, null, 2), 'utf8');

  const assets = {
    'patch-offline-manifest.json': manifestPath
  };
  for (const file of srcFiles) assets[file.replaceAll('\\', '/')] = path.resolve(file);
  if (consoleRuntime) assets['runtime/console.bin.gz'] = compressRuntime(consoleRuntime, path.join(temp, 'console.bin.gz'));
  if (guiRuntime) assets['runtime/gui.bin.gz'] = compressRuntime(guiRuntime, path.join(temp, 'gui.bin.gz'));

  const configPath = path.join(temp, 'sea-config.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    main: path.resolve('scripts/offline-compiler-runner.cjs'),
    mainFormat: 'commonjs',
    output: out,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    execArgvExtension: 'none',
    assets
  }, null, 2), 'utf8');

  const built = spawnSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  if (built.error) fail(`Could not start Node SEA builder: ${built.error.message}`);
  if (built.status !== 0 || !fs.existsSync(out)) {
    fail('Patch offline compiler SEA build failed. Node 26+ with --build-sea support is required.');
  }

  if (platform !== 'windows') fs.chmodSync(out, 0o755);
  if (platform === 'macos') {
    const signed = spawnSync('codesign', ['--force', '--sign', '-', out], { stdio: 'inherit' });
    if (signed.error) fail(`Could not ad-hoc sign macOS compiler: ${signed.error.message}`);
    if (signed.status !== 0) fail(`macOS ad-hoc signing failed with status ${signed.status}.`);
  }

  console.log(`Built Patch ${pkg.version} offline compiler ${out}`);
  console.log(`  platform: ${platform}`);
  console.log(`  arch: ${process.arch}`);
  console.log(`  source sha256: ${sourceHash}`);
  console.log(`  embedded source modules: ${srcFiles.length}`);
  console.log(`  native runtimes: ${platform === 'freebsd' ? 'portable C99 linker' : 'gzip-compressed console + GUI'}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function compressRuntime(file, target) {
  const raw = fs.readFileSync(file);
  const compressed = zlib.gzipSync(raw, { level: 9 });
  fs.writeFileSync(target, compressed);
  return target;
}
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
function collectFiles(dir, predicate) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...collectFiles(file, predicate));
    else if (predicate(file)) result.push(file);
  }
  return result.sort();
}
function hashFiles(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(file.replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}
function normalizePlatform(value) {
  const raw = String(value).toLowerCase();
  if (raw === 'win32' || raw === 'windows') return 'windows';
  if (raw === 'darwin' || raw === 'macos' || raw === 'osx') return 'macos';
  if (raw === 'linux') return 'linux';
  if (raw === 'freebsd') return 'freebsd';
  fail(`Unsupported offline compiler platform '${value}'.`);
}
function defaultOutput(platform) {
  if (platform === 'windows') return 'dist-offline/patch.exe';
  return 'dist-offline/patch';
}
function fail(message) {
  console.error(`Patch offline compiler builder: ${message}`);
  process.exit(2);
}
