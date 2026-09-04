#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildOfflineStudioManifest, offlineStudioAssetMap } from './offline-studio-assets.js';
import { installOfflineStudioSiteOverlay } from './offline-studio-site-overlay.js';

const args = process.argv.slice(2);
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const siteRoot = path.resolve(option('--site') ?? '_site');
const out = path.resolve(option('--out') ?? defaultOutput());
const manifestOut = path.resolve(option('--manifest') ?? path.join(path.dirname(out), 'offline-studio-manifest.json'));
const offlineCompiler = option('--offline-compiler');
const manifestOnly = args.includes('--manifest-only');
const skipSiteBuild = args.includes('--skip-site-build');

if (!skipSiteBuild) buildSite();
installOfflineStudioSiteOverlay(siteRoot);

const baseManifest = buildOfflineStudioManifest(siteRoot, { patchVersion: pkg.version });
const localBuild = offlineCompiler ? embeddedCompilerMetadata(offlineCompiler) : null;
const manifest = Object.freeze(localBuild ? { ...baseManifest, localBuild } : { ...baseManifest });
fs.mkdirSync(path.dirname(manifestOut), { recursive: true });
fs.writeFileSync(manifestOut, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

if (manifestOnly) {
  console.log(`Validated Patch Offline Studio ${pkg.version}`);
  console.log(`  files: ${manifest.fileCount}`);
  console.log(`  closure sha256: ${manifest.closureSha256}`);
  console.log(`  local native build: ${localBuild ? `${localBuild.platform}/${localBuild.arch} compiler ${localBuild.compilerSha256.slice(0, 12)}…` : 'not packaged'}`);
  console.log(`  manifest: ${manifestOut}`);
  process.exit(0);
}

assertSeaBuildSupport();

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-studio-'));
try {
  const configPath = path.join(temp, 'sea-config.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const assets = offlineStudioAssetMap(siteRoot, manifestOut);
  assets['offline-studio-build-bridge.cjs'] = path.resolve('scripts/offline-studio-build-bridge.cjs');
  if (localBuild) assets[localBuild.compilerAsset] = path.resolve(offlineCompiler);
  fs.writeFileSync(configPath, JSON.stringify({
    main: path.resolve('scripts/offline-studio-runner.cjs'),
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
    fail('Patch Offline Studio SEA build failed even though this Node release should support --build-sea.');
  }

  if (process.platform !== 'win32') fs.chmodSync(out, 0o755);
  if (process.platform === 'darwin') {
    const signed = spawnSync('codesign', ['--force', '--sign', '-', out], { stdio: 'inherit' });
    if (signed.error) fail(`Could not ad-hoc sign Patch Offline Studio: ${signed.error.message}`);
    if (signed.status !== 0) fail(`macOS ad-hoc signing failed with status ${signed.status}.`);
  }

  console.log(`Built Patch Offline Studio ${pkg.version}: ${out}`);
  console.log(`  embedded files: ${manifest.fileCount}`);
  console.log(`  site closure sha256: ${manifest.closureSha256}`);
  console.log('  network requirement: none for Studio Run/Designer/Web/portable browser builds');
  console.log(localBuild
    ? `  native local packaging: enabled for ${localBuild.platform}/${localBuild.arch} through patch-offline-studio-build-bridge/0.1`
    : '  native local packaging: bridge present but no offline compiler was packaged');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function buildSite() {
  const built = spawnSync(process.execPath, ['scripts/build-site.js'], { stdio: 'inherit' });
  if (built.error) fail(`Could not start Patch Studio site build: ${built.error.message}`);
  if (built.status !== 0) fail(`Patch Studio site build failed with status ${built.status}.`);
}

function embeddedCompilerMetadata(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail(`--offline-compiler does not name a file: ${absolute}`);
  const bytes = fs.readFileSync(absolute);
  return Object.freeze({
    contract: 'patch-offline-studio-build-bridge/0.1',
    platform: normalizePlatform(process.platform),
    arch: process.arch,
    compilerAsset: 'compiler/patch-offline-compiler.bin',
    compilerSize: bytes.length,
    compilerSha256: crypto.createHash('sha256').update(bytes).digest('hex')
  });
}

function normalizePlatform(value) {
  if (value === 'win32') return 'windows';
  if (value === 'darwin') return 'macos';
  if (value === 'linux') return 'linux';
  if (value === 'freebsd') return 'freebsd';
  return String(value);
}

function assertSeaBuildSupport() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  if (major < 25 || (major === 25 && minor < 5)) {
    fail(`Building the self-contained Offline Studio executable requires Node >=25.5.0 for --build-sea; current Node is ${process.versions.node}. Use --manifest-only on older supported Patch development runtimes.`);
  }
}

function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} needs a value.`);
  return value;
}

function defaultOutput() {
  return process.platform === 'win32'
    ? 'dist-offline-studio/PatchStudio.exe'
    : 'dist-offline-studio/PatchStudio';
}

function fail(message) {
  console.error(`Patch Offline Studio builder: ${message}`);
  process.exit(2);
}
