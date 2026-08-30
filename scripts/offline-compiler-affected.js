#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { offlineCompilerSourceManifest } from './offline-compiler-source-graph.js';

export const PATCH_OFFLINE_COMPILER_AFFECTED_VERSION = '0.1';

/**
 * The Offline Compiler workflow is intentionally triggered by a broad set of
 * relevant repository paths. This second-stage predicate prevents an unrelated
 * src/ module (for example Studio-only design code) from starting the expensive
 * cross-platform compiler matrix.
 *
 * Non-src paths that reached the workflow are treated as affected because the
 * workflow path filter already limits them to runtime/build/release inputs.
 */
export function offlineCompilerAffected(changedFiles, options = {}) {
  const root = options.root ?? process.cwd();
  const files = [...new Set((changedFiles ?? []).map(normalize).filter(Boolean))].sort();
  if (!files.length) return { affected: false, reason: 'no changed files', files, matched: [] };

  const closure = new Set(offlineCompilerSourceManifest(root).files);
  const matched = [];
  for (const file of files) {
    if (!file.startsWith('src/')) {
      matched.push(file);
      continue;
    }
    if (closure.has(file)) matched.push(file);
  }
  return {
    affected: matched.length > 0,
    reason: matched.length
      ? `compiler/runtime input changed: ${matched.join(', ')}`
      : 'changed src files are outside the Offline Compiler dependency closure',
    files,
    matched
  };
}

function normalize(value) {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function parseCli(argv) {
  const options = { files: [], stdin: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') options.files.push(requireValue(argv, ++index, '--file'));
    else if (arg === '--stdin') options.stdin = true;
    else if (arg === '--github-output') options.githubOutput = requireValue(argv, ++index, '--github-output');
    else throw new Error(`Unknown offline compiler affected option: ${arg}`);
  }
  return options;
}

function requireValue(argv, index, option) {
  if (index >= argv.length || !argv[index] || argv[index].startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return argv[index];
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/).filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseCli(process.argv.slice(2));
    const files = [...options.files, ...(options.stdin ? await readStdin() : [])];
    const result = offlineCompilerAffected(files);
    console.log(`${result.affected ? 'affected' : 'not affected'}: ${result.reason}`);
    const output = options.githubOutput || process.env.GITHUB_OUTPUT;
    if (output) {
      fs.appendFileSync(output, `affected=${result.affected ? 'true' : 'false'}\n`);
      fs.appendFileSync(output, `reason=${result.reason.replace(/[\r\n]+/g, ' ')}\n`);
    }
    process.exitCode = 0;
  } catch (error) {
    console.error(error?.message ?? String(error));
    process.exitCode = 2;
  }
}
