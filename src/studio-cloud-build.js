import {
  createRemoteBuildRequest,
  dispatchRemoteBuild,
  waitForRemoteBuild,
  listRemoteBuildArtifacts,
  fetchRemoteBuildArtifact
} from './remote-build.js';

let dialog = null;
let token = '';

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
        status.textContent = 'Sending source to GitHub Actions…';
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
  dialog = document.createElement('dialog');
  dialog.id = 'cloudBuildDialog';
  dialog.className = 'cloud-build-dialog';
  dialog.innerHTML = `
    <section class="cloud-build-card">
      <header><div><strong>Build for desktop</strong><span>GitHub Actions</span></div><button id="cloudCancel" class="secondary" type="button" aria-label="Close">×</button></header>
      <p class="cloud-intro">Build the Patch source currently in Studio for Windows, macOS or Linux. Console projects use the direct Wasm native host; Window projects are packaged as desktop GUI applications.</p>
      <div class="cloud-grid">
        <label>Target<select id="cloudTarget"><option value="all">Windows + macOS + Linux</option><option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option></select></label>
        <label>Type<select id="cloudKind"><option value="console">Console</option><option value="window">Window / GUI</option></select></label>
      </div>
      <label class="cloud-token">GitHub token<input id="cloudToken" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"><small>Used only in this browser tab to call GitHub Actions. It is not saved by Patch Studio. Use a token that can run Actions in pinkysworld/Patch.</small></label>
      <div class="cloud-actions"><button id="cloudStart" type="button">Build</button><a id="cloudRunLink" target="_blank" rel="noreferrer" hidden>Open build on GitHub</a></div>
      <p id="cloudStatus" class="cloud-status">Choose a target and start the build.</p>
      <div id="cloudArtifacts" class="cloud-artifacts"></div>
    </section>`;
  document.body.appendChild(dialog);
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
