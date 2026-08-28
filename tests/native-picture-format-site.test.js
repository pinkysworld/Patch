import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const worker = fs.readFileSync('web/sw.js', 'utf8');
const docs = fs.readFileSync('web/docs.html', 'utf8');
const policy = fs.readFileSync('src/native-picture-format-policy.js', 'utf8');
const resources = fs.readFileSync('src/native-picture-resources.js', 'utf8');

test('native Picture format policy is part of public Studio and offline packaging contracts', () => {
  assert.match(buildSite, /'native-picture-format-policy\.js'/);
  assert.match(worker, /'\.\.\/src\/native-picture-format-policy\.js'/);
  assert.match(docs, /docs\/NATIVE_PICTURE_FORMATS\.md/);
  assert.match(docs, /native-picture-formats\/1\.0/);
  assert.match(policy, /PATCH_NATIVE_PICTURE_FORMAT_POLICY_ID = 'native-picture-formats\/1\.0'/);
  assert.match(resources, /from '\.\/native-picture-format-policy\.js'/);
  assert.match(policy, /This module is not a Native GUI IR bump/);
});
