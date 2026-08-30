import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const formalDir = path.join(root, 'formal');
const files = fs.readdirSync(formalDir)
  .filter((name) => name.endsWith('.lean'))
  .sort();

const handwritten = files.filter((name) => !name.startsWith('Generated'));
const generated = files.filter((name) => name.startsWith('Generated'));

function stats(names) {
  let physicalLines = 0;
  let nonblankLines = 0;
  let codeLines = 0;
  let declarations = 0;
  let bytes = 0;

  for (const name of names) {
    const text = fs.readFileSync(path.join(formalDir, name), 'utf8');
    const lines = text.split(/\r?\n/);
    bytes += Buffer.byteLength(text);
    physicalLines += lines.length;
    nonblankLines += lines.filter((line) => line.trim().length > 0).length;
    codeLines += lines.filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('--');
    }).length;
    declarations += lines.filter((line) => /^\s*(theorem|lemma)\s+/.test(line)).length;
  }

  return { files: names.length, physicalLines, nonblankLines, codeLines, declarations, bytes };
}

const report = {
  schema: 1,
  handwrittenLean: stats(handwritten),
  generatedLean: stats(generated),
  totalLean: stats(files),
  handwrittenFiles: handwritten,
  generatedFiles: generated,
};

const out = process.argv[2];
if (out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`FORMAL_SCOPE_REPORT ${JSON.stringify(report)}`);
