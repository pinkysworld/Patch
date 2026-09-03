#!/usr/bin/env node
import { spawn } from 'node:child_process';

const TEST_ARGS = Object.freeze([
  '--test',
  'tests/studio-browser-performance-contract.test.js',
  'tests/studio-browser-performance.test.js'
]);

const RETRYABLE_CHROME_STARTUP_FAILURES = Object.freeze([
  'Performance Chrome did not expose DevTools within',
  'Performance Chrome exited early',
  'Performance Chrome page target was not discoverable',
  'Chrome CDP connection timed out',
  'Chrome CDP connection failed'
]);

export function isRetryableChromeStartupFailure(output) {
  const text = String(output ?? '');
  return RETRYABLE_CHROME_STARTUP_FAILURES.some(fragment => text.includes(fragment));
}

function runPerformanceGate() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, TEST_ARGS, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    let output = '';
    const collect = (stream, chunk) => {
      const text = chunk.toString();
      output += text;
      if (output.length > 2_000_000) output = output.slice(-2_000_000);
      stream.write(text);
    };
    child.stdout.on('data', chunk => collect(process.stdout, chunk));
    child.stderr.on('data', chunk => collect(process.stderr, chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code: code ?? 1, signal, output }));
  });
}

async function main() {
  const first = await runPerformanceGate();
  if (first.code === 0) return;
  if (!isRetryableChromeStartupFailure(first.output)) process.exit(first.code);

  console.error('\nPatch CI detected a transient Chrome/DevTools startup failure. Retrying the browser performance gate once with a fresh browser process and profile.\n');
  const second = await runPerformanceGate();
  process.exit(second.code);
}

if (process.argv[1] && new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname) {
  main().catch(error => {
    console.error(error?.stack ?? String(error));
    process.exit(1);
  });
}