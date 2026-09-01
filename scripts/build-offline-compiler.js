#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { collectOfflineCompilerSourceFiles } from './offline-compiler-source-graph.js';

const args = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const platform = normalizePlatform(option('--platform') ?? process.platform);
const out = path.resolve(option('--out') ?? defaultOutput(platform));
const consoleRuntime = option('--console-runtime');
const guiRuntime = option('--gui-runtime');
const guiRuntimeV19 = option('--gui-runtime-v19');

if (platform !== normalizePlatform(process.platform)) {
  fail(`Build this offline compiler on its target OS. Host is ${process.platform}, requested ${platform}.`);
}
if (platform !== 'freebsd' && (!consoleRuntime || !guiRuntime)) {
  fail(`${platform} offline compiler builds require both --console-runtime and --gui-runtime.`);
}
if (platform === 'freebsd' && guiRuntimeV19) {
  fail('FreeBSD offline compiler builds do not support an embedded GUI runtime.');
}

const srcFiles = collectOfflineCompilerSourceFiles(process.cwd());
const srcKeys = srcFiles.map(file => path.relative(process.cwd(), file).split(path.sep).join('/'));
if (!srcKeys.includes('src/cli-entry.js') || !srcKeys.includes('src/cli.js') || !srcKeys.includes('src/offline-linker.js')) {
  fail('Offline compiler source graph is incomplete.');
}
const sourceHash = hashFiles(srcFiles);
const nodeRuntime = path.resolve(process.execPath);
const runtimeFiles = [nodeRuntime, consoleRuntime, guiRuntime, guiRuntimeV19].filter(Boolean).map(file => path.resolve(file));
const runtimeHash = runtimeFiles.length ? hashFiles(runtimeFiles) : 'portable-c99';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-compiler-'));

try {
  const manifestPath = path.join(temp, 'patch-offline-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    format: 'patch-offline-compiler-manifest',
    version: pkg.version,
    platform,
    arch: process.arch,
    sourceHash,
    runtimeHash,
    runtimeEncoding: 'gzip',
    nodeExecutable: platform === 'windows' ? 'runtime/node.exe' : 'runtime/node',
    guiRuntimeV19: Boolean(guiRuntimeV19),
    sourceGraph: 'static-esm-closure-v0.1',
    embeddedSourceModules: srcKeys
  }, null, 2), 'utf8');

  const assets = {
    'patch-offline-manifest.json': manifestPath,
    'runtime/node.bin.gz': compressRuntime(nodeRuntime, path.join(temp, 'node.bin.gz'))
  };
  srcFiles.forEach((file, index) => { assets[srcKeys[index]] = path.resolve(file); });
  if (consoleRuntime) assets['runtime/console.bin.gz'] = compressRuntime(consoleRuntime, path.join(temp, 'console.bin.gz'));
  if (guiRuntime) assets['runtime/gui.bin.gz'] = compressRuntime(guiRuntime, path.join(temp, 'gui.bin.gz'));
  if (guiRuntimeV19) assets['runtime/gui-v19.bin.gz'] = compressRuntime(guiRuntimeV19, path.join(temp, 'gui-v19.bin.gz'));

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
  console.log(`  runtime sha256: ${runtimeHash}`);
  console.log(`  embedded source modules: ${srcFiles.length}`);
  console.log('  source graph: static local ESM closure from src/cli-entry.js + src/cli.js');
  console.log(`  execution runtime: embedded Node ${process.version}`);
  console.log(`  native runtimes: ${platform === 'freebsd' ? 'portable C99 linker' : guiRuntimeV19 ? 'gzip-compressed console + Current Ready GUI + payload-v19 GUI candidate' : 'gzip-compressed console + GUI'}`);
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
function hashFiles(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    hash.update(path.relative(process.cwd(), file).split(path.sep).join('/'));
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
