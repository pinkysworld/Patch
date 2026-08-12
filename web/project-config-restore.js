import { parseStoredStudioProject, studioStateFromBundle } from '../src/studio-project.js';

const CURRENT_KEY = 'patchStudio.project.v2';
const buildTarget = document.querySelector('#buildTarget');
const nativeBuildMode = document.querySelector('#nativeBuildMode');

try {
  const raw = localStorage.getItem(CURRENT_KEY);
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
