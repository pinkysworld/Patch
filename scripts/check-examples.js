import fs from 'node:fs';
import { PatchInterpreter } from '../src/interpreter.js';
import { compile } from '../src/compiler.js';

const dir = new URL('../examples/', import.meta.url);
for (const name of fs.readdirSync(dir).filter(x => x.endsWith('.patch'))) {
  const file = new URL(name, dir);
  const source = fs.readFileSync(file, 'utf8');
  compile(source, { name: name.replace(/\.patch$/, '') });
  new PatchInterpreter().run(source);
  console.log(`ok ${name}`);
}
