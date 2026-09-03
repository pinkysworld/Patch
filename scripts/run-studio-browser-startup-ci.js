#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TEST_ARGS = Object.freeze([
  '--test',
  'tests/studio-browser-startup.test.js'
]);

const RETRYABLE_CHROME_STARTUP_FAILURES = Object.freeze([
  'Chrome did not expose DevTools within',
  'Chrome exited before DevTools was ready',
  'Chrome page target was not discoverable',
  'Timed out connecting to the Chrome page target',
  'Chrome DevTools WebSocket connection failed',
  'Chrome page stopped responding to Page.enable',
  'Chrome page stopped responding to Page.navigate',
  'Chrome DevTools connection closed'
]);

export function isRetryableStudioChromeStartupFailure(output) {
  const text = String(output ?? '');
  return RETRYABLE_CHROME_STARTUP_FAILURES.some(fragment => text.includes(fragment));
}

function runStartupGate() {
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
  const first = await runStartupGate();
  if (first.code === 0) return;
  if (!isRetryableStudioChromeStartupFailure(first.output)) process.exit(first.code);

  console.error('\nPatch CI detected a transient Studio Chrome/DevTools startup failure. Retrying the startup gate once with a fresh browser process and profile.\n');
  const second = await runStartupGate();
  process.exit(second.code);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(error => {
    console.error(error?.stack ?? String(error));
    process.exit(1);
  });
}
