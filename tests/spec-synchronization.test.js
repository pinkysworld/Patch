import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const spec = fs.readFileSync('docs/SPEC.md', 'utf8');
const paper = fs.readFileSync('paper/README.md', 'utf8');
const parser = fs.readFileSync('src/parser.js', 'utf8');
const compiler = fs.readFileSync('src/compiler.js', 'utf8');

test('SPEC status is synchronized exactly to the current product and Change IR', () => {
  const packageMatch = /^0\.2\.0-beta\.(\d+)$/.exec(pkg.version);
  const specMatch = /Status: \*\*0\.2\.0-beta\.(\d+) development\*\*/.exec(spec);
  assert.ok(packageMatch, `unexpected package version ${pkg.version}`);
  assert.ok(specMatch, 'SPEC must expose an explicit beta snapshot status');
  assert.equal(specMatch[1], packageMatch[1], 'language SPEC snapshot must match the product package');
  const ir = compiler.match(/PATCH_IR_VERSION\s*=\s*'([^']+)'/)?.[1];
  assert.ok(ir, 'compiler must expose a Change IR version marker');
  assert.match(spec, new RegExp(`Change IR \\*\\*${ir.replace('.', '\\.')}`));
  assert.match(spec, /Native GUI IR 1\.6 \/ sealed payload v16 \/ native runtime v1\.7/);
  assert.doesNotMatch(spec, /0\.2\.0-beta\.8|Change IR 0\.6|Beta 8 source\/evidence/);
});

test('SPEC documents every current user-facing parser family', () => {
  const constructs = [
    ['window', /\^window\\b/, '## Window applications and Forms'],
    ['button', /\^button\\b/, '- `button`'],
    ['checkbox', /\^checkbox\\s\+/, '- `checkbox`'],
    ['radio', /\^radio\\s\+/, '- `radio`'],
    ['combo', /\^combo\\s\+/, '- `combo`'],
    ['listbox', /\^listbox\\s\+/, '- `listbox`'],
    ['slider', /\^slider\\s\+/, '- `slider`'],
    ['panel', /\^panel\\s\+as\\s\+/, '- `panel`'],
    ['timer', /\^timer\\s\+as\\s\+/, '- `timer`'],
    ['picture', /\^picture\\b/, '- `picture`'],
    ['shape', /\^shape\\b/, '- `shape`'],
    ['paintbox', /\^paintbox\\s\+as\\s\+/, '- `paintbox`'],
    ['imagelist', /\^imagelist\\s\+as\\s\+/, '- `imagelist`'],
    ['statusbar', /\^statusbar\\s\+/, '- `statusbar`'],
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
  assert.match(parser, /clicked\|changed\|closed\|confirmed\|chosen\|cancelled\|ticked\|paint/);
  assert.match(spec, /cancelled\s+ticked\s+paint/);
  assert.match(spec, /image open from "patch-resource:icons\.open"/);
  assert.match(spec, /button "Open" as open_button image app_images.open/);
  assert.match(spec, /icon "patch-resource:app\.icon"/);
  assert.match(spec, /ImageList is nonvisual source-backed metadata/);
});

test('SPEC keeps the formal claim narrower than the current language', () => {
  assert.match(spec, /formal assurance boundary[\s\S]*\*\*beta\.32\*\*/i);
  assert.match(spec, /not\*\* an end-to-end verified compiler\/runtime theorem/i);
  assert.match(spec, /GUI execution is outside the beta\.32 Lean runtime-correspondence claim/);
  assert.match(spec, /PictureBox image-source decoding is not yet claimed as a complete cross-platform asset pipeline/);
  assert.match(spec, /native-picture-formats\/1\.0/);
  assert.match(spec, /WebP and SVG remain deferred/);
  assert.match(spec, /ImageList is nonvisual source-backed metadata/);
  assert.match(spec, /Native GUI IR 1\.4 still fail-closes ImageList and Button image bindings/);
  assert.match(spec, /window-icon\/1\.0/);
});

test('paper product snapshot and frozen contract stay explicit without widening beta.32', () => {
  assert.match(paper, /current native product contract: \*\*Native GUI IR 1\.3 \/ sealed payload v13 \/ runtime v1\.4\*\*/);
  assert.match(paper, /frozen TreeView compatibility contract: \*\*Native GUI IR 1\.2 \/ sealed payload v12 \/ runtime v1\.3\*\*/);
  assert.match(paper, /formal runtime-correspondence milestone: \*\*beta\.32\*\*/);
  assert.match(paper, /does not widen the beta\.32 Lean claim/);
  assert.match(paper, /historical include-chain bases, not the Ready runtime/);
  const tex = fs.readFileSync('paper/main.tex', 'utf8');
  assert.match(tex, /Native GUI IR 1\.3/);
  assert.match(tex, /fail closed on Things/);
  assert.doesNotMatch(tex, /Native GUI IR 0\.7 does not model persistent list state, so current native Window paths fail closed/);
});

test('SPEC exposes the fail-closed Thing field boundary implemented by the parser', () => {
  for (const field of ['__proto__', 'prototype', 'constructor']) {
    assert.ok(spec.includes(field), `SPEC must name blocked Thing field ${field}`);
    assert.ok(parser.includes(`'${field}'`), `parser must block Thing field ${field}`);
  }
});

test('SEMANTICS documents prototype-free Things and structural own-field equality', () => {
  const semantics = fs.readFileSync('docs/SEMANTICS.md', 'utf8');
  assert.match(semantics, /prototype-free/);
  assert.match(semantics, /JSON serialization is not the equality oracle/);
  for (const field of ['__proto__', 'prototype', 'constructor']) assert.ok(semantics.includes(field), `SEMANTICS must name blocked Thing field ${field}`);
});

test('public language surface and compiler docs keep Things outside the beta.32 Wasm subset', () => {
  const language = fs.readFileSync('web/language.html', 'utf8');
  const compilerDocs = fs.readFileSync('docs/COMPILER.md', 'utf8');
  const wasmDirect = fs.readFileSync('src/wasm-direct.js', 'utf8');
  assert.match(language, /Things are own-field records/);
  assert.match(language, /fail closed on Things/);
  assert.match(spec, /JSON serialization is not the equality oracle/);
  assert.match(spec, /direct Wasm and portable C99 fail closed/);
  assert.match(compilerDocs, /Things \(`CREATE_THING`\)/);
  assert.match(wasmDirect, /case 'CREATE_THING'/);
  assert.match(wasmDirect, /things are outside the direct numeric Wasm subset/);
});