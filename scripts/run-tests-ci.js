#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const child = spawn(process.execPath, ['--test'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe']
});

let combined = '';
const collect = chunk => {
  const text = chunk.toString();
  combined += text;
  if (combined.length > 8_000_000) combined = combined.slice(-8_000_000);
  return text;
};

child.stdout.on('data', chunk => process.stdout.write(collect(chunk)));
child.stderr.on('data', chunk => process.stderr.write(collect(chunk)));

child.on('error', error => {
  fs.writeFileSync('test-failures.txt', `Unable to start Node test runner: ${error.message}\n`);
  console.error(`Unable to start Node test runner: ${error.message}`);
  process.exitCode = 1;
});

child.on('close', (code, signal) => {
  if (code === 0) {
    try { fs.rmSync('test-failures.txt', { force: true }); } catch {}
    process.exit(0);
  }

  const lines = combined.replace(/\r\n/g, '\n').split('\n');
  const failures = [];
  const seen = new Set();
  for (const line of lines) {
    const clean = line.replace(/\u001b\[[0-9;]*m/g, '').trim();
    if (!clean) continue;
    if (clean.startsWith('✖ ') || /^not ok\b/i.test(clean) || /^test at .*:\d+:\d+$/i.test(clean)) {
      if (!seen.has(clean)) {
        seen.add(clean);
        failures.push(clean);
      }
    }
  }

  const summary = [
    'Patch full-suite concise failure summary',
    `exit=${code ?? 'null'} signal=${signal ?? 'none'}`,
    ...(failures.length ? failures : ['No structured failing-test line was detected; inspect the full job log.'])
  ].join('\n') + '\n';
  fs.writeFileSync('test-failures.txt', summary);
  console.error('\n========== concise failure summary ==========');
  console.error(summary.trimEnd());
  console.error('=============================================');
  process.exit(code || 1);
});
