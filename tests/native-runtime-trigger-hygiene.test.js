import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflows = new Map([
  ['win32', fs.readFileSync('.github/workflows/native-win32-runtime.yml', 'utf8')],
  ['linux', fs.readFileSync('.github/workflows/native-linux-runtime.yml', 'utf8')],
  ['macos', fs.readFileSync('.github/workflows/native-macos-runtime.yml', 'utf8')]
]);
const frozenDirectWorkflows = [
  '.github/workflows/native-treeview-v13.yml'
];
const retiredManualWorkflows = [
  '.github/workflows/native-table-v09.yml',
  '.github/workflows/native-menu-v10.yml',
  '.github/workflows/native-menu-state-v11.yml',
  '.github/workflows/native-listbox-v12.yml',
  '.github/workflows/native-sealed-table-runtime.yml',
  '.github/workflows/native-sealed-menu-runtime.yml',
  '.github/workflows/native-sealed-list-runtime.yml'
];
const pages = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const pagesStatus = fs.readFileSync('.github/workflows/pages-status.yml', 'utf8');
const formal = fs.readFileSync('.github/workflows/formal.yml', 'utf8');
const developmentWorkflows = new Map([
  ['Patch CI', fs.readFileSync('.github/workflows/ci.yml', 'utf8')],
  ['Offline Studio', fs.readFileSync('.github/workflows/offline-studio.yml', 'utf8')],
  ['Native GUI Unified', fs.readFileSync('.github/workflows/native-gui-unified.yml', 'utf8')],
  ['Runtime Templates', fs.readFileSync('.github/workflows/runtime-templates.yml', 'utf8')],
  ['Offline Compiler', fs.readFileSync('.github/workflows/offline-compiler.yml', 'utf8')],
  ['Reproducibility Bundle', fs.readFileSync('.github/workflows/reproducibility-bundle.yml', 'utf8')]
]);
const codeql = fs.readFileSync('.github/workflows/codeql.yml', 'utf8');

test('native runtime workflows do not rebuild for site-only build plumbing', () => {
  for (const [platform, workflow] of workflows) {
    assert.equal(workflow.includes('scripts/build-site.js'), false, `${platform} should not trigger on build-site.js`);
    assert.equal(workflow.includes('scripts/check-site.js'), false, `${platform} should not trigger on check-site.js`);
    assert.equal(workflow.includes('web/native-build.js'), false, `${platform} historical v0.8 line should not trigger on Studio Ready packaging`);
    assert.match(workflow, /src\/native-gui-ir\.js/, `${platform} keeps historical native IR coverage`);
    assert.match(workflow, /src\/sealed-native-gui\.js/, `${platform} keeps historical sealed runtime coverage`);
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

test('historical v0.8 runtime workflows are manual-only audits', () => {
  for (const [platform, workflow] of workflows) {
    assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/m, platform);
    assert.doesNotMatch(workflow, /\n\s*(?:push|pull_request):/, platform);
  }
});

test('development PR updates do not restart the expensive workflow fleet', () => {
  for (const [name, workflow] of developmentWorkflows) {
    assert.doesNotMatch(workflow, /types:\s*\[[^\]]*synchronize[^\]]*\]/, name);
    assert.match(workflow, /workflow_dispatch:/, `${name} keeps an explicit manual validation path`);
  }
});

test('no pull-request workflow allocates runners for every synchronize event', () => {
  const directory = '.github/workflows';
  for (const file of fs.readdirSync(directory).filter(name => /\.ya?ml$/.test(name))) {
    const workflow = fs.readFileSync(`${directory}/${file}`, 'utf8');
    if (!/\n  pull_request:/.test(`\n${workflow}`)) continue;
    assert.match(
      workflow,
      /\n  pull_request:\s*\n    types:\s*\[[^\]]+\]/,
      `${file} must opt into explicit PR lifecycle events instead of GitHub's synchronize-by-default set`
    );
    assert.doesNotMatch(
      workflow,
      /types:\s*\[[^\]]*synchronize[^\]]*\]/,
      `${file} must not restart runners for each development push`
    );
  }
});

test('CodeQL is integration/scheduled/manual rather than per-PR synchronization', () => {
  assert.doesNotMatch(codeql, /\n\s*pull_request:/);
  assert.match(codeql, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(codeql, /schedule:/);
  assert.match(codeql, /workflow_dispatch:/);
});

test('frozen direct-native compatibility workflows are manual-only', () => {
  for (const file of frozenDirectWorkflows) {
    const workflow = fs.readFileSync(file, 'utf8');
    assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/m, file);
    assert.doesNotMatch(workflow, /\n\s*(?:push|pull_request):/, file);
  }
});

test('retired v07–v11 manual workflows are no longer active Actions files', () => {
  for (const file of retiredManualWorkflows) {
    assert.equal(fs.existsSync(file), false, `${file} should no longer be an active Actions workflow`);
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

test('non-authoritative Pages runs cannot overwrite the public-site status', () => {
  assert.match(pagesStatus, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(pagesStatus, /success\)/);
  assert.match(pagesStatus, /failure\|timed_out\|startup_failure\|action_required\)/);
  assert.match(pagesStatus, /cancelled\|skipped\|neutral\|stale\)/);
  assert.match(pagesStatus, /Ignoring non-authoritative Pages conclusion/);
  assert.match(pagesStatus, /state=success/);
  assert.match(pagesStatus, /state=failure/);
  assert.match(pagesStatus, /context='patch-studio\/public-site'/);
});

test('Pages runtime-integrity generator is site-only and cannot retrigger native runtime builds', () => {
  assert.match(pages, /scripts\/runtime-integrity-manifest\.js/);
  for (const [platform, workflow] of workflows) {
    assert.equal(workflow.includes('runtime-integrity-manifest.js'), false, `${platform} should not trigger on Pages-only runtime manifest tooling`);
  }
});
