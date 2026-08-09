#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
const scenario = JSON.parse(read('case-studies/checkout-extension/scenario.json'));
const doc = read('docs/CHECKOUT_EXTENSION_CASE.md');
const evaluator = read('scripts/evaluate-checkout-extension.js');
const test = read('tests/checkout-extension-case.test.js');

if (pkg.scripts?.['evaluate:checkout-extension'] !== 'node scripts/evaluate-checkout-extension.js') {
  throw new Error('package.json is missing evaluate:checkout-extension.');
}

requireAll('scenario.json', JSON.stringify(scenario), [
  'patch-realistic-extension-case', 'checkout-loyalty-extension', 'checkout_extension',
  'reward-escalation', 'direction-escalation', 'target-escalation'
]);
if (scenario.safe?.expectedState?.balance !== 80 || scenario.safe?.expectedState?.points !== 8 || scenario.safe?.expectedState?.cashback !== 0) {
  throw new Error('Checkout extension safe expected state must remain balance=80, points=8, cashback=0.');
}
if (scenario.variants?.length !== 3) throw new Error('Checkout extension scenario must retain exactly three controlled escalation variants.');

requireAll('docs/CHECKOUT_EXTENSION_CASE.md', doc, [
  'Checkout loyalty extension case study', 'balance = 80', 'points = 8', 'cashback = 0',
  'reward escalation', 'direction escalation', 'target escalation',
  'internal ablation, not a model of a named prior system', 'complete malicious extension containment'
]);
requireAll('scripts/evaluate-checkout-extension.js', evaluator, [
  'compileToDirectWasm', 'runDirectWasm', 'verifyProtectedEffects', 'verifyState',
  "format: 'patch-realistic-extension-case-report'", 'semanticAuthorityDifferentialRejects'
]);
requireAll('tests/checkout-extension-case.test.js', test, [
  'safe checkout extension compiles, executes', 'balance, 80', 'points, 8', 'cashback, 0',
  'reward-escalation', 'direction-escalation', 'target-escalation'
]);

for (const file of ['safe.patch','reward-escalation.patch','direction-escalation.patch','target-escalation.patch']) {
  if (!fs.existsSync(`case-studies/checkout-extension/${file}`)) throw new Error(`Missing checkout extension case ${file}.`);
}

console.log('ok realistic checkout extension case surface');

function requireAll(name, content, phrases) {
  for (const phrase of phrases) if (!content.includes(phrase)) throw new Error(`${name} is missing required case-study contract: ${phrase}`);
}
