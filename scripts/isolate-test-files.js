#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = fs.readdirSync('tests')
  .filter(name => name.endsWith('.test.js'))
  .sort()
  .map(name => `tests/${name}`);

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--test', file], {
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status === 0) continue;
  failures.push(file);
  if (process.env.GITHUB_ACTIONS === 'true') {
    process.stdout.write(`::error file=${file}::Isolated Node test file failed\n`);
  }
  process.stdout.write(`\n=== ${file} ===\n`);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
}

if (failures.length) {
  console.error(`\n${failures.length} isolated test file(s) failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`ok ${files.length} test files pass independently`);
}
