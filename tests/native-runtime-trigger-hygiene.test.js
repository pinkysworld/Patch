import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflows = new Map([
  ['win32', fs.readFileSync('.github/workflows/native-win32-runtime.yml', 'utf8')],
  ['linux', fs.readFileSync('.github/workflows/native-linux-runtime.yml', 'utf8')],
  ['macos', fs.readFileSync('.github/workflows/native-macos-runtime.yml', 'utf8')]
]);

test('native runtime workflows do not rebuild for site-only build plumbing', () => {
  for (const [platform, workflow] of workflows) {
    assert.equal(workflow.includes('scripts/build-site.js'), false, `${platform} should not trigger on build-site.js`);
    assert.equal(workflow.includes('scripts/check-site.js'), false, `${platform} should not trigger on check-site.js`);
    assert.match(workflow, /web\/native-build\.js/, `${platform} keeps Studio/native integration coverage`);
    assert.match(workflow, /src\/native-gui-ir\.js/, `${platform} keeps native IR coverage`);
    assert.match(workflow, /src\/sealed-native-gui\.js/, `${platform} keeps sealed runtime coverage`);
  }
});

test('macOS native runtime is not coupled to the Pages workflow itself', () => {
  assert.equal(workflows.get('macos').includes('.github/workflows/pages.yml'), false);
});

test('each native runtime still self-triggers when its workflow changes', () => {
  assert.match(workflows.get('win32'), /\.github\/workflows\/native-win32-runtime\.yml/);
  assert.match(workflows.get('linux'), /\.github\/workflows\/native-linux-runtime\.yml/);
  assert.match(workflows.get('macos'), /\.github\/workflows\/native-macos-runtime\.yml/);
});
