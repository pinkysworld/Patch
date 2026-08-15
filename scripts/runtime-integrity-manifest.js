#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function buildRuntimeIntegrityManifest(entries, options = {}) {
  const baseDir = path.resolve(options.baseDir ?? '.');
  const assets = entries.map(entry => normalizeEntry(entry, baseDir)).sort((a, b) => a.file.localeCompare(b.file));
  const names = new Set();
  for (const asset of assets) {
    if (names.has(asset.file)) throw new Error(`Duplicate runtime integrity entry: ${asset.file}`);
    names.add(asset.file);
  }
  return {
    schema: 'patch-studio-runtime-integrity',
    schemaVersion: 1,
    assets
  };
}

export function writeRuntimeIntegrityManifest(entries, options = {}) {
  const out = path.resolve(options.out ?? 'runtime-manifest.json');
  const manifest = buildRuntimeIntegrityManifest(entries, options);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function normalizeEntry(entry, baseDir) {
  const file = String(entry?.file ?? '').trim();
  const releaseTag = String(entry?.releaseTag ?? '').trim();
  const expected = normalizeDigest(entry?.digest);
  if (!file || file !== path.basename(file)) throw new Error(`Invalid runtime filename: ${file || '(empty)'}`);
  if (!releaseTag) throw new Error(`Missing release tag for ${file}.`);

  const absolute = path.join(baseDir, file);
  let descriptor;
  let bytes;
  try {
    descriptor = fs.openSync(absolute, 'r');
    if (!fs.fstatSync(descriptor).isFile()) throw new Error(`Runtime asset is not a regular file: ${file}`);
    bytes = fs.readFileSync(descriptor);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`Runtime asset does not exist: ${file}`);
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }

  const actual = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  if (expected && actual !== expected) throw new Error(`Runtime asset digest mismatch for ${file}: expected ${expected}, got ${actual}`);
  return { file, releaseTag, sha256: actual };
}

function normalizeDigest(value) {
  if (value === undefined || value === null || value === '') return null;
  const digest = String(value).trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error(`Invalid expected runtime digest: ${value}`);
  return digest;
}

function parseArgs(argv) {
  const options = { entries: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') options.baseDir = argv[++index];
    else if (arg === '--out') options.out = argv[++index];
    else if (arg === '--entry') {
      const raw = argv[++index] ?? '';
      const [file, releaseTag, digest] = raw.split('|');
      options.entries.push({ file, releaseTag, digest });
    } else throw new Error(`Unknown runtime-integrity-manifest option: ${arg}`);
  }
  if (!options.entries.length) throw new Error('At least one --entry file|release-tag|sha256:digest is required.');
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const manifest = writeRuntimeIntegrityManifest(options.entries, options);
    process.stdout.write(`wrote ${options.out ?? 'runtime-manifest.json'} with ${manifest.assets.length} verified runtime asset(s)\n`);
  } catch (error) {
    console.error(error?.message ?? String(error));
    process.exitCode = 1;
  }
}
