import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
const beta = /^0\.2\.0-beta\.(\d+)$/.exec(pkg.version)?.[1];
if (!beta) throw new Error(`Unexpected Patch version ${pkg.version}`);

test('main manuscript reflects the beta32 assurance and current product-artifact boundary', () => {
  const tex = read('paper/main.tex');

  for (const phrase of [
    `Beta ${beta} product artifact / Beta 32 assurance manuscript`,
    'Beta 30 finite transitive exact call trees',
    'Beta 31 call-aware bridge',
    'Beta 32 invocation frames',
    'GeneratedRepeatedTransitiveRuntimeCertificate.lean',
    'GeneratedMixedGuardTransitiveRuntimeCertificate.lean',
    'caller(1)',
    'caller(4)',
    'twelve invocation frames',
    'six supported transitive correspondences',
    'Patch reject / coarse accept',
    'balance=80',
    'used=35',
    'remaining=85',
    'admin\\_credit=0',
    'process isolation',
    'no controlled paper-quality timing dataset yet',
    'Patch Reproducibility Bundle',
    '\\input{related-work}',
    '\\bibliography{references}'
  ]) {
    assert.match(tex, new RegExp(escapeRegExp(phrase), 'i'), phrase);
  }

  assert.match(tex, new RegExp(`Patch ${escapeRegExp(pkg.version)} retains Change IR 0\\.10`, 'i'));
  assert.doesNotMatch(tex, /Beta 28 research artifact manuscript/i);
  assert.doesNotMatch(tex, /The next formal steps are guard-aware exact callee traces/i);
  assert.doesNotMatch(tex, /Beta 28 establishes complete exact semantic-effect traces[^\n]*remaining research task/i);
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

test('paper claim boundary does not silently turn supporting evidence into performance, external-validity or full-verification claims', () => {
  const tex = read('paper/main.tex');
  assert.match(tex, /not an end-to-end compiler refinement theorem/i);
  assert.match(tex, /no empirical overhead, scalability, or asymptotic-complexity claim/i);
  assert.match(tex, /not a claim of complete malicious-code containment/i);
  assert.match(tex, /not a complete plugin sandbox/i);
  assert.match(tex, /not evidence[^\n]*third-party plugin ecosystem/i);
  assert.match(tex, /candidate novelty is a conjunction of architectural choices/i);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
