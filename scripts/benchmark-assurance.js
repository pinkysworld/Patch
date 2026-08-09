#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { compileToDirectWasm, runDirectWasm } from '../src/wasm-direct.js';
import { validateDirectSemanticEffects } from '../src/direct-effect-validator.js';
import { buildTransitiveRuntimeCorrespondence } from '../src/transitive-runtime-correspondence.js';
import { generateTransitiveRuntimeCertificate } from '../src/transitive-runtime-certificate.js';
import {
  generateAssuranceScalingProgram,
  assuranceEvaluationScenarios,
  PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION
} from '../src/evaluation-corpus.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const options = parseArgs(process.argv.slice(2));
const scenarios = assuranceEvaluationScenarios(options.preset);
const report = {
  format: 'patch-assurance-evaluation',
  version: '0.1',
  patchVersion: pkg.version,
  changeIrVersion: '0.10',
  corpusVersion: PATCH_ASSURANCE_EVALUATION_CORPUS_VERSION,
  generatedAt: new Date().toISOString(),
  preset: options.preset,
  iterations: options.iterations,
  warmup: options.warmup,
  includeCertificateGeneration: !options.skipCertificate,
  environment: environmentManifest(),
  methodology: {
    clock: 'node:perf_hooks performance.now()',
    compile: 'compileToDirectWasm(source)',
    execute: 'runDirectWasm(precompiledModule, metadata)',
    validate: 'validateDirectSemanticEffects(precompiledIr, observedTrace)',
    correspondence: 'buildTransitiveRuntimeCorrespondence(source), including compile + execute + independent validation + frame attribution',
    certificate: 'generateTransitiveRuntimeCertificate(source), including beta.30 certificate generation + beta.32 runtime correspondence + Lean source emission; Lean checking itself is not included'
  },
  scenarios: []
};

for (const scenario of scenarios) {
  process.stdout.write(`benchmark ${scenario.name} depth=${scenario.nestedDepth} invocations=${scenario.invocations} ... `);
  const generated = generateAssuranceScalingProgram(scenario);
  const source = generated.source;
  const name = `Eval_${scenario.nestedDepth}_${scenario.invocations}`;

  const compiled = compileToDirectWasm(source, { name, kind: 'console' });
  const executed = await runDirectWasm(compiled.module, compiled.metadata);
  const validation = validateDirectSemanticEffects(compiled.compiled.ir, executed.trace);
  const correspondence = await buildTransitiveRuntimeCorrespondence(source, { name, kind: 'console' });
  const certificate = options.skipCertificate
    ? null
    : await generateTransitiveRuntimeCertificate(source, { name, kind: 'console' });

  assertRepresentative(generated, executed, validation, correspondence, certificate);

  const timings = {
    compileMs: await measure(() => compileToDirectWasm(source, { name, kind: 'console' }), options),
    executeMs: await measure(() => runDirectWasm(compiled.module, compiled.metadata), options),
    validateMs: await measure(() => validateDirectSemanticEffects(compiled.compiled.ir, executed.trace), options),
    correspondenceMs: await measure(() => buildTransitiveRuntimeCorrespondence(source, { name, kind: 'console' }), options)
  };
  if (!options.skipCertificate) {
    timings.certificateGenerationMs = await measure(
      () => generateTransitiveRuntimeCertificate(source, { name, kind: 'console' }),
      options
    );
  }

  report.scenarios.push({
    name: scenario.name,
    parameters: generated.parameters,
    expected: generated.expected,
    source: {
      bytes: Buffer.byteLength(source),
      lines: source.split('\n').length - 1,
      sha256: sha256(source)
    },
    artifacts: {
      directWasmBytes: compiled.module.byteLength,
      runtimeTransitions: executed.trace.length,
      semanticEffects: validation.occurrences.length,
      invocationFrames: validation.invocationFrames.length,
      correspondenceCandidates: correspondence.summary.candidates,
      supportedCorrespondences: correspondence.summary.supported,
      unsupportedCorrespondences: correspondence.summary.unsupported,
      maxCertifiedDepth: correspondence.summary.maxCertifiedDepth,
      leanCertificateBytes: certificate ? Buffer.byteLength(certificate.lean) : null,
      certifiedRuntimeWitnesses: certificate?.certified.length ?? null
    },
    timings
  });
  console.log('ok');
}

const json = `${JSON.stringify(report, null, 2)}\n`;
if (options.out) write(options.out, json);
if (options.csv) write(options.csv, toCsv(report));
if (!options.out) process.stdout.write(json);
else console.log(`wrote ${options.out}`);
if (options.csv) console.log(`wrote ${options.csv}`);

