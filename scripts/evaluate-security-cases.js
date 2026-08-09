#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateSecurityCase } from '../src/security-case-study.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
const manifestPath = path.join(root, 'case-studies', 'security', 'cases.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const results = [];

for (const entry of manifest.cases) {
  const sourcePath = path.join(root, 'case-studies', 'security', entry.file);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const evaluation = evaluateSecurityCase(source, { name: entry.id });
  verifyExpected(entry, evaluation);
  results.push({
    ...entry,
    sourceBytes: Buffer.byteLength(source),
    patchAccepted: evaluation.patch.accepted,
    patchError: evaluation.patch.error,
    coarseWriteAccepted: evaluation.coarseTargetWrite.accepted,
    coarsePolicies: evaluation.coarseTargetWrite.policies,
    differential: evaluation.differential,
    patchSignatures: evaluation.patch.signatures
  });
}

const report = {
  format: 'patch-security-case-study-report',
  version: '0.1',
  manifestVersion: manifest.version,
  baseline: manifest.baseline,
  generatedAt: new Date().toISOString(),
  baselineBoundary: 'coarse target-path write authority only; not a named external effect/capability system',
  results,
  summary: summarize(results)
};

const json = `${JSON.stringify(report, null, 2)}\n`;
if (options.out) write(options.out, json);
else process.stdout.write(json);
if (options.csv) write(options.csv, toCsv(report));
if (options.markdown) write(options.markdown, toMarkdown(report));

if (options.out) console.log(`wrote ${options.out}`);
if (options.csv) console.log(`wrote ${options.csv}`);
if (options.markdown) console.log(`wrote ${options.markdown}`);

function verifyExpected(entry, evaluation) {
  const expectedPatchAccepted = entry.patchExpected === 'accept';
  if (evaluation.patch.accepted !== expectedPatchAccepted) {
    throw new Error(`${entry.id}: expected Patch ${entry.patchExpected}, observed ${evaluation.patch.accepted ? 'accept' : 'reject'}${evaluation.patch.error ? ` (${evaluation.patch.error.message})` : ''}.`);
  }
  if (evaluation.coarseTargetWrite.accepted !== entry.coarseWriteExpected) {
    throw new Error(`${entry.id}: expected coarse target-write=${entry.coarseWriteExpected}, observed ${evaluation.coarseTargetWrite.accepted}.`);
  }
  if (entry.errorContains && !evaluation.patch.error?.message.includes(entry.errorContains)) {
    throw new Error(`${entry.id}: Patch rejection did not contain expected diagnostic '${entry.errorContains}'. Observed: ${evaluation.patch.error?.message ?? '<none>'}`);
  }
}

function summarize(results) {
  const byCategory = {};
  for (const item of results) {
    const bucket = byCategory[item.category] ??= { cases: 0, patchAccepts: 0, patchRejects: 0, coarseAccepts: 0, differentialRejects: 0 };
    bucket.cases += 1;
    bucket.patchAccepts += item.patchAccepted ? 1 : 0;
    bucket.patchRejects += item.patchAccepted ? 0 : 1;
    bucket.coarseAccepts += item.coarseWriteAccepted ? 1 : 0;
    bucket.differentialRejects += item.coarseWriteAccepted && !item.patchAccepted ? 1 : 0;
  }
  return {
    cases: results.length,
    patchAccepts: results.filter(item => item.patchAccepted).length,
    patchRejects: results.filter(item => !item.patchAccepted).length,
    coarseAccepts: results.filter(item => item.coarseWriteAccepted).length,
    coarseRejects: results.filter(item => !item.coarseWriteAccepted).length,
    semanticAuthorityDifferentialRejects: results.filter(item => item.coarseWriteAccepted && !item.patchAccepted).length,
    bothReject: results.filter(item => !item.coarseWriteAccepted && !item.patchAccepted).length,
    byCategory
  };
}

function toCsv(report) {
  const header = ['id','category','patch_accepted','coarse_target_write_accepted','differential','error','claim'];
  const rows = report.results.map(item => [
    item.id,
    item.category,
    item.patchAccepted,
    item.coarseWriteAccepted,
    item.differential,
    item.patchError?.message ?? '',
    item.claim
  ]);
  return `${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}\n`;
}

function toMarkdown(report) {
  const rows = [
    '| Case | Category | Patch | Coarse target-write | Difference |',
    '|---|---|---:|---:|---|'
  ];
  for (const item of report.results) {
    rows.push(`| \`${item.id}\` | ${item.category} | ${item.patchAccepted ? 'accept' : 'reject'} | ${item.coarseWriteAccepted ? 'accept' : 'reject'} | ${item.coarseWriteAccepted && !item.patchAccepted ? 'semantic authority adds rejection' : 'same decision'} |`);
  }
  rows.push('', `Cases: ${report.summary.cases}. Patch-only semantic-authority rejections over the coarse target-write ablation: ${report.summary.semanticAuthorityDifferentialRejects}.`);
  rows.push('', '> The coarse target-write baseline is an internal ablation, not a claim about any named prior effect or capability system.');
  return `${rows.join('\n')}\n`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function write(filename, content) {
  const target = path.resolve(filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function parseArgs(args) {
  const result = { out: null, csv: null, markdown: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--out') result.out = requireValue(args, ++index, '--out');
    else if (arg === '--csv') result.csv = requireValue(args, ++index, '--csv');
    else if (arg === '--markdown') result.markdown = requireValue(args, ++index, '--markdown');
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/evaluate-security-cases.js [--out report.json] [--csv report.csv] [--markdown table.md]');
      process.exit(0);
    } else throw new Error(`Unknown argument '${arg}'.`);
  }
  return result;
}

function requireValue(args, index, name) {
  if (index >= args.length) throw new Error(`${name} requires a value.`);
  return args[index];
}
