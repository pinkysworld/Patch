#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function verifyRelease(options = {}) {
  const baseDir = path.resolve(options.baseDir ?? process.cwd());
  const metaDir = path.resolve(baseDir, options.metaDir ?? 'release-meta');
  const expectedCommit = options.commit ?? process.env.GITHUB_SHA ?? null;
  const expectedVersion = options.version ?? readPackageVersion();
  const manifestPath = path.join(metaDir, 'release-manifest.json');
  const sumsPath = path.join(metaDir, 'SHA256SUMS.txt');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== 'patch-release-manifest' || manifest.schemaVersion !== 1) throw new Error('Unsupported Patch release manifest schema.');
  if (manifest.patchVersion !== expectedVersion) throw new Error(`Release manifest version ${manifest.patchVersion} does not match package ${expectedVersion}.`);
  if (!expectedCommit) throw new Error('Release verification requires an exact source commit.');
  if (manifest.commit !== expectedCommit) throw new Error(`Release manifest commit ${manifest.commit ?? 'null'} does not match ${expectedCommit}.`);
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) throw new Error('Release manifest has no artifacts.');

  const expectedSums = new Map();
  for (const line of fs.readFileSync(sumsPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match) throw new Error(`Invalid SHA256SUMS line: ${line}`);
    if (expectedSums.has(match[2])) throw new Error(`Duplicate SHA256SUMS path: ${match[2]}`);
    expectedSums.set(match[2], match[1]);
  }

  const seen = new Set();
  for (const artifact of manifest.artifacts) {
    if (!artifact || typeof artifact.path !== 'string' || artifact.path.startsWith('../') || path.isAbsolute(artifact.path)) throw new Error('Release manifest contains an unsafe artifact path.');
    const absolute = path.resolve(baseDir, artifact.path);
    if (!absolute.startsWith(`${baseDir}${path.sep}`) && absolute !== baseDir) throw new Error(`Artifact escapes release base: ${artifact.path}`);
    const bytes = fs.readFileSync(absolute);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== artifact.bytes) throw new Error(`Release artifact size mismatch: ${artifact.path}`);
    if (sha256 !== artifact.sha256) throw new Error(`Release artifact hash mismatch: ${artifact.path}`);
    if (expectedSums.get(artifact.path) !== sha256) throw new Error(`SHA256SUMS mismatch: ${artifact.path}`);
    seen.add(artifact.path);
  }
  if (expectedSums.size !== seen.size) throw new Error('SHA256SUMS contains paths not present in release-manifest.json.');

  return manifest;
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base-dir') out.baseDir = argv[++i];
    else if (argv[i] === '--meta-dir') out.metaDir = argv[++i];
    else if (argv[i] === '--commit') out.commit = argv[++i];
    else if (argv[i] === '--version') out.version = argv[++i];
    else throw new Error(`Unknown argument '${argv[i]}'.`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = verifyRelease(parseArgs(process.argv.slice(2)));
    console.log(`Verified Patch ${manifest.patchVersion} release at ${manifest.commit} with ${manifest.artifacts.length} artifact(s).`);
  } catch (error) {
    console.error(`Patch release verification stopped: ${error.message}`);
    process.exit(2);
  }
}
