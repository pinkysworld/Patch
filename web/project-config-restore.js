import { parseStoredStudioProject, studioStateFromBundle } from '../src/studio-project.js';

const CURRENT_KEYS = ['patchStudio.project.v3', 'patchStudio.project.v2', 'patchStudio.project.v1'];
const buildTarget = document.querySelector('#buildTarget');
const nativeBuildMode = document.querySelector('#nativeBuildMode');
const sample = document.querySelector('#sample');

// Example selection is an explicit load action, not project persistence. Keep the
// fast Counter example selected at startup so the large Workshop Desk showcase is
// never injected automatically before the Studio module graph has settled. This
// also prevents a saved v3/v2/v1 project from being overwritten by sample startup.
if (sample && hasOption(sample, 'counterWindow')) sample.value = 'counterWindow';

try {
  const raw = CURRENT_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
  if (raw) {
    const state = studioStateFromBundle(parseStoredStudioProject(raw));
    if (buildTarget && hasOption(buildTarget, state.buildTarget)) buildTarget.value = state.buildTarget;
    if (nativeBuildMode && hasOption(nativeBuildMode, state.nativeBuildMode)) nativeBuildMode.value = state.nativeBuildMode;
    buildTarget?.dispatchEvent(new Event('change', { bubbles: true }));
    nativeBuildMode?.dispatchEvent(new Event('change', { bubbles: true }));
  }
} catch {
  // project-lifecycle owns corruption/quarantine reporting; startup restoration remains best-effort here.
}

function hasOption(select, value) {
  return Array.from(select.options ?? []).some(option => option.value === value);
}
