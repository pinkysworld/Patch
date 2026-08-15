#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const options = parseArgs(process.argv.slice(2));
const sourceCommit = resolveSourceCommit();
validateMeasurementClass(options, sourceCommit);

const outDir = path.resolve(options.outDir);
const rawDir = path.join(outDir, 'raw');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(rawDir, { recursive: true });

const runs = [];
let expectedEnvironment = null;
let expectedScenarioShape = null;

for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
  const jsonPath = path.join(rawDir, `run-${String(runIndex).padStart(2, '0')}.json`);
  const csvPath = path.join(rawDir, `run-${String(runIndex).padStart(2, '0')}.csv`);
  const args = [
    'scripts/benchmark-assurance.js',
    '--preset', options.preset,
    '--iterations', String(options.iterations),
    '--warmup', String(options.warmup),
    '--out', jsonPath,
    '--csv', csvPath
  ];
  if (options.skipCertificate) args.push('--skip-certificate');

  process.stdout.write(`controlled assurance process ${runIndex}/${options.runs} ... `);
  const child = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATCH_EVAL_COMMIT: sourceCommit,
      PATCH_EVAL_PROCESS_INDEX: String(runIndex),
      PATCH_EVAL_MEASUREMENT_CLASS: options.measurementClass
    },
    maxBuffer: 64 * 1024 * 1024
  });
  if (child.status !== 0) {
    throw new Error(`Assurance process ${runIndex} failed.\n${child.stderr || child.stdout}`);
  }

  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  validateChildReport(report, runIndex);
  const environment = normalizeEnvironment(report.environment);
  if (expectedEnvironment === null) expectedEnvironment = environment;
  else if (stableJson(environment) !== stableJson(expectedEnvironment)) {
    throw new Error(`Environment drift detected in process ${runIndex}. Controlled aggregation requires the same recorded machine/runtime identity for every process.`);
  }

  const scenarioShape = report.scenarios.map(scenario => ({
    name: scenario.name,
    nestedDepth: scenario.parameters.nestedDepth,
    invocations: scenario.parameters.invocations
  }));
  if (expectedScenarioShape === null) expectedScenarioShape = scenarioShape;
  else if (stableJson(scenarioShape) !== stableJson(expectedScenarioShape)) {
    throw new Error(`Scenario drift detected in process ${runIndex}.`);
  }

  runs.push({
    index: runIndex,
    reportFile: path.relative(outDir, jsonPath).replaceAll(path.sep, '/'),
    csvFile: path.relative(outDir, csvPath).replaceAll(path.sep, '/'),
    reportSha256: sha256File(jsonPath),
    csvSha256: sha256File(csvPath),
    generatedAt: report.generatedAt,
    report
  });
  console.log('ok');
}

const environmentFingerprint = sha256Text(stableJson(expectedEnvironment));
const aggregates = aggregateRuns(runs);
const protocolChecks = {
  independentProcesses: runs.length === options.runs,
  exactSourceCommit: /^[0-9a-f]{40}$/i.test(sourceCommit),
  stableEnvironmentIdentity: true,
  stableScenarioSet: true,
  rawReportsRetained: true,
  requestedRuns: options.runs,
  measuredIterationsPerPhasePerProcess: options.iterations,
  warmupIterationsPerPhasePerProcess: options.warmup
};

const summary = {
  format: 'patch-controlled-assurance-evaluation',
  version: '0.1',
  patchVersion: pkg.version,
  sourceCommit,
  generatedAt: new Date().toISOString(),
  measurementClass: options.measurementClass,
  claimBoundary: options.measurementClass === 'controlled'
    ? 'controlled-measurement-candidate; publication claims still require protocol review and interpretation'
    : 'non-publication timing evidence; do not use as paper performance results',
  label: options.label,
  machineId: options.machineId,
  preset: options.preset,
  runs: options.runs,
  iterations: options.iterations,
  warmup: options.warmup,
  includeCertificateGeneration: !options.skipCertificate,
  processIsolation: 'one fresh Node process per independent run; within-process phase samples remain available in raw reports',
  environment: expectedEnvironment,
  environmentFingerprintSha256: environmentFingerprint,
  controllerEnvironment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    hostnameHashSha256: sha256Text(os.hostname())
  },
  protocolChecks,
  rawRuns: runs.map(({ report, ...metadata }) => metadata),
  aggregates
};

