import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflows = new Map([
  ['win32', fs.readFileSync('.github/workflows/native-win32-runtime.yml', 'utf8')],
  ['linux', fs.readFileSync('.github/workflows/native-linux-runtime.yml', 'utf8')],
  ['macos', fs.readFileSync('.github/workflows/native-macos-runtime.yml', 'utf8')]
]);
const frozenDirectWorkflows = [
  '.github/workflows/native-table-v09.yml',
  '.github/workflows/native-menu-v10.yml',
  '.github/workflows/native-menu-state-v11.yml',
  '.github/workflows/native-listbox-v12.yml',
  '.github/workflows/native-treeview-v13.yml'
];
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const pagesStatus = fs.readFileSync('.github/workflows/pages-status.yml', 'utf8');
const formal = fs.readFileSync('.github/workflows/formal.yml', 'utf8');

test('native runtime workflows do not rebuild for site-only build plumbing', () => {
  for (const [platform, workflow] of workflows) {
    assert.equal(workflow.includes('scripts/build-site.js'), false, `${platform} should not trigger on build-site.js`);
    assert.equal(workflow.includes('scripts/check-site.js'), false, `${platform} should not trigger on check-site.js`);
    assert.match(workflow, /web\/native-build\.js/, `${platform} keeps Studio/native integration coverage`);
    assert.match(workflow, /src\/native-gui-ir\.js/, `${platform} keeps native IR coverage`);
    assert.match(workflow, /src\/sealed-native-gui\.js/, `${platform} keeps sealed runtime coverage`);
  }
});

test('general roadmap edits do not rebuild legacy native runtime templates', () => {
  for (const [platform, workflow] of workflows) {
    assert.equal(workflow.includes('docs/ROADMAP.md'), false, `${platform} should not couple native runtime rebuilds to the general roadmap`);
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

test('frozen direct-native compatibility workflows are manual-only', () => {
  for (const file of frozenDirectWorkflows) {
    const workflow = fs.readFileSync(file, 'utf8');
    assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/m, file);
    assert.doesNotMatch(workflow, /\n\s*(?:push|pull_request):/, file);
  }
});

test('versioned beta workflows are folded into the canonical formal gate', () => {
  for (const file of [
    '.github/workflows/beta26-concrete-calls.yml',
    '.github/workflows/beta27-arithmetic-calls.yml',
    '.github/workflows/beta28-callee-traces.yml',
    '.github/workflows/beta29-guarded-callee-traces.yml',
    '.github/workflows/beta32-invocation-frames.yml'
  ]) assert.equal(fs.existsSync(file), false, `${file} should no longer be an active Actions workflow`);
  assert.match(formal, /npm run concrete-call-certify:example/);
  assert.match(formal, /npm run arithmetic-call-certify:example/);
  assert.match(formal, /npm run callee-trace-certify:example/);
  assert.match(formal, /npm run guarded-callee-trace-certify:example/);
  assert.match(formal, /npm run transitive-runtime-certify:mixed-guards/);
  assert.match(formal, /GeneratedMixedGuardTransitiveRuntimeCertificate\.lean/);
});

test('Pages source deploys cannot be cancelled by later runtime workflow_run triggers', () => {
  assert.match(pages, /concurrency:\s*\n\s*group: pages\s*\n\s*cancel-in-progress: \$\{\{ github\.event_name == 'push' \}\}/m);
  assert.match(pages, /workflow_run:/);
});

test('cancelled superseded Pages runs cannot overwrite the public-site status', () => {
  assert.match(pagesStatus, /github\.event\.workflow_run\.head_branch == 'main' && github\.event\.workflow_run\.conclusion != 'cancelled'/);
  assert.match(pagesStatus, /if \[ "\$DEPLOY_CONCLUSION" = 'success' \]/);
  assert.match(pagesStatus, /state=failure/);
  assert.match(pagesStatus, /context='patch-studio\/public-site'/);
});

test('Pages runtime-integrity generator is site-only and cannot retrigger native runtime builds', () => {
  assert.match(pages, /scripts\/runtime-integrity-manifest\.js/);
  for (const [platform, workflow] of workflows) {
    assert.equal(workflow.includes('runtime-integrity-manifest.js'), false, `${platform} should not trigger on Pages-only runtime manifest tooling`);
  }
});
