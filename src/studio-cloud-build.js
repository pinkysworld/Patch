import {
  createRemoteBuildRequest,
  dispatchRemoteBuild,
  waitForRemoteBuild,
  listRemoteBuildArtifacts,
  fetchRemoteBuildArtifact
} from './remote-build.js';

let dialog = null;
let token = '';
let installed = false;

export function installStudioCloudBuild() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#build');
    if (!button) return;
    const target = document.querySelector('#buildTarget');
    if (target?.value !== 'native-info') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const source = document.querySelector('#code')?.value ?? '';
    const name = safeStudioName(document.querySelector('#projectName')?.value);
    const kind = document.querySelector('#projectKind')?.value === 'window' ? 'window' : 'console';
    const output = document.querySelector('#output');
    if (output) output.textContent = 'Opening cross-platform desktop build…';
    openStudioCloudBuild({ source, name, kind }).catch(error => {
      if (output) output.textContent = `Desktop build stopped:\n${error?.message ?? String(error)}`;
    });
  }, true);
}

export async function openStudioCloudBuild({ source, name, kind = 'console' } = {}) {
  if (typeof document === 'undefined') throw new Error('Studio cloud builds require a browser environment.');
  ensureDialog();
  dialog.querySelector('#cloudKind').value = kind === 'window' ? 'window' : 'console';
  dialog.querySelector('#cloudStatus').textContent = 'Choose a target and start the build.';
  dialog.querySelector('#cloudArtifacts').innerHTML = '';
  dialog.querySelector('#cloudRunLink').hidden = true;
  dialog.querySelector('#cloudToken').value = token;
  dialog.showModal();

  return new Promise(resolve => {
    const start = dialog.querySelector('#cloudStart');
    const cancel = dialog.querySelector('#cloudCancel');
    const close = result => {
      start.onclick = null;
      cancel.onclick = null;
      if (dialog.open) dialog.close();
      resolve(result);
    };
    cancel.onclick = () => close({ cancelled: true });
    start.onclick = async () => {
      const status = dialog.querySelector('#cloudStatus');
      const artifactsView = dialog.querySelector('#cloudArtifacts');
      const runLink = dialog.querySelector('#cloudRunLink');
      token = dialog.querySelector('#cloudToken').value.trim();
      start.disabled = true;
      artifactsView.innerHTML = '';
      try {
        const request = createRemoteBuildRequest({
          source,
          name,
          kind: dialog.querySelector('#cloudKind').value,
          target: dialog.querySelector('#cloudTarget').value
        });
        status.textContent = 'Sending the current Patch source to GitHub Actions…';
        await dispatchRemoteBuild({ token, request });
        const run = await waitForRemoteBuild({
          token,
          requestId: request.requestId,
          onStatus(update) {
            status.textContent = update.message;
            if (update.run?.html_url) {
              runLink.href = update.run.html_url;
              runLink.hidden = false;
            }
          }
        });
        if (run.conclusion !== 'success') throw new Error(`GitHub build finished with ${run.conclusion ?? 'an error'}.`);
        const artifacts = await listRemoteBuildArtifacts({ token, runId: run.id });
        status.textContent = artifacts.length ? 'Build complete. Download an artifact:' : 'Build completed, but no artifact was returned.';
        for (const artifact of artifacts) artifactsView.appendChild(artifactButton(artifact, token, run.html_url));
        start.textContent = 'Build again';
      } catch (error) {
        status.textContent = `Build stopped: ${error?.message ?? String(error)}`;
      } finally {
        start.disabled = false;
      }
    };
  });
}

function ensureDialog() {
  if (dialog) return;
  installStyles();
  dialog = document.createElement('dialog');
  dialog.id = 'cloudBuildDialog';
  dialog.className = 'cloud-build-dialog';
  dialog.innerHTML = `
    <section class="cloud-build-card">
      <header><div><strong>Build for desktop</strong><span>GitHub Actions</span></div><button id="cloudCancel" class="secondary" type="button" aria-label="Close">×</button></header>
      <p class="cloud-intro">Build the Patch source currently in Studio for Windows, macOS or Linux. Console projects use Patch's direct-Wasm native host. Window projects are packaged as standalone desktop GUI applications.</p>
      <div class="cloud-grid">
        <label>Target<select id="cloudTarget"><option value="all">Windows + macOS + Linux</option><option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option></select></label>
        <label>Type<select id="cloudKind"><option value="console">Console</option><option value="window">Window / GUI</option></select></label>
      </div>
      <label class="cloud-token">GitHub token<input id="cloudToken" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"><small>Used only in this browser tab to call GitHub Actions. Patch Studio does not save it. The token needs permission to run Actions in pinkysworld/Patch.</small></label>
      <div class="cloud-actions"><button id="cloudStart" type="button">Build</button><a id="cloudRunLink" target="_blank" rel="noreferrer" hidden>Open build on GitHub</a></div>
      <p id="cloudStatus" class="cloud-status">Choose a target and start the build.</p>
      <div id="cloudArtifacts" class="cloud-artifacts"></div>
    </section>`;
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.body.appendChild(dialog);
}

function installStyles() {
  if (document.querySelector('#patchCloudBuildStyles')) return;
  const style = document.createElement('style');
  style.id = 'patchCloudBuildStyles';
  style.textContent = `.cloud-build-dialog{width:min(590px,calc(100vw - 28px));padding:0;border:0;border-radius:16px;background:transparent;color:inherit;box-shadow:0 28px 90px #0006}.cloud-build-dialog::backdrop{background:#1118;backdrop-filter:blur(3px)}.cloud-build-card{padding:20px;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:16px}.cloud-build-card header{display:flex;align-items:center;justify-content:space-between;gap:16px}.cloud-build-card header div{display:flex;flex-direction:column;gap:2px}.cloud-build-card header strong{font-size:18px}.cloud-build-card header span,.cloud-intro,.cloud-token small,.cloud-status{color:var(--muted,#71717a)}.cloud-build-card header span{font-size:11px}.cloud-intro{font-size:13px;line-height:1.55}.cloud-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cloud-grid label,.cloud-token{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700}.cloud-grid select,.cloud-token input{width:100%}.cloud-token{margin-top:12px}.cloud-token small{font-weight:500;line-height:1.45}.cloud-actions{display:flex;align-items:center;gap:13px;margin-top:15px}.cloud-actions a{font-size:12px;font-weight:700}.cloud-status{min-height:20px;margin:14px 0 8px;font-size:12px}.cloud-artifacts{display:flex;flex-wrap:wrap;gap:7px}.cloud-artifact{font-size:12px}@media(max-width:560px){.cloud-grid{grid-template-columns:1fr}.cloud-build-card{padding:16px}}`;
  document.head.appendChild(style);
}

function artifactButton(artifact, authToken, runUrl) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary cloud-artifact';
  button.textContent = `Download ${artifact.name}.zip`;
  button.onclick = async () => {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Downloading…';
    try {
      const blob = await fetchRemoteBuildArtifact({ token: authToken, artifactId: artifact.id });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${artifact.name}.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      button.textContent = original;
    } catch (error) {
      button.textContent = 'Open GitHub to download';
      button.onclick = () => window.open(runUrl, '_blank', 'noopener,noreferrer');
    } finally {
      button.disabled = false;
    }
  };
  return button;
}

function safeStudioName(name) { return String(name || 'PatchApp').replace(/[^A-Za-z0-9 _.-]/g, '').trim() || 'PatchApp'; }
