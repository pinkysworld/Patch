import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('assurance analysis refuses to sync non-controlled timing into the manuscript', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-assurance-analysis-'));
  try {
    const summaryPath = path.join(temp, 'controlled-summary.json');
    fs.writeFileSync(summaryPath, `${JSON.stringify(hostedSummary(), null, 2)}\n`);
    const markdownPath = path.join(temp, 'analysis.md');
    const texPath = path.join(temp, 'analysis.tex');
    const svgPath = path.join(temp, 'analysis.svg');
    const ok = spawnSync(process.execPath, [
      'scripts/analyze-assurance-results.js',
      '--summary', summaryPath,
      '--markdown', markdownPath,
      '--tex', texPath,
      '--svg', svgPath
    ], { cwd: repo, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);
    const markdown = fs.readFileSync(markdownPath, 'utf8');
    assert.match(markdown, /measurement class: `hosted-ci`/);
    assert.match(markdown, /non-publication timing evidence/);
    assert.match(markdown, /nestedDepth/);
    const tex = fs.readFileSync(texPath, 'utf8');
    assert.match(tex, /NON-PUBLICATION timing evidence/);
    assert.doesNotMatch(tex, /paper performance result/);
    const svg = fs.readFileSync(svgPath, 'utf8');
    assert.match(svg, /NON-PUBLICATION timing evidence/);
    assert.match(svg, /correspondenceMs vs nestedDepth/);
    assert.doesNotMatch(svg, /paper performance result/);

    const refused = spawnSync(process.execPath, [
      'scripts/analyze-assurance-results.js',
      '--summary', summaryPath,
      '--sync-paper'
    ], { cwd: repo, encoding: 'utf8' });
    assert.notEqual(refused.status, 0);
    assert.match(`${refused.stderr}\n${refused.stdout}`, /Refusing to sync hosted-ci timing/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('controlled summaries remain review-gated even when analysis is requested for the manuscript', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-assurance-analysis-controlled-'));
  try {
    const summaryPath = path.join(temp, 'controlled-summary.json');
    const summary = hostedSummary();
    summary.measurementClass = 'controlled';
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    const refused = spawnSync(process.execPath, [
      'scripts/analyze-assurance-results.js',
      '--summary', summaryPath,
      '--sync-paper'
    ], { cwd: repo, encoding: 'utf8' });
    assert.notEqual(refused.status, 0);
    assert.match(`${refused.stderr}\n${refused.stdout}`, /Manuscript synchronization remains a review step/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

function hostedSummary() {
  return {
    format: 'patch-controlled-assurance-evaluation',
    version: '0.2',
    patchVersion: '0.2.0-beta.35',
    sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    measurementClass: 'hosted-ci',
    claimBoundary: 'non-publication timing evidence; do not use as paper performance results',
    runs: 2,
    iterations: 1,
    warmup: 0,
    aggregates: [
      {
        name: 'depth-1',
        parameters: { nestedDepth: 1, invocations: 1 },
        source: { bytes: 120 },
        artifacts: { directWasmBytes: 80, runtimeTransitions: 1, invocationFrames: 2 },
        acrossProcessRunMedians: {
          compileMs: stats(10, 11),
          executeMs: stats(2, 3),
          validateMs: stats(4, 5),
          correspondenceMs: stats(20, 22)
        }
      },
      {
        name: 'depth-2',
        parameters: { nestedDepth: 2, invocations: 1 },
        source: { bytes: 160 },
        artifacts: { directWasmBytes: 90, runtimeTransitions: 1, invocationFrames: 3 },
        acrossProcessRunMedians: {
          compileMs: stats(12, 14),
          executeMs: stats(2, 4),
          validateMs: stats(5, 6),
          correspondenceMs: stats(24, 26)
        }
      }
    ]
  };
}

function stats(a, b) {
  const ordered = [a, b].sort((x, y) => x - y);
  return {
    samples: [a, b],
    count: 2,
    min: ordered[0],
    q1: ordered[0],
    median: (ordered[0] + ordered[1]) / 2,
    q3: ordered[1],
    p95: ordered[1],
    max: ordered[1],
    mean: (a + b) / 2,
    mad: Math.abs(a - b) / 2,
    iqr: ordered[1] - ordered[0]
  };
}
