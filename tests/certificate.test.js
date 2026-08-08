import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLeanCertificate } from '../src/certificate.js';

test('certificate generator emits a Lean checked-policy theorem', () => {
  const source = `create thing player:\n  score = 0\n\nallow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  change player:\n    add 5 to score`;
  const cert = generateLeanCertificate(source, { name: 'RewardDemo' });
  assert.deepEqual(cert.certified, ['reward']);
  assert.match(cert.lean, /import PatchChecker/);
  assert.match(cert.lean, /checkProtected cert_reward_stmt cert_reward_policy = true/);
  assert.match(cert.lean, /checkedExecutionCannotEscape/);
  assert.match(cert.lean, /kind := \.increase/);
  assert.match(cert.lean, /hi := 10/);
  assert.equal(cert.sourceSha256.length, 64);
});

test('certificate generator preserves bounded dynamic semantic amounts', () => {
  const source = `allow reward:\n  player.score may increase up to 10\n\nmake reward(player, bonus number 0..10):\n  change player:\n    add bonus to score`;
  const cert = generateLeanCertificate(source);
  assert.match(cert.lean, /lo := 0, hi := 10/);
});

test('certificate generator refuses a protected recipe outside formal bridge coverage', () => {
  const source = `make helper(player):\n  change player:\n    add 1 to score\n\nallow reward:\n  player.score may increase up to 10\n\nmake reward(player):\n  do helper(player)`;
  assert.throws(
    () => generateLeanCertificate(source),
    /outside the verified-checker subset/
  );
});
