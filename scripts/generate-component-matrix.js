#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPatchComponentCapabilityMatrixMarkdown } from '../src/component-matrix.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs', 'COMPONENT_CAPABILITY_MATRIX.md');
const next = formatPatchComponentCapabilityMatrixMarkdown();
const check = process.argv.includes('--check');

if (check) {
  const current = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
  if (current !== next) {
    console.error('docs/COMPONENT_CAPABILITY_MATRIX.md is stale. Run: node scripts/generate-component-matrix.js');
    process.exit(1);
  }
  console.log('component capability matrix is current.');
  process.exit(0);
}

fs.writeFileSync(output, next);
console.log(`wrote ${path.relative(root, output)}`);
