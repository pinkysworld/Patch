import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const downloads = fs.readFileSync('web/downloads.html', 'utf8');
const compilerWorkflow = fs.readFileSync('.github/workflows/offline-compiler.yml', 'utf8');
const studioWorkflow = fs.readFileSync('.github/workflows/offline-studio.yml', 'utf8');
const offlineStudioDoc = fs.readFileSync('docs/OFFLINE_STUDIO.md', 'utf8');
const pages = ['web/index.html', 'web/language.html', 'web/docs.html', 'web/help.html'];
const compilerAssets = [
  'patch-windows-x64.exe',
  'patch-macos-arm64',
  'patch-macos-x64.tar.gz',
  'patch-linux-x64',
  'patch-freebsd-x64.tar.gz',
  'SHA256SUMS'
];
const studioAssets = [
  'PatchStudio-windows-x64.exe',
  'PatchStudio-macos-arm64',
  'PatchStudio-linux-x64',
  'offline-studio-manifest.json',
  'SHA256SUMS'
];

test('offline compiler download page and release workflow share one stable v0.2 asset contract', () => {
  assert.match(downloads, /offline-compiler-v0\.2/);
  assert.match(compilerWorkflow, /TAG: offline-compiler-v0\.2/);
  assert.doesNotMatch(downloads, /releases\/download\/offline-compiler-v0\.1/);
  for (const asset of compilerAssets) {
    assert.ok(downloads.includes(asset), `downloads page: ${asset}`);
    assert.ok(compilerWorkflow.includes(asset), `release workflow: ${asset}`);
  }
});

test('Offline Studio download page, documentation and workflow share one stable v0.2 release contract', () => {
  assert.match(downloads, /offline-studio-v0\.2/);
  assert.match(studioWorkflow, /TAG: offline-studio-v0\.2/);
  assert.match(studioWorkflow, /release-bundle:[\s\S]*needs: executable/);
  assert.match(studioWorkflow, /publish:[\s\S]*needs: release-bundle/);
  assert.match(studioWorkflow, /patch-offline-studio-release-bundle/);
  assert.match(studioWorkflow, /cmp release\/windows\/offline-studio-manifest\.json release\/macos\/offline-studio-manifest\.json/);
  assert.match(studioWorkflow, /sha256sum -c SHA256SUMS/);
  assert.match(studioWorkflow, /gh release upload/);
  assert.match(studioWorkflow, /Missing published Offline Studio asset/);
  assert.match(offlineStudioDoc, /offline-studio-v0\.2/);
  assert.match(offlineStudioDoc, /Stage 2 local native-build integration remains open/);
  for (const asset of studioAssets) {
    assert.ok(downloads.includes(asset), `downloads page: ${asset}`);
    assert.ok(studioWorkflow.includes(asset), `Offline Studio workflow: ${asset}`);
    assert.ok(offlineStudioDoc.includes(asset), `Offline Studio documentation: ${asset}`);
  }
});

test('every primary public Patch page links to Downloads', () => {
  for (const page of pages) {
    const content = fs.readFileSync(page, 'utf8');
    assert.ok(content.includes('href="./downloads.html"'), `${page} should link Downloads`);
  }
});

test('downloads page states Offline Studio Stage 1 and signing boundaries without overstating native local Build', () => {
  assert.match(downloads, /Offline IDE beta embeds the same deterministic Studio site/i);
  assert.match(downloads, /Host-native desktop Build inside the IDE is the next Stage 2 boundary/i);
  assert.match(downloads, /development binary is currently unsigned by Authenticode/i);
  assert.match(downloads, /Ad-hoc signed for local execution, not Developer ID notarized/i);
  assert.match(downloads, /same deterministic Studio manifest/i);
  assert.match(downloads, /does not yet expose the standalone native compiler\/runtime through a privileged local Build bridge/i);
});

test('downloads page distinguishes current v1.8, Intel macOS kit, FreeBSD and historical compatibility', () => {
  assert.match(downloads, /normal local workflows do not need a GitHub token/i);
  assert.match(downloads, /macOS Intel/);
  assert.match(downloads, /portable tar\.gz kit/);
  assert.match(downloads, /includes its own Intel Node runtime/i);
  assert.match(downloads, /FreeBSD x64/);
  assert.match(downloads, /requires local Node 22\+ and cc/i);
  assert.match(downloads, /Native FreeBSD Window\/GUI linking is not claimed yet/);
  assert.match(downloads, /patch link app\.patch --out App/);
  assert.match(downloads, /Native GUI IR <strong>1\.7<\/strong>/);
  assert.match(downloads, /payload <strong>v17<\/strong>/);
  assert.match(downloads, /runtime <strong>v1\.8<\/strong>/);
  assert.match(downloads, /native Slider/i);
  assert.match(downloads, /hierarchical TreeView/);
  assert.match(downloads, /Native GUI IR 1\.3 \/ payload v13 \/ runtime v1\.4/);
  assert.match(downloads, /Native GUI IR 1\.2 \/ payload v12 \/ runtime v1\.3/);
  assert.match(downloads, /PictureBox note/i);
  assert.match(downloads, /portable image-source rendering/i);
});

test('generated public site contains downloads and current plus frozen native compiler assets but no paper page', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });
  assert.equal(fs.existsSync('_site/paper.html'), false, 'paper.html must remain outside the public site');
  for (const file of [
    '_site/downloads.html',
    '_site/designer-alignment.js',
    '_site/designer-alignment-guides.js',
    '_site/designer-multiselect.js',
    '_site/designer-multiselect.css',
    '_site/src/native-gui-ir-v12.js',
    '_site/src/native-tree-backend-adapter.js',
    '_site/src/sealed-native-gui-v12.js',
    '_site/src/native-gui-ir-v13.js',
    '_site/src/native-slider-backend-adapter.js',
    '_site/src/sealed-native-gui-v13.js',
    '_site/src/native-gui-ir-v14.js',
    '_site/src/native-gui-ir-v15.js',
    '_site/src/native-gui-ir-v16.js',
    '_site/src/native-gui-ir-v17.js',
    '_site/src/native-chrome-backend-adapter.js',
    '_site/src/native-shape-backend-adapter.js',
    '_site/src/native-paintbox-backend-adapter.js',
    '_site/src/sealed-native-gui-v14.js',
    '_site/src/sealed-native-gui-v15.js',
    '_site/src/sealed-native-gui-v16.js',
    '_site/src/sealed-native-gui-v17.js',
    '_site/src/native-paintbox-image-backend-adapter.js'
  ]) assert.ok(fs.existsSync(file), file);
});