const summaryPath = path.join(outDir, 'controlled-summary.json');
const csvPath = path.join(outDir, 'controlled-summary.csv');
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(csvPath, toCsv(summary));
writeChecksums(outDir, summaryPath, csvPath, runs);

console.log(`wrote ${summaryPath}`);
console.log(`wrote ${csvPath}`);
console.log(`measurement class: ${options.measurementClass}`);
console.log(`environment fingerprint: ${environmentFingerprint}`);

function validateChildReport(report, runIndex) {
  if (report.format !== 'patch-assurance-evaluation') throw new Error(`Unexpected child report format in process ${runIndex}.`);
  if (report.patchVersion !== pkg.version) throw new Error(`Patch version drift in process ${runIndex}: ${report.patchVersion} != ${pkg.version}.`);
  if (report.preset !== options.preset) throw new Error(`Preset drift in process ${runIndex}.`);
  if (report.iterations !== options.iterations || report.warmup !== options.warmup) throw new Error(`Iteration protocol drift in process ${runIndex}.`);
  if (report.includeCertificateGeneration !== !options.skipCertificate) throw new Error(`Certificate-generation protocol drift in process ${runIndex}.`);
  if (!Array.isArray(report.scenarios) || report.scenarios.length === 0) throw new Error(`Process ${runIndex} produced no scenarios.`);
}

function normalizeEnvironment(environment) {
  return {
    node: environment.node,
    v8: environment.v8,
    platform: environment.platform,
    release: environment.release,
    arch: environment.arch,
    cpuModel: environment.cpuModel,
    logicalCpus: environment.logicalCpus,
    totalMemoryBytes: environment.totalMemoryBytes
  };
}

function aggregateRuns(runEntries) {
  const phases = ['compileMs', 'executeMs', 'validateMs', 'correspondenceMs', 'certificateGenerationMs'];
  return runEntries[0].report.scenarios.map((scenario, scenarioIndex) => {
    const artifactReference = scenario.artifacts;
    const phaseStats = {};
    for (const phase of phases) {
      const medians = runEntries
        .map(entry => entry.report.scenarios[scenarioIndex].timings[phase]?.median)
        .filter(value => Number.isFinite(value));
      if (medians.length > 0) phaseStats[phase] = robustSummary(medians);
    }
    return {
      name: scenario.name,
      parameters: scenario.parameters,
      source: scenario.source,
      artifacts: artifactReference,
      acrossProcessRunMedians: phaseStats
    };
  });
}

function robustSummary(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const med = quantile(ordered, 0.5);
  const deviations = values.map(value => Math.abs(value - med)).sort((a, b) => a - b);
  const q1 = quantile(ordered, 0.25);
  const q3 = quantile(ordered, 0.75);
  return {
    samples: values.map(round),
    count: values.length,
    min: round(ordered[0]),
    q1: round(q1),
    median: round(med),
    q3: round(q3),
    p95: round(quantile(ordered, 0.95)),
    max: round(ordered[ordered.length - 1]),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    mad: round(quantile(deviations, 0.5)),
    iqr: round(q3 - q1)
  };
}

function quantile(ordered, fraction) {
  if (ordered.length === 1) return ordered[0];
  const position = (ordered.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower];
  const weight = position - lower;
  return ordered[lower] * (1 - weight) + ordered[upper] * weight;
}

