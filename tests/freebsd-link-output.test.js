import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOfflineLinkPlan, materializeOfflineLinkPlan } from '../src/offline-linker.js';

const SOURCE = 'create number score = 1\nchange score:\n  add 1\nshow score\n';

test('FreeBSD linker creates a nested output parent before invoking the C compiler', { skip: process.platform === 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-freebsd-parent-test-'));
  try {
    const fakeCc = path.join(dir, 'fake-cc');
    fs.writeFileSync(fakeCc, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const index = args.indexOf('-o');
if (index < 0 || !args[index + 1]) process.exit(64);
fs.writeFileSync(args[index + 1], 'fake-freebsd-binary');
`, 'utf8');
    fs.chmodSync(fakeCc, 0o755);

    const plan = createOfflineLinkPlan(SOURCE, { platform: 'freebsd', name: 'NestedFree' });
    const output = path.join(dir, 'dist', 'nested', 'NestedFree');
    assert.equal(fs.existsSync(path.dirname(output)), false);

    const linked = materializeOfflineLinkPlan(plan, {
      out: output,
      allowHostCCompiler: true,
      cc: fakeCc,
      quiet: true
    });

    assert.equal(linked.output, output);
    assert.equal(fs.readFileSync(output, 'utf8'), 'fake-freebsd-binary');
    assert.ok((fs.statSync(output).mode & 0o111) !== 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
