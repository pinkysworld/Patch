import fs from 'node:fs';
import { PatchInterpreter } from '../src/interpreter.js';
const dir = new URL('../examples/', import.meta.url);
for (const name of fs.readdirSync(dir).filter(x => x.endsWith('.patch'))) {
  const file = new URL(name, dir);
  new PatchInterpreter().run(fs.readFileSync(file, 'utf8'));
  console.log(`ok ${name}`);
}
