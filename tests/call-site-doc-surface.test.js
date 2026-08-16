import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const formalModel = read('docs/FORMAL_MODEL.md');
const callSiteDoc = read('docs/CALL_SITE_VALIDATION.md');
const paperReadme = read('paper/README.md');
const manuscript = read('paper/main.tex');

const surfaces = [
  ['formal model', formalModel],
  ['call-site validation doc', callSiteDoc],
  ['paper guide', paperReadme],
  ['manuscript', manuscript]
];

test('research surfaces describe independent raw-source static call-site binding', () => {
  for (const [label, text] of surfaces) {
    assert.match(text, /raw[- ]source|raw source/i, `${label} must mention raw-source evidence`);
    assert.match(text, /call[- ]site|call site/i, `${label} must mention call-site identity`);
    assert.match(text, /production AST|production-AST/i, `${label} must distinguish production AST evidence`);
  }
});

test('call-site trust reduction stays syntactic and does not overclaim parser verification', () => {
  assert.match(callSiteDoc, /does \*\*not\*\* prove the Patch parser correct/i);
  assert.match(formalModel, /does not prove the production parser correct/i);
  assert.match(paperReadme, /is not a verified parser/i);
  assert.match(manuscript, /does not prove the production parser correct/i);
  for (const [label, text] of surfaces) {
    assert.doesNotMatch(text, /Patch (has|uses) a (fully )?verified (production )?parser/i, `${label} overclaims parser verification`);
  }
});

test('witness format stays stable while call-site provenance is explicit', () => {
  assert.match(callSiteDoc, /Concrete Call Witness format remains \*\*0\.1\*\*/);
  assert.match(paperReadme, /Concrete Call Witness schema remains \*\*0\.1\*\*/);
  assert.match(callSiteDoc, /callSiteValidationVersion = 0\.1/);
  assert.match(callSiteDoc, /rawCallSitesValidated = true/);
});

test('paper surfaces retain remaining trust boundaries after call-site hardening', () => {
  for (const [label, text] of [['formal model', formalModel], ['paper guide', paperReadme], ['manuscript', manuscript]]) {
    assert.match(text, /JavaScript-to-(?:Wasm|WebAssembly) lowering|JavaScript-to-Wasm lowering/i, `${label} must retain lowering boundary`);
    assert.match(text, /Wasm engine|WebAssembly engine/i, `${label} must retain engine boundary`);
    assert.match(text, /independent.*validator|validator.*independent/i, `${label} must retain independent-validator boundary`);
  }
});
