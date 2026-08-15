#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRealisticExtensionCase, realisticExtensionReportMarkdown } from '../src/realistic-extension-case.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
const caseRoot = path.resolve(root, 'case-studies', options.caseName);
if (!fs.existsSync(path.join(caseRoot, 'scenario.json'))) throw new Error(`Unknown realistic extension case '${options.caseName}'.`);
const report = await evaluateRealisticExtensionCase(caseRoot);
const json = `${JSON.stringify(report, null, 2)}\n`;
if (options.out) write(options.out, json);
else process.stdout.write(json);
if (options.markdown) write(options.markdown, realisticExtensionReportMarkdown(report));
if (options.out) console.log(`wrote ${options.out}`);
if (options.markdown) console.log(`wrote ${options.markdown}`);

function write(filename, content) {
  const target = path.resolve(filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function parseArgs(args) {
  const result = { caseName: null, out: null, markdown: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--case') result.caseName = requireValue(args, ++index, '--case');
    else if (args[index] === '--out') result.out = requireValue(args, ++index, '--out');
    else if (args[index] === '--markdown') result.markdown = requireValue(args, ++index, '--markdown');
    else if (args[index] === '--help' || args[index] === '-h') {
      console.log('Usage: node scripts/evaluate-extension-case.js --case NAME [--out report.json] [--markdown report.md]');
      process.exit(0);
    } else throw new Error(`Unknown argument '${args[index]}'.`);
  }
  if (!result.caseName || !/^[a-z0-9][a-z0-9-]*$/i.test(result.caseName)) throw new Error('--case must be a simple case-study directory name.');
  return result;
}

function requireValue(args, index, name) {
  if (index >= args.length) throw new Error(`${name} requires a value.`);
  return args[index];
}