function toCsv(summaryReport) {
  const header = [
    'scenario','nested_depth','invocations','phase','process_runs','min_ms','q1_ms','median_ms','q3_ms','p95_ms','max_ms','mean_ms','mad_ms','iqr_ms',
    'source_bytes','wasm_bytes','runtime_transitions','semantic_effects','invocation_frames','supported_correspondences','lean_certificate_bytes'
  ];
  const rows = [];
  for (const scenario of summaryReport.aggregates) {
    for (const [phase, stats] of Object.entries(scenario.acrossProcessRunMedians)) {
      rows.push([
        scenario.name,
        scenario.parameters.nestedDepth,
        scenario.parameters.invocations,
        phase,
        stats.count,
        stats.min, stats.q1, stats.median, stats.q3, stats.p95, stats.max, stats.mean, stats.mad, stats.iqr,
        scenario.source.bytes,
        scenario.artifacts.directWasmBytes,
        scenario.artifacts.runtimeTransitions,
        scenario.artifacts.semanticEffects,
        scenario.artifacts.invocationFrames,
        scenario.artifacts.supportedCorrespondences,
        scenario.artifacts.leanCertificateBytes ?? ''
      ]);
    }
  }
  return `${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}\n`;
}

function writeChecksums(directory, summaryPath, aggregateCsvPath, runEntries) {
  const files = [summaryPath, aggregateCsvPath];
  for (const run of runEntries) {
    files.push(path.join(directory, run.reportFile));
    files.push(path.join(directory, run.csvFile));
  }
  const lines = files
    .map(file => `${sha256File(file)}  ${path.relative(directory, file).replaceAll(path.sep, '/')}`)
    .sort();
  fs.writeFileSync(path.join(directory, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

function validateMeasurementClass(config, commit) {
  const allowed = new Set(['controlled', 'hosted-ci', 'development']);
  if (!allowed.has(config.measurementClass)) throw new Error(`--measurement-class must be one of ${[...allowed].join(', ')}.`);
  if (config.measurementClass === 'controlled') {
    if (process.env.GITHUB_ACTIONS === 'true') throw new Error('Refusing to label GitHub-hosted Actions timing as controlled paper-quality measurement.');
    if (!config.machineId) throw new Error('--machine-id is required for --measurement-class controlled.');
    if (!config.label) throw new Error('--label is required for --measurement-class controlled.');
    if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('Controlled measurement requires an exact 40-character Git source commit.');
  }
}

function resolveSourceCommit() {
  const supplied = process.env.PATCH_EVAL_COMMIT?.trim();
  if (supplied) return supplied;
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (result.status === 0) return result.stdout.trim();
  return 'unknown';
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256File(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}
function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}
function round(value) { return Number(value.toFixed(3)); }
function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseArgs(args) {
  const config = {
    preset: 'paper',
    runs: 10,
    iterations: 10,
    warmup: 3,
    measurementClass: 'development',
    machineId: '',
    label: '',
    outDir: 'evaluation/results/controlled',
    skipCertificate: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--preset') config.preset = requireValue(args, ++index, '--preset');
    else if (arg === '--runs') config.runs = boundedInt(requireValue(args, ++index, '--runs'), '--runs', 1, 100);
    else if (arg === '--iterations') config.iterations = boundedInt(requireValue(args, ++index, '--iterations'), '--iterations', 1, 100);
    else if (arg === '--warmup') config.warmup = boundedInt(requireValue(args, ++index, '--warmup'), '--warmup', 0, 50);
    else if (arg === '--measurement-class') config.measurementClass = requireValue(args, ++index, '--measurement-class');
    else if (arg === '--machine-id') config.machineId = requireValue(args, ++index, '--machine-id');
    else if (arg === '--label') config.label = requireValue(args, ++index, '--label');
    else if (arg === '--out-dir') config.outDir = requireValue(args, ++index, '--out-dir');
    else if (arg === '--skip-certificate') config.skipCertificate = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/run-controlled-assurance.js [--preset smoke|quick|paper] [--runs N] [--iterations N] [--warmup N] [--measurement-class controlled|hosted-ci|development] [--machine-id ID] [--label LABEL] [--out-dir DIR] [--skip-certificate]');
      process.exit(0);
    } else throw new Error(`Unknown argument '${arg}'.`);
  }
  return config;
}

function boundedInt(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be ${min}..${max}.`);
  return parsed;
}
function requireValue(args, index, name) {
  if (index >= args.length) throw new Error(`${name} requires a value.`);
  return args[index];
}
