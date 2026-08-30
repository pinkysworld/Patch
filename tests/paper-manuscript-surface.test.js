import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('main manuscript keeps the revised Paper 1 argument and measured formal scope', () => {
  const main = read('paper/main.tex');
  const related = read('paper/related-work.tex');
  const tex = `${main}\n${related}`;

  for (const phrase of [
    'State-Change Factorization and Semantic Change Contracts',
    'design invariant',
    'Why couple commit and semantic metadata?',
    'IStateDB.save',
    'Coverage of the paper grammar',
    '6/6',
    '5/6 after lowering',
    '18 Lean files',
    '3,167 code lines',
    '80 theorem/lemma declarations',
    'CI-generated Lean certificates',
    '1,295',
    '155 theorem/lemma declarations',
    '48,140 nonblank JavaScript lines',
    '6.6\\%',
    'verification-coverage metric',
    'Checked runtime correspondence',
    'production AST',
    'does not prove the production parser correct',
    'not an end-to-end compiler refinement theorem',
    'caller(1)',
    'caller(4)',
    'twelve dynamic frames',
    'six supported transitive correspondences',
    'balance=80',
    'used=35',
    'remaining=85',
    'admin\\_credit=0',
    'Patch Reproducibility Bundle',
    'Redux action types and payloads are application-defined',
    '\\input{real-code-audit}',
    '\\input{related-work}',
    '\\bibliography{references}',
    'tab:grammar-coverage',
    'tab:formal-scope',
    'tab:security-ablation',
    'tab:application-corpus',
    'thm:signature',
    'thm:range',
    'thm:calltree',
    'app:repro'
  ]) {
    assert.match(tex, new RegExp(escapeRegExp(phrase), 'i'), phrase);
  }

  const rqLabels = [...main.matchAll(/\\item\[\\textbf\{RQ(\d+)\}\]/g)].map(match => Number(match[1]));
  assert.deepEqual(rqLabels, [1, 2, 3, 4], 'Paper 1 should expose four non-circular research questions aligned with four contributions');

  const abstract = main.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/)?.[1] ?? '';
  assert.doesNotMatch(abstract, /6\.6\\%|48,140|80 theorem\/lemma/i, 'abstract should not lead with detailed scope bookkeeping');
  assert.equal((main.match(/6\.6\\%/g) ?? []).length, 1, 'the Lean/JavaScript LOC ratio should appear only once as provenance context');
  assert.match(main, /recipe calls are handled by the separate finite-call layer/i);
  assert.doesNotMatch(tex, /thm:runtime|def:factorization|Beta 32 assurance manuscript|Native GUI IR 1\.3/i);
});

test('all citation keys in the synchronized paper modules exist in references.bib', () => {
  const tex = `${read('paper/main.tex')}\n${read('paper/related-work.tex')}`;
  const bib = read('paper/references.bib');
  const citedKeys = [...tex.matchAll(/\\cite\{([^}]+)\}/g)]
    .flatMap(match => match[1].split(',').map(key => key.trim()))
    .filter(Boolean);

  assert.ok(citedKeys.length >= 15, 'expected the manuscript to contain a substantive cited related-work section');
  for (const key of new Set(citedKeys)) {
    assert.match(bib, new RegExp(`@\\w+\\{${escapeRegExp(key)},`, 'i'), `missing bibliography entry ${key}`);
  }
});

test('paper claim boundary stays narrower than source-language, product, and performance claims', () => {
  const tex = read('paper/main.tex');
  assert.match(tex, /does not claim a source-to-core compiler-correctness theorem/i);
  assert.match(tex, /theorem about an independently specified source language/i);
  assert.match(tex, /not used as a verification-coverage metric/i);
  assert.match(tex, /hosted-CI timings are not used as performance evidence/i);
  assert.match(tex, /does not establish that such erasure is semantics-preserving/i);
  assert.match(tex, /two application domains are internally authored/i);
  assert.match(tex, /one coder and no inter-rater agreement measurement/i);
  assert.doesNotMatch(tex, /we (?:provide|present|prove) (?:a )?fully verified (?:compiler|runtime)/i);
  assert.doesNotMatch(tex, /the production parser is verified/i);
});

test('remaining empirical gates stay explicit without publishing a paper HTML route', () => {
  const tex = read('paper/main.tex');
  assert.equal(fs.existsSync('web/paper.html'), false, 'working manuscript must not be published as a Patch Studio HTML page');
  assert.match(tex, /substantial independently authored Patch program/i);
  assert.match(tex, /quantify signature sizes and annotations/i);
  assert.match(tex, /replicated multi-language mutation study/i);
  assert.match(tex, /controlled performance data/i);
});
