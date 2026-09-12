import fs from 'node:fs';
const path = 'tests/linklabel-stage1.test.js';
let source = fs.readFileSync(path, 'utf8');
const before = "  const plain = compile(`window \"Plain\":\\n  button \"Open\" as details\\nwhen details clicked:\\n  show \"clicked\"\\n`, { name: 'Plain', kind: 'window' });";
const after = "  const plain = compile(`create text result = \"idle\"\\nwindow \"Plain\":\\n  button \"Open\" as details\\nwhen details clicked:\\n  change result:\\n    set = \"clicked\"\\n`, { name: 'Plain', kind: 'window' });";
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('Missing plain Button native compatibility fixture.');
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}
console.log('LinkLabel native fixture updated.');
