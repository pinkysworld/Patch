import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_COMPONENT_SUPPORT_VERSION,
  componentTargetForBuildTarget,
  patchComponentSupport,
  assessPatchComponentSupport
} from '../src/component-support.js';

test('component support maps Studio build targets to the canonical registry targets', () => {
  assert.equal(PATCH_COMPONENT_SUPPORT_VERSION, '0.1');
  assert.equal(componentTargetForBuildTarget('web'), 'web');
  assert.equal(componentTargetForBuildTarget('native-windows'), 'windows');
  assert.equal(componentTargetForBuildTarget('native-macos'), 'macos');
  assert.equal(componentTargetForBuildTarget('native-linux'), 'linux');
  assert.equal(componentTargetForBuildTarget('native-freebsd'), 'freebsd');
  assert.equal(componentTargetForBuildTarget('portable'), null);
});

test('component support derives target decisions from component-registry metadata', () => {
  assert.deepEqual(patchComponentSupport('picture', 'native-windows'), {
    type: 'picture', target: 'windows', status: 'supported'
  });
  assert.deepEqual(patchComponentSupport('picture', 'native-freebsd'), {
    type: 'picture', target: 'freebsd', status: 'unsupported'
  });
  assert.deepEqual(patchComponentSupport('not-a-control', 'native-linux'), {
    type: 'not-a-control', target: 'linux', status: 'unknown'
  });
});

test('component support assessment is unique, deterministic and fail-closed for unknown components', () => {
  const ready = assessPatchComponentSupport(['button', 'picture', 'button'], 'native-linux');
  assert.equal(ready.status, 'supported');
  assert.deepEqual(ready.supported, ['button', 'picture']);
  assert.equal(ready.total, 2);

  const blocked = assessPatchComponentSupport(['button', 'picture'], 'native-freebsd');
  assert.equal(blocked.status, 'unsupported');
  assert.deepEqual(blocked.unsupported, ['button', 'picture']);

  const unknown = assessPatchComponentSupport(['button', 'future-control'], 'native-windows');
  assert.equal(unknown.status, 'unknown');
  assert.deepEqual(unknown.unknown, ['future-control']);
});
