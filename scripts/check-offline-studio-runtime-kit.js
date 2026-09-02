#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const out = path.resolve('dist-offline-studio-runtime-kit');
const built = spawnSync(process.execPath, ['scripts/build-offline-studio-runtime-kit.js', '--out', out], {
  stdio: 'inherit',
  env: process.env
});
if (built.error) fail(`could not start runtime-kit builder: ${built.error.message}`);
if (built.status !== 0) fail(`runtime-kit builder exited with status ${built.status}`);

const app = path.join(out, 'app');
const runtimeName = process.platform === 'win32' ? 'node.exe' : 'node';
const expected = [
  'PatchStudio.cjs', 'README.txt', 'offline-studio-manifest.json', 'runtime-kit.json', 'site/index.html', `runtime/${runtimeName}`
];
for (const relative of expected) {
  const target = path.join(app, relative);
  if (!fs.existsSync(target) || fs.statSync(target).size <= 0) fail(`runtime kit is missing ${relative}`);
}

const metadata = JSON.parse(fs.readFileSync(path.join(app, 'runtime-kit.json'), 'utf8'));
if (metadata?.format !== 'patch-offline-studio-runtime-kit' || metadata.platform !== process.platform || metadata.arch !== process.arch) {
  fail('runtime-kit metadata does not match the CI host');
}

const command = process.platform === 'win32' ? path.join(app, 'PatchStudio.cmd') : path.join(app, 'patch-studio');
const smoke = process.platform === 'win32'
  ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], smokeOptions())
  : spawnSync(command, [], smokeOptions());
if (smoke.error) fail(`runtime-kit smoke could not run: ${smoke.error.message}`);
if (smoke.signal) fail(`runtime-kit smoke was terminated by ${smoke.signal}`);
if (smoke.status !== 0) fail(`runtime-kit smoke exited with status ${smoke.status}`);

console.log(`Offline Studio runtime kit verified: ${app}`);
console.log(`  host: ${metadata.platform} ${metadata.arch}`);
console.log(`  embedded Node: ${metadata.node}`);

function smokeOptions() {
  return {
    stdio: 'inherit',
    timeout: 20000,
    env: { ...process.env, PATCH_OFFLINE_STUDIO_SMOKE: '1' }
  };
}

function fail(message) {
  console.error(`Offline Studio runtime-kit CI: ${message}`);
  process.exit(2);
}
