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
  serializeSigningStatus,
  validateSigningStatus
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
  assert.equal(JSON.parse(serializeSigningStatus(signed)).distributionStatus, 'signed');
  assert.deepEqual(validateSigningStatus(signed), signed);
});

test('required macOS signing also requires verified notarization', () => {
  assert.throws(() => buildSigningStatus({ platform: 'macos', requested: 'require', verified: true, notarized: false }), /notarization/i);
  const signed = buildSigningStatus({ platform: 'macos', requested: 'require', verified: true, notarized: true });
  assert.equal(signed.distributionStatus, 'signed-and-notarized');
  assert.equal(signed.notarized, true);
  assert.equal(JSON.parse(serializeSigningStatus(signed)).distributionStatus, 'signed-and-notarized');
});

test('invalid or contradictory signing claims fail closed', () => {
  assert.throws(() => buildSigningStatus({ platform: 'windows', requested: 'required', verified: true }), /Unsupported Patch signing mode/);
  assert.throws(() => buildSigningStatus({ platform: 'windows', requested: 'unsigned', verified: true }), /Unsigned.*cannot claim/i);
  const tampered = buildSigningStatus({ platform: 'windows', requested: 'require', verified: true });
  tampered.signed = false;
  assert.throws(() => validateSigningStatus(tampered), /inconsistent/);
});

test('Linux refuses an undefined require-signing claim', () => {
  assert.throws(() => buildSigningStatus({ platform: 'linux', requested: 'require', verified: true }), /supported only for Windows and macOS/);
});

test('signing status CLI fails closed on missing verification and invalid booleans', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-signing-status-'));
  try {
    const out = path.join(dir, 'PATCH-SIGNING.json');
    const failed = spawnSync(process.execPath, ['scripts/write-signing-status.js', '--platform', 'windows', '--requested', 'require', '--verified', 'false', '--out', out], { encoding: 'utf8' });
    assert.equal(failed.status, 2);
    assert.equal(fs.existsSync(out), false);

    const invalidBoolean = spawnSync(process.execPath, ['scripts/write-signing-status.js', '--platform', 'windows', '--verified', 'yes', '--out', out], { encoding: 'utf8' });
    assert.equal(invalidBoolean.status, 2);
    assert.equal(fs.existsSync(out), false);

    execFileSync(process.execPath, ['scripts/write-signing-status.js', '--platform', 'linux', '--requested', 'unsigned', '--verified', 'false', '--out', out]);
    const status = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(status.distributionStatus, 'unsigned');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Windows signing gate uses SHA-256 timestamping, verifies every executable and emits evidence last', () => {
  for (const marker of [
    'PATCH_WINDOWS_PFX_BASE64', 'PATCH_WINDOWS_PFX_PASSWORD', 'signtool.exe',
    'sign /fd SHA256 /td SHA256 /tr', 'verify /pa /v /tw', 'Remove-Item -LiteralPath $tempPfx',
    '.patch-windows-signature-verified', 'windows-authenticode-v1'
  ]) assert.ok(windowsScript.includes(marker), marker);
  assert.ok(windowsScript.indexOf("Set-Content -LiteralPath $verificationPath") > windowsScript.indexOf('verify /pa /v /tw'));
});

test('macOS gate verifies Developer ID signing notarization stapling Gatekeeper and emits evidence last', () => {
  for (const marker of [
    'PATCH_MACOS_P12_BASE64', 'PATCH_MACOS_SIGN_IDENTITY', 'PATCH_APPLE_ID', 'PATCH_APPLE_TEAM_ID', 'PATCH_APPLE_APP_PASSWORD',
    'base64.b64decode', 'codesign --force --deep --options runtime --timestamp', 'codesign --verify --deep --strict',
    'xcrun notarytool submit', '--wait', '--output-format json', "status != 'Accepted'",
    'xcrun stapler staple', 'xcrun stapler validate', 'spctl --assess --type execute', 'ORIGINAL_KEYCHAINS',
    '.patch-macos-signature-verified', 'macos-developer-id-notarized-v1'
  ]) assert.ok(macScript.includes(marker), marker);
  assert.ok(macScript.indexOf("printf '%s' 'macos-developer-id-notarized-v1'") > macScript.indexOf('spctl --assess --type execute'));
  execFileSync('bash', ['-n', 'scripts/sign-notarize-macos.sh']);
});

test('native distribution workflow defaults unsigned and gates required signing per platform', () => {
  assert.match(workflow, /signing_mode:/);
  assert.match(workflow, /options: \[unsigned, require\]/);
  assert.match(workflow, /default: unsigned/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.signing_mode == 'require'/);
  assert.match(workflow, /scripts\/sign-windows\.ps1/);
  assert.match(workflow, /scripts\/sign-notarize-macos\.sh/);
  assert.match(workflow, /scripts\/write-signing-status\.js/);
  assert.match(workflow, /Refuse undefined Linux signing claims/);
  assert.match(workflow, /PATCH-SIGNING\.json/);
});

test('signed manifest claims are bound to platform verification evidence', () => {
  for (const marker of [
    'Required Windows signing evidence is missing.',
    'windows-authenticode-v1',
    'Required macOS signing evidence is missing.',
    'macos-developer-id-notarized-v1',
    'Remove-Item -LiteralPath $marker',
    'rm -f "$MARKER"'
  ]) assert.ok(workflow.includes(marker), marker);
  assert.doesNotMatch(workflow, /\$verified = if \(\$env:PATCH_SIGNING_MODE -eq 'require'\)/);
});

test('native distribution PR smoke runs unsigned without exposing signing secrets to build steps', () => {
  assert.match(workflow, /pull_request:\s*\n\s*types: \[opened, synchronize, reopened, ready_for_review\]/);
  assert.match(workflow, /github\.event\.pull_request\.draft == false/);
  const winStep = workflow.indexOf('- name: Require and verify Windows Authenticode signature');
  const winSecret = workflow.indexOf('PATCH_WINDOWS_PFX_BASE64');
  const macStep = workflow.indexOf('- name: Require verify and notarize macOS signature');
  const macSecret = workflow.indexOf('PATCH_MACOS_P12_BASE64');
  assert.ok(winStep > 0 && winSecret > winStep, 'Windows signing secret must be scoped to the signing step');
  assert.ok(macStep > 0 && macSecret > macStep, 'macOS signing secret must be scoped to the signing step');
  assert.match(workflow, /Install GTK3 build\/runtime dependencies/);
  assert.match(workflow, /libgtk-3-dev xvfb/);
});

test('native distribution workflow uses direct GUI backends rather than Electron compatibility packaging', () => {
  assert.match(workflow, /scripts\/build-native-gui\.js/);
  assert.match(workflow, /scripts\/build-native-sea\.js/);
  assert.doesNotMatch(workflow, /scripts\/build-native-window\.js/);
  assert.doesNotMatch(workflow, /electron-packager|npx electron/i);
  assert.match(workflow, /\.win32-build\.json/);
  assert.match(workflow, /\.appkit-build\.json/);
  assert.match(workflow, /\.gtk-build\.json/);
});
