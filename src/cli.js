#!/usr/bin/env node
import fs from 'node:fs';
import { PatchInterpreter } from './interpreter.js';

const file = process.argv[2];
if (!file) {
  console.error('Patch beta\n\nUse: patch program.patch\n     node src/cli.js program.patch');
  process.exit(1);
}
try {
  const source = fs.readFileSync(file, 'utf8');
  const result = new PatchInterpreter().run(source);
  for (const line of result.output) console.log(line);
} catch (err) {
  console.error(`Patch stopped: ${err.message}`);
  process.exit(2);
}
