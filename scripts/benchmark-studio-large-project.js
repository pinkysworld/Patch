#!/usr/bin/env node
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { parse } from '../src/parser.js';
import { compile } from '../src/compiler.js';
import { listDesignerControls, listDesignerWindows } from '../src/designer.js';
import { buildStudioDesignModel } from '../src/studio-design-model.js';

export const STUDIO_STRESS_FORMS = 10;
export const STUDIO_STRESS_CONTROLS_PER_FORM = 20;

export function buildStudioLargeProjectFixture(options = {}) {
  const forms = positiveInteger(options.forms ?? STUDIO_STRESS_FORMS, 'forms');
  const controlsPerForm = positiveInteger(options.controlsPerForm ?? STUDIO_STRESS_CONTROLS_PER_FORM, 'controlsPerForm');
  const lines = [];

  for (let formIndex = 0; formIndex < forms; formIndex += 1) {
    if (lines.length) lines.push('');
    const formNumber = formIndex + 1;
    lines.push(`window "Stress Form ${formNumber}" as stress_form_${formNumber} size 1280, 900:`);

    for (let controlIndex = 0; controlIndex < controlsPerForm; controlIndex += 1) {
      const row = Math.floor(controlIndex / 5);
      const column = controlIndex % 5;
      const x = 24 + column * 238;
      const y = 28 + row * 86;
      const number = controlIndex + 1;
      if (controlIndex % 2 === 0) {
        lines.push(`  text "Form ${formNumber} label ${number}" at ${x}, ${y} size 210, 30`);
      } else {
        lines.push(`  button "Action ${number}" as stress_${formNumber}_button_${number} at ${x}, ${y} size 180, 38`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

export function runStudioLargeProjectBenchmark(options = {}) {
  const iterations = positiveInteger(options.iterations ?? 20, 'iterations');
  const warmup = nonNegativeInteger(options.warmup ?? 3, 'warmup');
  const source = options.source ?? buildStudioLargeProjectFixture(options);

  for (let index = 0; index < warmup; index += 1) runOne(source);

  const samples = [];
  let last = null;
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    last = runOne(source);
    samples.push(performance.now() - started);
  }

  const sorted = [...samples].sort((left, right) => left - right);
  return Object.freeze({
    contract: 'patch-studio-large-project-benchmark-0.1',
    forms: last.windows.length,
    controls: last.controls.length,
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    iterations,
    warmup,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.at(-1) ?? 0
  });
}

export function runStudioMainThreadBenchmark(options = {}) {
  const iterations = positiveInteger(options.iterations ?? 20, 'iterations');
  const warmup = nonNegativeInteger(options.warmup ?? 3, 'warmup');
  const cases = options.cases ?? representativeMainThreadCases(options);

  return Object.freeze({
    contract: 'patch-studio-main-thread-benchmark-0.1',
    runtime: Object.freeze({
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }),
    iterations,
    warmup,
    cases: Object.freeze(cases.map(benchmarkCase => benchmarkMainThreadCase(benchmarkCase, {
      iterations,
      warmup
    })))
  });
}

function benchmarkMainThreadCase(benchmarkCase, options) {
  const source = String(benchmarkCase.source ?? '');
  const name = String(benchmarkCase.name ?? '').trim();
  if (!name || !source.trim()) throw new Error('Main-thread benchmark cases require a name and Patch source.');

  const windows = listDesignerWindows(source);
  const controls = listDesignerControls(source);
  return Object.freeze({
    name,
    forms: windows.length,
    controls: controls.length,
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    sourceLines: source.split(/\r?\n/).length,
    phases: Object.freeze({
      parse: measureOperation(source, value => parse(value), options),
      compile: measureOperation(
        source,
        value => compile(value, { name: `StudioBenchmark_${name}`, kind: 'window', entry: 'main.patch' }),
        options
      ),
      designModel: measureOperation(source, value => buildStudioDesignModel(value), options)
    })
  });
}

function representativeMainThreadCases(options) {
  return Object.freeze([
    Object.freeze({
      name: 'counter-window',
      source: fs.readFileSync(new URL('../examples/counter-window.patch', import.meta.url), 'utf8')
    }),
    Object.freeze({
      name: 'workshop-desk',
      source: fs.readFileSync(new URL('../examples/workshop-desk.patch', import.meta.url), 'utf8')
    }),
    Object.freeze({
      name: `scale-${options.forms ?? STUDIO_STRESS_FORMS}x${options.controlsPerForm ?? STUDIO_STRESS_CONTROLS_PER_FORM}`,
      source: buildStudioLargeProjectFixture(options)
    })
  ]);
}

function measureOperation(source, operation, options) {
  for (let index = 0; index < options.warmup; index += 1) operation(source);

  const samples = [];
  for (let index = 0; index < options.iterations; index += 1) {
    const started = performance.now();
    operation(source);
    samples.push(performance.now() - started);
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    samples: sorted.length,
    minMs: roundMs(sorted[0] ?? 0),
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    meanMs: roundMs(sorted.length ? total / sorted.length : 0),
    maxMs: roundMs(sorted.at(-1) ?? 0)
  });
}

function runOne(source) {
  const windows = listDesignerWindows(source);
  const controls = listDesignerControls(source);
  const compiled = compile(source, { name: 'StudioLargeProjectStress', kind: 'window', entry: 'main.patch' });
  return { windows, controls, compiled };
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return roundMs(sorted[index]);
}

function roundMs(value) {
  return Number(value.toFixed(3));
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function nonNegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer.`);
  return number;
}

function cliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--iterations') { options.iterations = Number(next); index += 1; }
    else if (token === '--warmup') { options.warmup = Number(next); index += 1; }
    else if (token === '--forms') { options.forms = Number(next); index += 1; }
    else if (token === '--controls-per-form') { options.controlsPerForm = Number(next); index += 1; }
    else if (token === '--main-thread') options.mainThread = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`Unknown option '${token}'.`);
  }
  return options;
}

function printHelp() {
  process.stdout.write(`Patch Studio large-project benchmark\n\nUsage:\n  node scripts/benchmark-studio-large-project.js [options]\n\nOptions:\n  --iterations N          measured iterations, default 20\n  --warmup N              warmup iterations, default 3\n  --forms N               generated Forms, default 10\n  --controls-per-form N   controls per Form, default 20\n  --main-thread           measure parse, compile and design-model phases across representative projects\n`);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    const options = cliOptions(process.argv.slice(2));
    if (options.help) printHelp();
    else if (options.mainThread) process.stdout.write(`${JSON.stringify(runStudioMainThreadBenchmark(options), null, 2)}\n`);
    else process.stdout.write(`${JSON.stringify(runStudioLargeProjectBenchmark(options), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  }
}
