#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const output = path.resolve(
  process.platform === 'win32'
    ? 'dist-offline-studio/PatchStudio.exe'
    : 'dist-offline-studio/PatchStudio'
);
const compiler = process.env.PATCH_OFFLINE_STUDIO_COMPILER ? path.resolve(process.env.PATCH_OFFLINE_STUDIO_COMPILER) : null;
const buildArgs = ['scripts/build-offline-studio.js', '--out', output];
if (compiler) buildArgs.push('--offline-compiler', compiler);

const built = spawnSync(process.execPath, buildArgs, {
  stdio: 'inherit',
  env: process.env
});
if (built.error) fail(`could not start Offline Studio builder: ${built.error.message}`);
if (built.signal) fail(`Offline Studio builder was terminated by ${built.signal}`);
if (built.status !== 0) fail(`Offline Studio builder exited with status ${built.status}`);
if (!fs.existsSync(output)) fail(`expected executable was not created: ${output}`);

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-offline-studio-smoke-'));
try {
  const smoke = spawnSync(output, ['--workspace', workspace], {
    stdio: 'inherit',
    timeout: 30000,
    env: {
      ...process.env,
      PATCH_OFFLINE_STUDIO_SMOKE: '1',
      ...(compiler ? { PATCH_OFFLINE_STUDIO_EXPECT_LOCAL_BUILD: '1' } : {})
    }
  });
  if (smoke.error) fail(`Offline Studio executable smoke could not run: ${smoke.error.message}`);
  if (smoke.signal) fail(`Offline Studio executable smoke was terminated by ${smoke.signal}`);
  if (smoke.status !== 0) fail(`Offline Studio executable smoke exited with status ${smoke.status}`);
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}

console.log(`Offline Studio executable verified: ${output}`);
console.log(`  installed host build: ${compiler ? 'real native build smoke passed' : 'not packaged for this host'}`);

function fail(message) {
  console.error(`Offline Studio CI: ${message}`);
  process.exit(2);
}
