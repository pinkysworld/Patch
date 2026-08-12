#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildPatchApp, serializePatchApp } from '../src/bundle.js';
import { compileToWasm } from '../src/wasm.js';
import { compileToDirectWasm } from '../src/wasm-direct.js';
import { compileToC99 } from '../src/c99.js';
import { buildStandaloneWebApp } from '../src/webapp.js';

const root = process.cwd();
const contract = JSON.parse(fs.readFileSync(path.join(root, 'compat', 'release-golden-v1.json'), 'utf8'));
const consoleSource = fs.readFileSync(path.join(root, contract.consoleSource), 'utf8');
const windowSource = fs.readFileSync(path.join(root, contract.windowSource), 'utf8');
const options = { name: contract.project.name, entry: contract.project.entry };

const patchapp = serializePatchApp(buildPatchApp(consoleSource, { ...options, kind: 'console', targets: ['portable'] }));
const bootstrap = compileToWasm(consoleSource, { ...options, kind: 'console' });
const direct = compileToDirectWasm(consoleSource, { ...options, kind: 'console' });
const c99 = compileToC99(consoleSource, { ...options, kind: 'console' });
const consoleWeb = buildStandaloneWebApp(consoleSource, { ...options, kind: 'console' });
const windowWeb = buildStandaloneWebApp(windowSource, { ...options, kind: 'window' });

const result = {
  schema: 'patch-logical-release-fingerprint',
  version: 1,
  sources: {
    consoleSha256: sha256(consoleSource),
    windowSha256: sha256(windowSource)
  },
  artifacts: {
    patchapp: fingerprint(patchapp),
    bootstrapWasm: fingerprint(bootstrap.module),
    directWasm: fingerprint(direct.module),
    c99: fingerprint(c99.source),
    consoleWeb: fingerprint(consoleWeb.html),
    windowWeb: fingerprint(windowWeb.html)
  }
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function fingerprint(value) {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
