#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const options = parseArgs(process.argv.slice(2));
const summary = readSummary(options.summary);
const analysis = analyze(summary);

if (options.markdown) write(options.markdown, toMarkdown(analysis));
if (options.tex) write(options.tex, toTex(analysis));
if (options.json) write(options.json, `${JSON.stringify(analysis, null, 2)}\n`);
if (options.svg) write(options.svg, toSvg(analysis));
if (!options.markdown && !options.tex && !options.json && !options.svg) process.stdout.write(toMarkdown(analysis));

if (options.syncPaper) {
  if (summary.measurementClass !== 'controlled') {
    throw new Error(`Refusing to sync ${summary.measurementClass} timing into the manuscript. Only measurement-class controlled results may become paper candidates.`);
  }
  throw new Error('Manuscript synchronization remains a review step. Write --tex/--markdown for a candidate table; do not rewrite paper/main.tex from this runner.');
}

function parseArgs(args) {
  const result = { summary: null, markdown: null, tex: null, json: null, svg: null, syncPaper: false };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--summary') result.summary = requireValue(args, ++index, '--summary');
    else if (token === '--markdown') result.markdown = requireValue(args, ++index, '--markdown');
    else if (token === '--tex') result.tex = requireValue(args, ++index, '--tex');
    else if (token === '--json') result.json = requireValue(args, ++index, '--json');
    else if (token === '--svg') result.svg = requireValue(args, ++index, '--svg');
    else if (token === '--sync-paper') result.syncPaper = true;
    else if (token === '--help' || token === '-h') {
      console.log('Usage: node scripts/analyze-assurance-results.js --summary controlled-summary.json [--markdown out.md] [--tex out.tex] [--json out.json] [--svg out.svg]');
      process.exit(0);
    } else throw new Error(`Unknown argument '${token}'.`);
  }
  if (!result.summary) throw new Error('--summary is required.');
  return result;
}

function requireValue(args, index, name) {
  if (index >= args.length) throw new Error(`${name} requires a value.`);
  return args[index];
}

function readSummary(filename) {
  const summary = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
  if (summary.format !== 'patch-controlled-assurance-evaluation') {
    throw new Error(`Unexpected summary format '${summary.format}'.`);
  }
  if (!Array.isArray(summary.aggregates) || summary.aggregates.length === 0) {
    throw new Error('Summary contains no aggregates.');
  }
  return summary;
}

function analyze(summary) {
  const publicationEligible = summary.measurementClass === 'controlled';
  const phases = ['compileMs', 'executeMs', 'validateMs', 'correspondenceMs', 'certificateGenerationMs'];
  const rows = [];
  for (const scenario of summary.aggregates) {
    for (const phase of phases) {
      const stats = scenario.acrossProcessRunMedians?.[phase];
      if (!stats) continue;
      rows.push({
        scenario: scenario.name,
        nestedDepth: scenario.parameters?.nestedDepth ?? null,
        invocations: scenario.parameters?.invocations ?? null,
        phase,
        count: stats.count,
        min: stats.min,
        q1: stats.q1,
        median: stats.median,
        q3: stats.q3,
        p95: stats.p95,
        max: stats.max,
        mean: stats.mean,
        mad: stats.mad,
        iqr: stats.iqr,
        relativeIqr: stats.median === 0 ? null : round(stats.iqr / stats.median),
        sourceBytes: scenario.source?.bytes ?? null,
        wasmBytes: scenario.artifacts?.directWasmBytes ?? null,
        runtimeTransitions: scenario.artifacts?.runtimeTransitions ?? null,
        invocationFrames: scenario.artifacts?.invocationFrames ?? null
      });
    }
  }

  const models = [];
  for (const phase of phases) {
    const depthPoints = rows.filter(row => row.phase === phase && Number.isFinite(row.nestedDepth) && Number.isFinite(row.median));
    const invocationPoints = rows.filter(row => row.phase === phase && Number.isFinite(row.invocations) && Number.isFinite(row.median));
    const depthModel = ordinaryLeastSquares(depthPoints.map(row => [row.nestedDepth, row.median]));
    const invocationModel = ordinaryLeastSquares(invocationPoints.map(row => [row.invocations, row.median]));
    if (depthModel || invocationModel) {
      models.push({
        phase,
        medianVsNestedDepth: depthModel,
        medianVsInvocations: invocationModel
      });
    }
  }

  return {
    format: 'patch-assurance-analysis',
    version: '0.1',
    patchVersion: summary.patchVersion,
    sourceCommit: summary.sourceCommit,
    measurementClass: summary.measurementClass,
    claimBoundary: publicationEligible
      ? 'controlled-measurement candidate; manuscript inclusion still requires review'
      : 'non-publication timing evidence; do not use as paper performance results',
    publicationEligible,
    label: summary.label ?? null,
    machineId: summary.machineId ?? null,
    runs: summary.runs,
    iterations: summary.iterations,
    warmup: summary.warmup,
    rows,
    models,
    notes: [
      'Models are ordinary least squares of process-median milliseconds against a single predictor.',
      'They are descriptive scaling sketches, not asymptotic complexity claims.',
      'Relative IQR is IQR/median of the across-process medians.'
    ]
  };
}

