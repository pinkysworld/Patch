import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readOfflineLinkInput } from '../src/offline-link-input.js';
import { createOfflineLinkPlan } from '../src/offline-linker.js';

const builder = fs.readFileSync(new URL('../scripts/build-offline-compiler.js', import.meta.url), 'utf8');
const runner = fs.readFileSync(new URL('../scripts/offline-compiler-runner.cjs', import.meta.url), 'utf8');
const cli = fs.readFileSync(new URL('../src/cli-entry.js', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/offline-compiler-native-v110-promotion.yml', import.meta.url), 'utf8');
const currentContract = fs.readFileSync(new URL('../src/native-current-contract.js', import.meta.url), 'utf8');
const fixtureScript = new URL('../scripts/create-native-v110-promotion-project.js', import.meta.url);

test('offline compiler can embed a second GUI runtime without replacing the Current Ready runtime asset', () => {
  assert.match(builder, /option\('--gui-runtime-v19'\)/);
  assert.match(builder, /'runtime\/gui\.bin\.gz'/);
  assert.match(builder, /'runtime\/gui-v19\.bin\.gz'/);
  assert.match(builder, /guiRuntimeV19: Boolean\(guiRuntimeV19\)/);
  assert.match(runner, /extractRuntime\('runtime\/gui-v19\.bin\.gz', 'runtime\/gui-v19\.bin'/);
  assert.match(runner, /PATCH_OFFLINE_GUI_RUNTIME_V19 = guiRuntimeV19/);
  assert.match(cli, /requested === 19/);
  assert.match(cli, /PATCH_OFFLINE_GUI_RUNTIME_V19/);
  assert.match(cli, /PATCH_OFFLINE_COMPILER_PLATFORM/);
  assert.match(cli, /payload v19 needs the embedded runtime v1\.10 promotion asset/);
  assert.match(cli, /guiRuntime: readRuntime\(selectGuiRuntimePath\(guiPayloadVersion\)\)/);
});

test('promotion workflow verifies immutable runtime releases and exercises default v17 plus explicit v19', () => {
  assert.match(workflow, /native-win32-runtime-v1\.10/);
  assert.match(workflow, /native-macos-runtime-v1\.10/);
  assert.match(workflow, /native-linux-runtime-v1\.10/);
  assert.match(workflow, /e31a426dc21cb0929241fe96ab96e270ad182b32/);
  assert.match(workflow, /sha256sum -c SHA256SUMS\.txt/);
  assert.match(workflow, /\.assets\[\].*\.digest/);
  assert.match(workflow, /--gui-runtime offline-runtime\/gui-current\.bin/);
  assert.match(workflow, /--gui-runtime-v19 'runtime-v110\/\$\{\{ matrix\.runtime_asset \}\}'/);
  assert.match(workflow, /responsive-window\.patch --name CurrentCompat/);
  assert.match(workflow, /--gui-payload-version 19 --name PromotionIcons/);
  assert.match(workflow, /ExtractAssociatedIcon/);
  assert.match(workflow, /hicolor\/256x256\/apps\/PromotionIcons\.png/);
  assert.match(workflow, /CFBundleIconFile/);
  assert.match(workflow, /macos-15-intel/);
  assert.match(workflow, /Intel default output is not payload v17/);
  assert.match(workflow, /Intel promotion output is not payload v19/);
});

test('promotion fixture is a project-v4 resource bundle suitable for real payload-v19 packaging', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-v110-promotion-fixture-'));
  const file = path.join(temp, 'WindowIconsPromotion.patchproject');
  try {
    const result = spawnSync(process.execPath, [fixtureScript.pathname, '--out', file, '--target', 'native-linux'], {
      cwd: path.resolve(new URL('..', import.meta.url).pathname),
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const input = readOfflineLinkInput(file);
    assert.equal(input.format, 'patch-studio-project');
    assert.equal(input.resources.length, 3);
    assert.match(input.source, /imagelist as app_images/);
    const appIcon = input.resources.find(resource => resource.id === 'app.icon');
    assert.ok(appIcon);
    const bytes = Buffer.from(appIcon.data, 'base64');
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 256);
    assert.equal(appIcon.size, bytes.length);
    assert.equal(appIcon.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));

    const plan = createOfflineLinkPlan(input.source, {
      platform: 'linux',
      name: 'PromotionIcons',
      guiRuntime: Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0x00]),
      guiPayloadVersion: 19,
      resources: input.resources
    });
    assert.equal(plan.guiPayloadVersion, 19);
    assert.equal(plan.guiRuntimeVersion, '1.10');
    assert.ok(plan.files.some(item => item.path === 'share/icons/hicolor/256x256/apps/PromotionIcons.png'));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('promotion candidate does not silently change the Current Ready product contract', () => {
  assert.match(currentContract, /native-gui-1\.7\/payload-17\/runtime-1\.8/);
  assert.match(currentContract, /PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1\.8'/);
  assert.match(currentContract, /native-win32-runtime-v1\.8/);
  assert.match(currentContract, /native-macos-runtime-v1\.8/);
  assert.match(currentContract, /native-linux-runtime-v1\.8/);
});
