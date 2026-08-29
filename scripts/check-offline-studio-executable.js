#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const output = path.resolve(
  process.platform === 'win32'
    ? 'dist-offline-studio/PatchStudio.exe'
    : 'dist-offline-studio/PatchStudio'
);

const built = spawnSync(process.execPath, ['scripts/build-offline-studio.js', '--out', output], {
  stdio: 'inherit',
  env: process.env
});
if (built.error) fail(`could not start Offline Studio builder: ${built.error.message}`);
if (built.status !== 0) fail(`Offline Studio builder exited with status ${built.status}`);
if (!fs.existsSync(output)) fail(`expected executable was not created: ${output}`);

const smoke = spawnSync(output, [], {
  stdio: 'inherit',
  timeout: 15000,
  env: {
    ...process.env,
    PATCH_OFFLINE_STUDIO_SMOKE: '1'
  }
});
if (smoke.error) fail(`Offline Studio executable smoke could not run: ${smoke.error.message}`);
if (smoke.status !== 0) fail(`Offline Studio executable smoke exited with status ${smoke.status}`);

console.log(`Offline Studio executable verified: ${output}`);

function fail(message) {
  console.error(`Offline Studio CI: ${message}`);
  process.exit(2);
}
