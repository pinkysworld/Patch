#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PATCH_REPRODUCIBILITY_BUNDLE_VERSION = 1;
export const PATCH_REPRODUCIBILITY_BUNDLE_SCHEMA = 'patch-reproducibility-bundle';

export function buildReproducibilityBundle(options = {}) {
  const root = path.resolve(options.root ?? '.');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const commit = options.commit ?? git(root, ['rev-parse', 'HEAD']);
  const out = path.resolve(root, options.out ?? 'reproducibility/bundle');
  const tracked = trackedFiles(root);
  const generated = normalizeExtraFiles(root, options.generated ?? []);
  const files = [...new Set([...tracked, ...generated])].sort();

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const manifestFiles = [];
  for (const rel of files) {
    if (shouldExclude(rel, out, root)) continue;
    const source = path.join(root, rel);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
    const destination = path.join(out, 'source', rel);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    const bytes = fs.readFileSync(destination);
    manifestFiles.push({
      path: `source/${rel.split(path.sep).join('/')}`,
      size: bytes.length,
      sha256: sha256(bytes)
    });
  }

  const environment = {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().map(cpu => cpu.model),
    totalMemoryBytes: os.totalmem()
  };
  fs.writeFileSync(path.join(out, 'environment.json'), `${JSON.stringify(environment, null, 2)}\n`);

  const manifest = {
    schema: PATCH_REPRODUCIBILITY_BUNDLE_SCHEMA,
    schemaVersion: PATCH_REPRODUCIBILITY_BUNDLE_VERSION,
    patchVersion: pkg.version,
    sourceCommit: commit,
    fileCount: manifestFiles.length,
    files: manifestFiles
  };
  fs.writeFileSync(path.join(out, 'BUNDLE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'REPRODUCE.txt'), reproductionInstructions(pkg.version, commit));
  return { out, manifest, environment };
}

export function verifyReproducibilityBundle(options = {}) {
  const bundle = path.resolve(options.bundle ?? 'reproducibility/bundle');
  const manifestPath = path.join(bundle, 'BUNDLE-MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== PATCH_REPRODUCIBILITY_BUNDLE_SCHEMA || manifest.schemaVersion !== PATCH_REPRODUCIBILITY_BUNDLE_VERSION) {
    throw new Error('Unsupported Patch reproducibility bundle schema.');
  }
  if (!/^0\.2\.0-beta\.\d+$/.test(manifest.patchVersion ?? '')) throw new Error('Invalid Patch version in reproducibility bundle.');
  if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit ?? '')) throw new Error('Invalid source commit in reproducibility bundle.');
  if (!Array.isArray(manifest.files) || manifest.files.length !== manifest.fileCount) throw new Error('Invalid reproducibility bundle file manifest.');

  const seen = new Set();
  for (const entry of manifest.files) {
    if (!entry?.path?.startsWith('source/') || entry.path.includes('..') || seen.has(entry.path)) throw new Error(`Invalid reproducibility bundle path: ${entry?.path}`);
    seen.add(entry.path);
    const absolute = path.join(bundle, ...entry.path.split('/'));
    const bytes = fs.readFileSync(absolute);
    if (bytes.length !== entry.size) throw new Error(`Reproducibility bundle size mismatch: ${entry.path}`);
    const digest = sha256(bytes);
    if (digest !== entry.sha256) throw new Error(`Reproducibility bundle SHA-256 mismatch: ${entry.path}`);
  }

  if (options.version && manifest.patchVersion !== options.version) throw new Error(`Reproducibility bundle version mismatch: expected ${options.version}, got ${manifest.patchVersion}`);
  if (options.commit && manifest.sourceCommit !== options.commit) throw new Error(`Reproducibility bundle commit mismatch: expected ${options.commit}, got ${manifest.sourceCommit}`);
  return manifest;
}

function trackedFiles(root) {
  return git(root, ['ls-files', '-z'], true).split('\0').filter(Boolean).sort();
}

function normalizeExtraFiles(root, files) {
  return files.map(file => {
    const absolute = path.resolve(root, file);
    const relative = path.relative(root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Generated reproducibility input is outside repository: ${file}`);
    return relative;
  });
}

function shouldExclude(rel, out, root) {
  const normalized = rel.split(path.sep).join('/');
  const outRel = path.relative(root, out).split(path.sep).join('/');
  return normalized.startsWith(`${outRel}/`) || normalized === outRel || normalized.startsWith('node_modules/') || normalized.startsWith('_site/') || normalized.startsWith('dist');
}

function git(cwd, args, binary = false) {
  return execFileSync('git', args, { cwd, encoding: binary ? 'utf8' : 'utf8' }).trim();
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function reproductionInstructions(version, commit) {
  return `Patch reproducibility bundle\n\nPatch version: ${version}\nSource commit: ${commit}\n\nCore checks:\n  npm test\n  npm run transitive-callee-trace-certify:example\n  npm run transitive-runtime-certify:example\n  npm run transitive-runtime-certify:repeated\n  npm run evaluate:security -- --out evaluation/security/report.json --csv evaluation/security/report.csv --markdown evaluation/security/table.md\n  npm run evaluate:checkout-extension\n\nThe assurance performance harness is included but paper-quality timings are intentionally not generated by this bundle workflow. Run controlled fixed-hardware measurements separately as documented in docs/EVALUATION.md.\n\nVerify this directory with:\n  node scripts/reproducibility-bundle.js verify --bundle <bundle-dir> --version ${version} --commit ${commit}\n`;
}

function parseArgs(argv) {
  const command = argv[0] ?? 'build';
  const options = {};
  const generated = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') options.out = argv[++i];
    else if (arg === '--bundle') options.bundle = argv[++i];
    else if (arg === '--commit') options.commit = argv[++i];
    else if (arg === '--version') options.version = argv[++i];
    else if (arg === '--generated') generated.push(argv[++i]);
    else throw new Error(`Unknown reproducibility bundle option: ${arg}`);
  }
  options.generated = generated;
  return { command, options };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));
    if (command === 'build') {
      const result = buildReproducibilityBundle(options);
      console.log(`built ${result.out} with ${result.manifest.fileCount} hashed source/generated files`);
    } else if (command === 'verify') {
      const manifest = verifyReproducibilityBundle(options);
      console.log(`verified Patch ${manifest.patchVersion} reproducibility bundle for ${manifest.sourceCommit}`);
    } else {
      throw new Error(`Unknown reproducibility bundle command: ${command}`);
    }
  } catch (error) {
    console.error(error?.message ?? String(error));
    process.exitCode = 1;
  }
}
