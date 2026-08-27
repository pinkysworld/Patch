import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
const packageBeta = Number(/^0\.2\.0-beta\.(\d+)$/.exec(pkg.version)?.[1]);
if (!Number.isInteger(packageBeta)) throw new Error(`Unexpected Patch version ${pkg.version}`);

test('main manuscript keeps an explicit product snapshot beside the beta32 assurance boundary', () => {
  const tex = `${read('paper/main.tex')}\n${read('paper/related-work.tex')}`;
  const boundary = /Beta (\d+) product artifact \/ Beta 32 assurance manuscript/i.exec(tex);
  assert.ok(boundary, 'manuscript must name its product artifact snapshot and Beta 32 assurance boundary');
  const manuscriptBeta = Number(boundary[1]);
  assert.ok(manuscriptBeta <= packageBeta, `paper snapshot Beta ${manuscriptBeta} cannot be newer than package Beta ${packageBeta}`);

  for (const phrase of [
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
    '\\bibliography{references}',
    'fig:architecture',
    'fig:frames',
    'tab:security-ablation',
    'tab:application-corpus',
    'tab:related-work',
    'tab:lean-theorems',
    'tab:trust-boundary',
    'tab:measurement-classes',
    'thm:runtime',
    'def:factorization',
    'Construct validity',
    'app:repro',
    'callSignatureSoundness'
  ]) {
    assert.match(tex, new RegExp(escapeRegExp(phrase), 'i'), phrase);
  }

  assert.match(tex, /Patch 0\.2\.0-beta\.\d+ retains Change IR 0\.10/i);
  assert.match(tex, /Native GUI IR 1\.3/i);
  assert.match(tex, /payload v13/i);
  assert.match(tex, /runtime v1\.4/i);
  assert.match(tex, /Native GUI IR 1\.2/i);
  assert.match(tex, /payload v12/i);
  assert.match(tex, /runtime v1\.3/i);
  assert.match(tex, /prototype-free own-field product values/i);
  assert.match(tex, /fail closed on Things/i);
  assert.match(tex, /does not widen the Lean runtime-correspondence theorem/i);
  assert.doesNotMatch(tex, /Beta 28 research artifact manuscript/i);
  assert.doesNotMatch(tex, /The next formal steps are guard-aware exact callee traces/i);
  assert.doesNotMatch(tex, /Beta 28 establishes complete exact semantic-effect traces[^\n]*remaining research task/i);
  assert.doesNotMatch(tex, /Native GUI IR 0\.7 does not model persistent list state, so current native Window paths fail closed/i);
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

test('remaining research gates stay in the repository manuscript without a public paper HTML route', () => {
  const tex = `${read('paper/main.tex')}\n${read('paper/related-work.tex')}`;
  assert.equal(fs.existsSync('web/paper.html'), false, 'working manuscript must not be published as a Patch Studio HTML page');
  assert.match(tex, /no controlled paper-quality timing dataset yet/i);
  assert.match(tex, /not an end-to-end compiler refinement theorem/i);
  assert.match(tex, /third-party plugin ecosystem/i);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