function ordinaryLeastSquares(points) {
  if (points.length < 2) return null;
  const n = points.length;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const [x, y] of points) {
    const dx = x - meanX;
    const dy = y - meanY;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  if (xx === 0) return { intercept: round(meanY), slope: 0, r2: null, n };
  const slope = xy / xx;
  const intercept = meanY - slope * meanX;
  const r2 = yy === 0 ? 1 : (xy * xy) / (xx * yy);
  return { intercept: round(intercept), slope: round(slope), r2: round(r2), n };
}

function toMarkdown(analysis) {
  const lines = [
    '# Patch assurance analysis',
    '',
    `- measurement class: \`${analysis.measurementClass}\``,
    `- claim boundary: ${analysis.claimBoundary}`,
    `- Patch version: ${analysis.patchVersion}`,
    `- source commit: ${analysis.sourceCommit}`,
    `- process runs: ${analysis.runs}`,
    `- publication eligible: ${analysis.publicationEligible}`,
    '',
    '## Across-process medians',
    '',
    '| Scenario | Depth | Invocations | Phase | n | Median ms | Q1 | Q3 | IQR | MAD | Rel. IQR |',
    '|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|'
  ];
  for (const row of analysis.rows) {
    lines.push(`| ${row.scenario} | ${fmt(row.nestedDepth)} | ${fmt(row.invocations)} | ${row.phase} | ${row.count} | ${fmt(row.median)} | ${fmt(row.q1)} | ${fmt(row.q3)} | ${fmt(row.iqr)} | ${fmt(row.mad)} | ${fmt(row.relativeIqr)} |`);
  }
  lines.push('', '## Descriptive linear sketches', '');
  if (analysis.models.length === 0) lines.push('No model had two or more points.');
  else {
    lines.push('| Phase | Predictor | n | Intercept | Slope | R² |', '|---|---|---:|---:|---:|---:|');
    for (const model of analysis.models) {
      if (model.medianVsNestedDepth) {
        lines.push(`| ${model.phase} | nestedDepth | ${model.medianVsNestedDepth.n} | ${fmt(model.medianVsNestedDepth.intercept)} | ${fmt(model.medianVsNestedDepth.slope)} | ${fmt(model.medianVsNestedDepth.r2)} |`);
      }
      if (model.medianVsInvocations) {
        lines.push(`| ${model.phase} | invocations | ${model.medianVsInvocations.n} | ${fmt(model.medianVsInvocations.intercept)} | ${fmt(model.medianVsInvocations.slope)} | ${fmt(model.medianVsInvocations.r2)} |`);
      }
    }
  }
  lines.push('', 'These sketches do not become paper performance claims unless the measurement class is `controlled` and the dataset is separately reviewed.', '');
  return `${lines.join('\n')}\n`;
}

