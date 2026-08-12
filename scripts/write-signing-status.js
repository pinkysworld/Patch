#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PATCH_SIGNING_STATUS_FORMAT = 'patch-signing-status';
export const PATCH_SIGNING_STATUS_VERSION = 1;

export function buildSigningStatus(options = {}) {
  const platform = normalizePlatform(options.platform);
  const requested = options.requested === 'require' ? 'require' : 'unsigned';
  const verified = options.verified === true;
  const notarized = options.notarized === true;

  if (platform === 'linux' && requested === 'require') throw new Error('Patch signing mode require is currently supported only for Windows and macOS.');
  if (requested === 'require' && !verified) throw new Error(`Patch ${platform} signing was required but no verified platform signature was recorded.`);
  if (platform === 'macos' && requested === 'require' && !notarized) throw new Error('Patch macOS signing was required but notarization was not verified.');
  if (platform !== 'macos' && notarized) throw new Error('Notarization status is only valid for macOS artifacts.');

  return {
    format: PATCH_SIGNING_STATUS_FORMAT,
    version: PATCH_SIGNING_STATUS_VERSION,
    platform,
    requested,
    signed: verified,
    signatureVerified: verified,
    notarized: platform === 'macos' ? notarized : false,
    distributionStatus: verified
      ? (platform === 'macos' && notarized ? 'signed-and-notarized' : 'signed')
      : 'unsigned'
  };
}

export function serializeSigningStatus(status) {
  return JSON.stringify(buildSigningStatus(status), null, 2) + '\n';
}

function normalizePlatform(value) {
  const platform = String(value ?? '').toLowerCase();
  if (!['windows', 'macos', 'linux'].includes(platform)) throw new Error(`Unsupported Patch signing platform '${value ?? ''}'.`);
  return platform;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--platform') options.platform = argv[++i];
    else if (arg === '--requested') options.requested = argv[++i];
    else if (arg === '--verified') options.verified = argv[++i] === 'true';
    else if (arg === '--notarized') options.notarized = argv[++i] === 'true';
    else if (arg === '--out') options.out = argv[++i];
    else throw new Error(`Unknown signing-status option '${arg}'.`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!options.out) throw new Error('Signing status output requires --out FILE.');
    const status = buildSigningStatus(options);
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(options.out, JSON.stringify(status, null, 2) + '\n');
    console.log(`${status.platform}: ${status.distributionStatus}`);
  } catch (error) {
    console.error(error?.message ?? String(error));
    process.exitCode = 2;
  }
}
