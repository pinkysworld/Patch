#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const pkg = JSON.parse(read('package.json'));
const checkout = JSON.parse(read('case-studies/checkout-extension/scenario.json'));
const quota = JSON.parse(read('case-studies/quota-extension/scenario.json'));
const checkoutDoc = read('docs/CHECKOUT_EXTENSION_CASE.md');
const genericEvaluator = read('src/realistic-extension-case.js');
const genericCli = read('scripts/evaluate-extension-case.js');
const checkoutCli = read('scripts/evaluate-checkout-extension.js');
const checkoutTest = read('tests/checkout-extension-case.test.js');
const quotaTest = read('tests/quota-extension-case.test.js');

if (pkg.scripts?.['evaluate:checkout-extension'] !== 'node scripts/evaluate-checkout-extension.js') {
  throw new Error('package.json is missing evaluate:checkout-extension.');
}
if (pkg.scripts?.['evaluate:quota-extension'] !== 'node scripts/evaluate-extension-case.js --case quota-extension') {
  throw new Error('package.json is missing evaluate:quota-extension.');
}

checkScenario('checkout', checkout, {
  name: 'checkout-loyalty-extension',
  entry: 'checkout_extension',
  safeState: { balance: 80, points: 8, cashback: 0 },
  variants: ['reward-escalation', 'direction-escalation', 'target-escalation']
});
checkScenario('quota', quota, {
  name: 'usage-quota-extension',
  entry: 'quota_extension',
  safeState: { used: 35, remaining: 85, bonus: 5, admin_credit: 0 },
  variants: ['magnitude-escalation', 'direction-escalation', 'target-escalation']
});

requireAll('docs/CHECKOUT_EXTENSION_CASE.md', checkoutDoc, [
  'Checkout loyalty extension case study', 'balance = 80', 'points = 8', 'cashback = 0',
  'reward escalation', 'direction escalation', 'target escalation',
  'internal ablation, not a model of a named prior system', 'complete malicious extension containment'
]);
requireAll('src/realistic-extension-case.js', genericEvaluator, [
  'evaluateRealisticExtensionCase', 'compileToDirectWasm', 'runDirectWasm', 'verifyProtectedEffects', 'verifyState',
  "format: 'patch-realistic-extension-case-report'", "version: '0.2'", 'semanticAuthorityDifferentialRejects', 'realisticExtensionReportMarkdown'
]);
requireAll('scripts/evaluate-extension-case.js', genericCli, ['--case', 'evaluateRealisticExtensionCase', 'realisticExtensionReportMarkdown']);
requireAll('scripts/evaluate-checkout-extension.js', checkoutCli, ['checkout-extension', 'evaluateRealisticExtensionCase', 'CheckoutExtensionSafe']);
requireAll('tests/checkout-extension-case.test.js', checkoutTest, [
  'safe checkout extension compiles, executes', 'balance, 80', 'points, 8', 'cashback, 0',
  'reward-escalation', 'direction-escalation', 'target-escalation'
]);
requireAll('tests/quota-extension-case.test.js', quotaTest, [
  'safe usage quota extension executes', 'used: 35', 'remaining: 85', 'bonus: 5', 'admin_credit: 0',
  'magnitude-escalation', 'direction-escalation', 'target-escalation'
]);

for (const [directory, files] of Object.entries({
  'checkout-extension': ['safe.patch','reward-escalation.patch','direction-escalation.patch','target-escalation.patch'],
  'quota-extension': ['safe.patch','magnitude-escalation.patch','direction-escalation.patch','target-escalation.patch']
})) {
  for (const file of files) if (!fs.existsSync(`case-studies/${directory}/${file}`)) throw new Error(`Missing ${directory} case ${file}.`);
}

console.log('ok realistic extension corpus surface: checkout + quota');

function checkScenario(label, scenario, expected) {
  requireAll(`${label} scenario.json`, JSON.stringify(scenario), [
    'patch-realistic-extension-case', expected.name, expected.entry, ...expected.variants
  ]);
  for (const [name, value] of Object.entries(expected.safeState)) {
    if (scenario.safe?.expectedState?.[name] !== value) throw new Error(`${label} safe expected state must retain ${name}=${value}.`);
  }
  if (scenario.variants?.length !== expected.variants.length) throw new Error(`${label} scenario must retain exactly ${expected.variants.length} controlled escalation variants.`);
}

function requireAll(name, content, phrases) {
  for (const phrase of phrases) if (!content.includes(phrase)) throw new Error(`${name} is missing required extension-corpus contract: ${phrase}`);
}