function toSvg(analysis) {
  const banner = analysis.publicationEligible
    ? 'controlled-measurement candidate — review before manuscript inclusion'
    : 'NON-PUBLICATION timing evidence';
  const depthRows = analysis.rows.filter(row => row.phase === 'correspondenceMs' && Number.isFinite(row.nestedDepth) && Number.isFinite(row.median));
  const invocationRows = analysis.rows.filter(row => row.phase === 'correspondenceMs' && Number.isFinite(row.invocations) && Number.isFinite(row.median));
  const depthModel = analysis.models.find(model => model.phase === 'correspondenceMs')?.medianVsNestedDepth ?? null;
  const invocationModel = analysis.models.find(model => model.phase === 'correspondenceMs')?.medianVsInvocations ?? null;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 280" width="760" height="280" role="img">
  <title>Patch assurance scaling sketches (${escapeXml(analysis.measurementClass)})</title>
  <rect width="760" height="280" fill="#fafafa"/>
  <text x="380" y="22" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" fill="#111">${escapeXml(banner)}</text>
  ${panel(24, 40, 344, 214, 'nestedDepth', depthRows.map(row => [row.nestedDepth, row.median]), depthModel)}
  ${panel(392, 40, 344, 214, 'invocations', invocationRows.map(row => [row.invocations, row.median]), invocationModel)}
</svg>
`;
}

function panel(x, y, width, height, label, points, model) {
  const pad = 28;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xs = points.map(([px]) => px);
  const ys = points.map(([, py]) => py);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 1;
  const minY = 0;
  const maxY = ys.length ? Math.max(...ys, 1) : 1;
  const sx = value => x + pad + ((value - minX) / Math.max(maxX - minX, 1)) * innerW;
  const sy = value => y + pad + innerH - ((value - minY) / Math.max(maxY - minY, 1)) * innerH;
  const dots = points.map(([px, py]) => `<circle cx="${sx(px).toFixed(1)}" cy="${sy(py).toFixed(1)}" r="3.2" fill="#18181b"/>`).join('');
  let fit = '';
  if (model && Number.isFinite(model.slope) && Number.isFinite(model.intercept) && xs.length >= 2) {
    const x0 = minX;
    const x1 = maxX;
    const y0 = model.intercept + model.slope * x0;
    const y1 = model.intercept + model.slope * x1;
    fit = `<line x1="${sx(x0).toFixed(1)}" y1="${sy(y0).toFixed(1)}" x2="${sx(x1).toFixed(1)}" y2="${sy(y1).toFixed(1)}" stroke="#71717a" stroke-width="1.4"/>`;
  }
  return `<g>
  <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff" stroke="#e4e4e7"/>
  <text x="${x + width / 2}" y="${y + 16}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#52525b">correspondenceMs vs ${escapeXml(label)}</text>
  ${fit}
  ${dots}
</g>`;
}

function escapeXml(value) {
  return String(value)
    .split('&').join('&' + 'amp;')
    .split('<').join('&' + 'lt;')
    .split('>').join('&' + 'gt;')
    .split('"').join('&' + 'quot;')
    .split("'").join('&' + 'apos;');
}

function toTex(analysis) {
  const banner = analysis.publicationEligible
    ? '% controlled-measurement candidate; do not copy into main.tex without review'
    : '% NON-PUBLICATION timing evidence; do not include in paper/main.tex';
  const rows = analysis.rows.map(row => [
    escapeTex(row.scenario),
    fmt(row.nestedDepth),
    fmt(row.invocations),
    escapeTex(row.phase),
    fmt(row.median),
    fmt(row.q1),
    fmt(row.q3),
    fmt(row.iqr)
  ].join(' & ')).join(' \\\\\n');
  return `${banner}
% measurementClass=${analysis.measurementClass}
% patchVersion=${analysis.patchVersion}
% sourceCommit=${analysis.sourceCommit}
\\begin{tabular}{@{}lrrlrrrr@{}}
\\toprule
Scenario & Depth & Invocations & Phase & Median & Q1 & Q3 & IQR \\\\
\\midrule
${rows}
\\\\
\\bottomrule
\\end{tabular}
`;
}

function write(filename, content) {
  const target = path.resolve(filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  console.log(`wrote ${target}`);
}

function fmt(value) {
  return value == null ? '' : String(value);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function escapeTex(value) {
  return String(value).replace(/[_%#&]/g, '\\$&');
}