async function measure(fn, config) {
  for (let index = 0; index < config.warmup; index += 1) await fn();
  const samples = [];
  for (let index = 0; index < config.iterations; index += 1) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return summarize(samples);
}

function summarize(samples) {
  const ordered = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, value) => acc + value, 0);
  return {
    samples: samples.map(round),
    min: round(ordered[0]),
    median: round(percentile(ordered, 0.5)),
    mean: round(sum / samples.length),
    p95: round(percentile(ordered, 0.95)),
    max: round(ordered[ordered.length - 1])
  };
}

function percentile(ordered, fraction) {
  if (ordered.length === 1) return ordered[0];
  const position = (ordered.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower];
  const weight = position - lower;
  return ordered[lower] * (1 - weight) + ordered[upper] * weight;
}

function assertRepresentative(generated, executed, validation, correspondence, certificate) {
  if (!Object.is(executed.state.score, generated.expected.finalScore)) {
    throw new Error(`Evaluation corpus execution mismatch: expected score ${generated.expected.finalScore}, observed ${executed.state.score}.`);
  }
  if (executed.trace.length !== generated.expected.runtimeTransitions) {
    throw new Error(`Evaluation trace mismatch: expected ${generated.expected.runtimeTransitions}, observed ${executed.trace.length}.`);
  }
  if (validation.ok !== true || validation.summary.transitions !== generated.expected.runtimeTransitions) {
    throw new Error('Independent semantic-effect validation did not accept the representative execution.');
  }
  if (correspondence.summary.unsupported !== 0 || correspondence.summary.supported < generated.expected.rootToFirstLayerWitnesses) {
    throw new Error(`Beta.32 correspondence did not fully support the representative scenario: ${JSON.stringify(correspondence.summary)}.`);
  }
  if (certificate && certificate.certified.length !== correspondence.summary.supported) {
    throw new Error(`Generated certificate count ${certificate.certified.length} does not match supported correspondence count ${correspondence.summary.supported}.`);
  }
}

function environmentManifest() {
  const cpus = os.cpus();
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    release: os.release(),
    arch: process.arch,
    cpuModel: cpus[0]?.model ?? 'unknown',
    logicalCpus: cpus.length,
    totalMemoryBytes: os.totalmem()
  };
}

function toCsv(data) {
  const header = [
    'scenario','nested_depth','invocations','source_bytes','wasm_bytes','runtime_transitions','semantic_effects',
    'invocation_frames','supported_correspondences','max_certified_depth','lean_certificate_bytes',
    'compile_median_ms','execute_median_ms','validate_median_ms','correspondence_median_ms','certificate_generation_median_ms'
  ];
  const rows = data.scenarios.map(item => [
    item.name,
    item.parameters.nestedDepth,
    item.parameters.invocations,
    item.source.bytes,
    item.artifacts.directWasmBytes,
    item.artifacts.runtimeTransitions,
    item.artifacts.semanticEffects,
    item.artifacts.invocationFrames,
    item.artifacts.supportedCorrespondences,
    item.artifacts.maxCertifiedDepth,
    item.artifacts.leanCertificateBytes ?? '',
    item.timings.compileMs.median,
    item.timings.executeMs.median,
    item.timings.validateMs.median,
    item.timings.correspondenceMs.median,
    item.timings.certificateGenerationMs?.median ?? ''
  ]);
  return `${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}\n`;
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

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function round(value) { return Number(value.toFixed(3)); }

function parseArgs(args) {
  const config = { preset: 'quick', iterations: 5, warmup: 1, out: null, csv: null, skipCertificate: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--preset') config.preset = requireValue(args, ++index, '--preset');
    else if (arg === '--iterations') config.iterations = positiveInt(requireValue(args, ++index, '--iterations'), '--iterations', 1, 100);
    else if (arg === '--warmup') config.warmup = positiveInt(requireValue(args, ++index, '--warmup'), '--warmup', 0, 50);
    else if (arg === '--out') config.out = requireValue(args, ++index, '--out');
    else if (arg === '--csv') config.csv = requireValue(args, ++index, '--csv');
    else if (arg === '--skip-certificate') config.skipCertificate = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/benchmark-assurance.js [--preset smoke|quick|paper] [--iterations N] [--warmup N] [--out report.json] [--csv report.csv] [--skip-certificate]');
      process.exit(0);
    } else throw new Error(`Unknown argument '${arg}'.`);
  }
  assuranceEvaluationScenarios(config.preset);
  return config;
}

function positiveInt(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be ${min}..${max}.`);
  return parsed;
}
function requireValue(args, index, name) {
  if (index >= args.length) throw new Error(`${name} requires a value.`);
  return args[index];
}
