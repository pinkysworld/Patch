import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const spec = fs.readFileSync('docs/SPEC.md', 'utf8');
const paper = fs.readFileSync('paper/README.md', 'utf8');
const parser = fs.readFileSync('src/parser.js', 'utf8');
const compiler = fs.readFileSync('src/compiler.js', 'utf8');

test('SPEC status is bound to the package and current Change IR', () => {
  assert.match(spec, new RegExp(`Status: \\*\\*${pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} development\\*\\*`));
  const ir = compiler.match(/PATCH_IR_VERSION\s*=\s*'([^']+)'/)?.[1];
  assert.ok(ir, 'compiler must expose a Change IR version marker');
  assert.match(spec, new RegExp(`Change IR \\*\\*${ir.replace('.', '\\.')}`));
  assert.doesNotMatch(spec, /0\.2\.0-beta\.8|Change IR 0\.6|Beta 8 source\/evidence/);
});

test('SPEC documents every current user-facing parser family', () => {
  const constructs = [
    ['window', /\^window\\s\+/, '## Window applications and Forms'],
    ['checkbox', /\^checkbox\\s\+/, '- `checkbox`'],
    ['radio', /\^radio\\s\+/, '- `radio`'],
    ['combo', /\^combo\\s\+/, '- `combo`'],
    ['listbox', /\^listbox\\s\+/, '- `listbox`'],
    ['slider', /\^slider\\s\+/, '- `slider`'],
    ['table', /\^table\\s\+/, '## Tables'],
    ['tree', /\^tree\\s\+/, '## TreeView'],
    ['tabs', /\^tabs\\s\+/, '## Tabs'],
    ['menu', /\^menu\\s\+/, '## Menus'],
    ['confirm', /\^confirm\\s\+/, 'confirm "Delete?"'],
    ['open file', /\^open\\s\+file/, 'open file "Choose a file"'],
    ['save file', /\^save\\s\+file/, 'save file "Save project"']
  ];
  for (const [name, parserMarker, specMarker] of constructs) {
    assert.match(parser, parserMarker, `parser marker missing for ${name}`);
    assert.ok(spec.includes(specMarker), `SPEC marker missing for ${name}`);
  }
});

test('SPEC keeps the formal claim narrower than the current language', () => {
  assert.match(spec, /formal assurance boundary[\s\S]*\*\*beta\.32\*\*/i);
  assert.match(spec, /not\*\* an end-to-end verified compiler\/runtime theorem/i);
  assert.match(spec, /GUI execution is outside the beta\.32 Lean runtime-correspondence claim/);
});

test('paper product boundary follows current and frozen native contracts without widening beta.32', () => {
  assert.match(paper, /current native product contract: \*\*Native GUI IR 1\.3 \/ sealed payload v13 \/ runtime v1\.4\*\*/);
  assert.match(paper, /frozen TreeView compatibility contract: \*\*Native GUI IR 1\.2 \/ sealed payload v12 \/ runtime v1\.3\*\*/);
  assert.match(paper, /formal runtime-correspondence milestone: \*\*beta\.32\*\*/);
  assert.match(paper, /does not widen the beta\.32 Lean claim/);
});

test('SPEC exposes the fail-closed Thing field boundary implemented by the parser', () => {
  for (const field of ['__proto__', 'prototype', 'constructor']) {
    assert.ok(spec.includes(field), `SPEC must name blocked Thing field ${field}`);
    assert.ok(parser.includes(`'${field}'`), `parser must block Thing field ${field}`);
  }
});
