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
    'sole modeled persistent-mutation route'
  ]) {
    assert.match(review, new RegExp(escapeRegExp(phrase), 'i'), phrase);
  }

  assert.match(novelty, /Expressibility is not the novelty claim/i);
  assert.match(novelty, /does \*\*not\*\* claim that `score may increase up to 10` is uniquely expressible/i);
  assert.match(novelty, /contribution hypothesis, not a firstness assertion/i);
  assert.match(paperSection, /not claim unique expressibility/i);
  assert.match(paperSection, /sole modeled persistent-mutation route/i);
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
    'naden2012borrowing',
    'pottier2013mezzo',
    'nanevski2008htt',
    'swamy2016fstar',
    'ahman2017dijkstra',
    'dig2016cope',
    'mattis2017edittransactions',
    'cai2014changes',
    'hofmann2012edit',
    'anguilhomotopical2016',
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