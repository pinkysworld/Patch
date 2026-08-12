#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildReleaseManifest(inputs, options = {}) {
  const baseDir = path.resolve(options.baseDir ?? process.cwd());
  const files = expandInputs(inputs, baseDir);
  if (!files.length) throw new Error('No release artifacts were provided.');

  const artifacts = files.map(file => {
    const bytes = fs.readFileSync(file.absolute);
    return {
      path: file.relative,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  }).sort((a, b) => a.path.localeCompare(b.path));

  return {
    schema: 'patch-release-manifest',
    schemaVersion: 1,
    patchVersion: readPatchVersion(),
    commit: options.commit ?? process.env.GITHUB_SHA ?? null,
    artifacts
  };
}

export function formatSha256Sums(manifest) {
  return manifest.artifacts.map(item => `${item.sha256}  ${item.path}`).join('\n') + '\n';
}

export function writeReleaseManifest(inputs, options = {}) {
  const outDir = path.resolve(options.outDir ?? 'release-meta');
  const manifest = buildReleaseManifest(inputs, options);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), formatSha256Sums(manifest));
  return manifest;
}

function expandInputs(inputs, baseDir) {
  const seen = new Map();
  for (const input of inputs) collect(path.resolve(baseDir, input), baseDir, seen);
  return [...seen.values()].sort((a, b) => a.relative.localeCompare(b.relative));
}

function collect(target, baseDir, seen) {
  if (!fs.existsSync(target)) throw new Error(`Release artifact does not exist: ${target}`);
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target).sort()) collect(path.join(target, entry), baseDir, seen);
    return;
  }
  if (!stat.isFile()) return;
  const relative = normalize(path.relative(baseDir, target));
  if (!relative || relative.startsWith('../')) throw new Error(`Release artifact must stay inside the base directory: ${target}`);
  seen.set(relative, { absolute: target, relative });
}

function readPatchVersion() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}

function normalize(value) { return value.split(path.sep).join('/'); }

function parseCli(argv) {
  const inputs = [];
  let outDir = 'release-meta';
  let baseDir = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir') {
      outDir = argv[++i];
      if (!outDir) throw new Error('--out-dir needs a directory.');
      continue;
    }
    if (argv[i] === '--base-dir') {
      baseDir = argv[++i];
      if (!baseDir) throw new Error('--base-dir needs a directory.');
      continue;
    }
    inputs.push(argv[i]);
  }
  return { inputs, outDir, baseDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { inputs, outDir, baseDir } = parseCli(process.argv.slice(2));
    const manifest = writeReleaseManifest(inputs, { outDir, baseDir });
    console.log(`Wrote ${manifest.artifacts.length} artifact hash(es) to ${outDir}`);
  } catch (error) {
    console.error(`Patch release manifest stopped: ${error.message}`);
    process.exit(2);
  }
}
