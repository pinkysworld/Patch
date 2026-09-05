import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('related-work review preserves the narrow Patch contribution boundary', () => {
  const review = read('docs/RELATED_WORK.md');
  const novelty = read('docs/NOVELTY.md');
  const paperSection = read('paper/related-work.tex');

  for (const phrase of [
    'Mandatory mutation route',
    'raw expressiveness',
    'HTT / Hoare-style state specifications',
    'F* / Dijkstra monads',
    'Graded modal/effect types',
    'Effects-as-Capabilities',
    'Dependent effect systems (ESOP 2026)',
    'Typestate via Revocable Capabilities (PLDI 2026)',
    'InvalML invalidation effects (OOPSLA 2025)',
    'sole modeled persistent-mutation route'
  ]) {
    assert.match(review, new RegExp(escapeRegExp(phrase), 'i'), phrase);
  }

  assert.match(novelty, /Expressibility is not the novelty claim/i);
  assert.match(novelty, /does \*\*not\*\* claim that `score may increase up to 10`/i);
  assert.match(novelty, /value-dependent effect/i);
  assert.match(novelty, /state-sensitive capability/i);
  assert.match(novelty, /uniquely expressible/i);
  assert.match(novelty, /contribution hypothesis, not a firstness assertion/i);

  assert.match(paperSection, /does not claim unique expressibility/i);
  assert.match(paperSection, /value-dependent quantitative (?:effects|grades)/i);
  assert.match(paperSection, /revocable capabilities/i);
  assert.match(paperSection, /semantic \\texttt\{Change\} route/i);
  assert.match(paperSection, /Elm Architecture/i);
  assert.match(paperSection, /Redux/i);
  assert.match(paperSection, /Operation-based CRDTs/i);
  assert.match(paperSection, /Rust/i);
  assert.match(paperSection, /Database provenance/i);
  assert.match(paperSection, /prose rather than in a yes\/no feature matrix/i);
});

test('paper bibliography contains the comparison systems cited by the related-work module', () => {
  const bib = read('paper/references.bib');
  const related = read('paper/related-work.tex');
  const keys = [
    'sunshine2011plaid',
    'warth2011worlds',
    'lucassen1988effects',
    'kammar2012algebraic',
    'katsumata2014parametric',
    'gordon2017flow',
    'brachthaeuser2020effects',
    'brachthaeuser2022boxes',
    'orchard2019quantitative',
    'kura2026dependent',
    'naden2012borrowing',
    'pottier2013mezzo',
    'jia2026revocable',
    'gao2025invalidation',
    'nanevski2008htt',
    'swamy2016fstar',
    'ahman2017dijkstra',
    'dig2016cope',
    'mattis2017edittransactions',
    'cai2014changes',
    'hofmann2012edit',
    'anguilhomotopical2016',
    'shapiro2011crdt',
    'cheney2009provenance',
    'necula2000translation',
    'necula1997pcc',
    'ko2008whyline'
  ];

  for (const key of keys) {
    assert.match(bib, new RegExp(`\\b${escapeRegExp(key)}\\b`), `missing bibliography key ${key}`);
    assert.match(related, new RegExp(`\\b${escapeRegExp(key)}\\b`), `related-work module does not cite ${key}`);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
