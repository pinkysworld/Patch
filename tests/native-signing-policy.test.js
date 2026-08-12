import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  PATCH_SIGNING_STATUS_FORMAT,
  PATCH_SIGNING_STATUS_VERSION,
  buildSigningStatus,
  serializeSigningStatus
} from '../scripts/write-signing-status.js';

const workflow = fs.readFileSync('.github/workflows/native-distribution.yml', 'utf8');
const windowsScript = fs.readFileSync('scripts/sign-windows.ps1', 'utf8');
const macScript = fs.readFileSync('scripts/sign-notarize-macos.sh', 'utf8');

test('unsigned signing status is explicit and deterministic', () => {
  const first = buildSigningStatus({ platform: 'windows', requested: 'unsigned' });
  const second = buildSigningStatus({ platform: 'windows', requested: 'unsigned' });
  assert.deepEqual(first, second);
  assert.equal(first.format, PATCH_SIGNING_STATUS_FORMAT);
  assert.equal(first.version, PATCH_SIGNING_STATUS_VERSION);
  assert.equal(first.signed, false);
  assert.equal(first.signatureVerified, false);
  assert.equal(first.distributionStatus, 'unsigned');
  assert.equal(serializeSigningStatus(first), serializeSigningStatus(second));
});

test('required Windows signing cannot be claimed without verification', () => {
  assert.throws(() => buildSigningStatus({ platform: 'windows', requested: 'require', verified: false }), /required.*no verified/i);
  const signed = buildSigningStatus({ platform: 'windows', requested: 'require', verified: true });
  assert.equal(signed.distributionStatus, 'signed');
  assert.equal(signed.signatureVerified, true);
});

test('required macOS signing also requires verified notarization', () => {
  assert.throws(() => buildSigningStatus({ platform: 'macos', requested: 'require', verified: true, notarized: false }), /notarization/i);
  const signed = buildSigningStatus({ platform: 'macos', requested: 'require', verified: true, notarized: true });
  assert.equal(signed.distributionStatus, 'signed-and-notarized');
  assert.equal(signed.notarized, true);
});

test('Linux refuses an undefined require-signing claim', () => {
  assert.throws(() => buildSigningStatus({ platform: 'linux', requested: 'require', verified: true }), /supported only for Windows and macOS/);
});

test('signing status CLI fails closed when required verification is absent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-signing-status-'));
  try {
    const out = path.join(dir, 'PATCH-SIGNING.json');
    const failed = spawnSync(process.execPath, ['scripts/write-signing-status.js', '--platform', 'windows', '--requested', 'require', '--verified', 'false', '--out', out], { encoding: 'utf8' });
    assert.equal(failed.status, 2);
    assert.equal(fs.existsSync(out), false);

    execFileSync(process.execPath, ['scripts/write-signing-status.js', '--platform', 'linux', '--requested', 'unsigned', '--verified', 'false', '--out', out]);
    const status = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(status.distributionStatus, 'unsigned');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Windows signing gate uses SHA-256 timestamping and verifies every executable', () => {
  for (const marker of [
    'PATCH_WINDOWS_PFX_BASE64', 'PATCH_WINDOWS_PFX_PASSWORD', 'signtool.exe',
    'sign /fd SHA256 /td SHA256 /tr', 'verify /pa /v', 'Remove-Item -LiteralPath $tempPfx'
  ]) assert.ok(windowsScript.includes(marker), marker);
});

test('macOS gate verifies Developer ID signing notarization and stapling', () => {
  for (const marker of [
    'PATCH_MACOS_P12_BASE64', 'PATCH_MACOS_SIGN_IDENTITY', 'PATCH_APPLE_ID', 'PATCH_APPLE_TEAM_ID', 'PATCH_APPLE_APP_PASSWORD',
    'codesign --force --deep --options runtime --timestamp', 'codesign --verify --deep --strict',
    'xcrun notarytool submit', '--wait', 'xcrun stapler staple', 'xcrun stapler validate', 'spctl --assess'
  ]) assert.ok(macScript.includes(marker), marker);
  execFileSync('bash', ['-n', 'scripts/sign-notarize-macos.sh']);
});

test('native distribution workflow defaults unsigned and gates required signing per platform', () => {
  assert.match(workflow, /signing_mode:/);
  assert.match(workflow, /options: \[unsigned, require\]/);
  assert.match(workflow, /default: unsigned/);
  assert.match(workflow, /if: inputs\.signing_mode == 'require'/);
  assert.match(workflow, /scripts\/sign-windows\.ps1/);
  assert.match(workflow, /scripts\/sign-notarize-macos\.sh/);
  assert.match(workflow, /scripts\/write-signing-status\.js/);
  assert.match(workflow, /Refuse undefined Linux signing claims/);
  assert.match(workflow, /PATCH-SIGNING\.json/);
});

test('native distribution workflow uses direct GUI backends rather than Electron compatibility packaging', () => {
  assert.match(workflow, /scripts\/build-native-gui\.js/);
  assert.match(workflow, /scripts\/build-native-sea\.js/);
  assert.doesNotMatch(workflow, /scripts\/build-native-window\.js/);
  assert.doesNotMatch(workflow, /electron-packager|npx electron/i);
});
