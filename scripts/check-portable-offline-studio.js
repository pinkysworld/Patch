#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const out = path.resolve('dist-offline-studio-portable');
const built = spawnSync(process.execPath, ['scripts/build-portable-offline-studio.js', '--out', out], {
  stdio: 'inherit',
  env: process.env
});
if (built.error) fail(`could not start portable Offline Studio builder: ${built.error.message}`);
if (built.status !== 0) fail(`portable Offline Studio builder exited with status ${built.status}`);

for (const relative of ['PatchStudio.cjs', 'patch-studio', 'PatchStudio.cmd', 'README.txt', 'offline-studio-manifest.json', 'site/index.html']) {
  const target = path.join(out, relative);
  if (!fs.existsSync(target) || fs.statSync(target).size <= 0) fail(`portable bundle is missing ${relative}`);
}

const smoke = spawnSync(process.execPath, [path.join(out, 'PatchStudio.cjs')], {
  stdio: 'inherit',
  timeout: 15000,
  env: {
    ...process.env,
    PATCH_OFFLINE_STUDIO_SMOKE: '1'
  }
});
if (smoke.error) fail(`portable Offline Studio smoke could not run: ${smoke.error.message}`);
if (smoke.status !== 0) fail(`portable Offline Studio smoke exited with status ${smoke.status}`);

if (process.platform !== 'win32') {
  const shellSmoke = spawnSync(path.join(out, 'patch-studio'), [], {
    stdio: 'inherit',
    timeout: 15000,
    env: {
      ...process.env,
      PATCH_OFFLINE_STUDIO_SMOKE: '1'
    }
  });
  if (shellSmoke.error) fail(`portable Unix launcher smoke could not run: ${shellSmoke.error.message}`);
  if (shellSmoke.status !== 0) fail(`portable Unix launcher smoke exited with status ${shellSmoke.status}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(out, 'offline-studio-manifest.json'), 'utf8'));
if (manifest?.format !== 'patch-offline-studio-manifest' || !manifest.fileCount || !manifest.closureSha256) {
  fail('portable Offline Studio manifest is invalid');
}

console.log(`Portable Offline Studio verified: ${out}`);
console.log(`  files: ${manifest.fileCount}`);
console.log(`  closure sha256: ${manifest.closureSha256}`);

function fail(message) {
  console.error(`Portable Offline Studio CI: ${message}`);
  process.exit(2);
}
