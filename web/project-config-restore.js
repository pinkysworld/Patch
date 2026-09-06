import { parseStoredStudioProject, parseStudioProjectBundle, studioStateFromBundle } from '../src/studio-project.js';
import {
  activateStudioProjectFile,
  getStudioProjectBundle,
  persistStudioProjectFromDom
} from './project-lifecycle.js';
import { PATCH_STUDIO_SHOWCASE_PROJECT } from './studio-showcase-project.js';

const CURRENT_KEYS = ['patchStudio.project.v4', 'patchStudio.project.v3', 'patchStudio.project.v2', 'patchStudio.project.v1'];
const buildTarget = document.querySelector('#buildTarget');
const nativeBuildMode = document.querySelector('#nativeBuildMode');
const sample = document.querySelector('#sample');

installDesignerObserverCoordinator();
installStudioShowcaseSample();

// Example selection is an explicit load action, not project persistence. Keep the
// fast Counter example selected at startup so the large Workshop Desk or complete
// Studio Showcase is never injected automatically before the module graph settles.
// This also prevents a saved v4/v3/v2/v1 project from being overwritten at startup.
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

function installStudioShowcaseSample() {
  if (!sample) return;
  let option = sample.querySelector('option[value="studioShowcase"]');
  if (!option) {
    option = document.createElement('option');
    option.value = 'studioShowcase';
    option.textContent = 'Patch Studio Showcase';
    const workshop = sample.querySelector('option[value="workshopDesk"]');
    sample.insertBefore(option, workshop ?? sample.firstElementChild);
  }

  sample.addEventListener('change', event => {
    if (sample.value !== 'studioShowcase') return;
    event.stopImmediatePropagation();
    try {
      loadStudioShowcaseProject();
    } catch (error) {
      const status = document.querySelector('#saveState');
      if (status) {
        status.textContent = 'Showcase load stopped';
        status.title = error?.message ?? String(error);
      }
    }
  }, { capture: true });
}

function loadStudioShowcaseProject() {
  const incoming = parseStudioProjectBundle(PATCH_STUDIO_SHOWCASE_PROJECT);
  const entry = incoming.files.find(file => file.path === incoming.project.entry);
  if (!entry) throw new Error(`Showcase entry '${incoming.project.entry}' is missing.`);

  // Flush the current editor state first. The final forced persist then records one
  // recovery snapshot for the previous project instead of a chain of intermediate
  // add-file/add-resource snapshots.
  persistStudioProjectFromDom({ snapshot: 'none' });
  const live = getStudioProjectBundle();
  if (!live) throw new Error('Patch Studio project state is unavailable.');

  live.format = incoming.format;
  live.version = incoming.version;
  live.project = {
    ...incoming.project,
    build: { ...incoming.project.build }
  };
  live.files = incoming.files.map(file => ({ ...file }));
  live.resources = incoming.resources.map(resource => ({ ...resource }));

  const projectName = document.querySelector('#projectName');
  const projectKind = document.querySelector('#projectKind');
  const code = document.querySelector('#code');
  if (projectName) projectName.value = incoming.project.name;
  if (projectKind) projectKind.value = incoming.project.kind;
  if (buildTarget && hasOption(buildTarget, incoming.project.build.target)) buildTarget.value = incoming.project.build.target;
  if (nativeBuildMode && hasOption(nativeBuildMode, incoming.project.build.nativeMode)) nativeBuildMode.value = incoming.project.build.nativeMode;
  if (code) code.value = entry.content;

  persistStudioProjectFromDom({ snapshot: 'force' });
  activateStudioProjectFile(incoming.project.entry);

  const detail = {
    entry: incoming.project.entry,
    activeFile: incoming.project.entry,
    files: incoming.files.map(file => file.path),
    resources: incoming.resources.map(resource => resource.id)
  };
  window.dispatchEvent(new CustomEvent('patch:studio-project-files-changed', { detail }));
  window.dispatchEvent(new CustomEvent('patch:studio-project-resources-changed', { detail }));

  buildTarget?.dispatchEvent(new Event('change', { bubbles: true }));
  nativeBuildMode?.dispatchEvent(new Event('change', { bubbles: true }));
  projectKind?.dispatchEvent(new Event('change', { bubbles: true }));
  code?.dispatchEvent(new Event('input', { bubbles: true }));
  code?.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#tabDesigner')?.click();

  const status = document.querySelector('#saveState');
  if (status) {
    status.textContent = 'Patch Studio Showcase loaded';
    status.title = 'Complete current Project v4 Studio showcase loaded locally.';
  }
}

function installDesignerObserverCoordinator() {
  const BaseObserver = window.MutationObserver;
  if (typeof BaseObserver !== 'function' || window.__patchStudioDesignerObserverCoordinator === true) return;
  window.__patchStudioDesignerObserverCoordinator = true;

  const pendingObservers = new Set();
  const designerObservers = new Set();
  let flushQueued = false;
  let flushing = false;

  class CoordinatedDesignerObserver {
    constructor(callback) {
      if (typeof callback !== 'function') throw new TypeError('MutationObserver callback must be a function');
      this.callback = callback;
      this.observations = [];
      this.pending = [];
      this.active = true;
      this.designerBound = false;
      this.base = new BaseObserver(records => {
        if (!this.designerBound) {
          this.callback(records, this);
          return;
        }
        this.pending.push(...records);
        pendingObservers.add(this);
        scheduleFlush();
      });
    }

    observe(target, options) {
      this.active = true;
      const existing = this.observations.findIndex(item => item.target === target);
      const record = { target, options: { ...(options ?? {}) } };
      if (existing >= 0) this.observations[existing] = record;
      else this.observations.push(record);
      if (isDesignerTarget(target)) {
        this.designerBound = true;
        designerObservers.add(this);
      }
      this.base.observe(target, options);
    }

    disconnect() {
      this.active = false;
      this.pending = [];
      this.observations = [];
      pendingObservers.delete(this);
      designerObservers.delete(this);
      this.base.disconnect();
    }

    takeRecords() {
      return [...this.pending.splice(0), ...this.base.takeRecords()];
    }

    pause() {
      this.base.disconnect();
    }

    reconnect() {
      if (!this.active) return;
      for (const { target, options } of this.observations) this.base.observe(target, options);
    }
  }

  function scheduleFlush() {
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flushDesignerObservers);
  }

  function flushDesignerObservers() {
    flushQueued = false;
    if (flushing) return scheduleFlush();
    const batch = [...pendingObservers].filter(observer => observer.active && observer.pending.length);
    pendingObservers.clear();
    if (!batch.length) return;

    flushing = true;
    // Pause every live Designer observer, not only those already present in this
    // mutation batch. A callback commonly rewrites DOM that belongs to another
    // Designer module. Keeping the complete observer set paused prevents the
    // cross-module A -> B -> C -> A feedback chain that can otherwise monopolize
    // Chrome's microtask queue while a large Form project is reconciled.
    const paused = [...designerObservers].filter(observer => observer.active);
    for (const observer of paused) observer.pause();
    try {
      for (const observer of batch) {
        const records = observer.pending.splice(0);
        if (records.length && observer.active) observer.callback(records, observer);
      }
    } finally {
      // Keep the complete Designer observer set paused through callbacks' own
      // reconciliation microtasks. Reconnect once those writes have settled.
      queueMicrotask(() => {
        for (const observer of paused) observer.reconnect();
        flushing = false;
        if (pendingObservers.size) scheduleFlush();
      });
    }
  }

  function isDesignerTarget(target) {
    if (!target) return false;
    if (target.id === 'designer' || target.id === 'designerCanvas') return true;
    const element = target.nodeType === 1 ? target : target.parentElement;
    return Boolean(element?.closest?.('#designer'));
  }

  window.MutationObserver = CoordinatedDesignerObserver;
}

function hasOption(select, value) {
  return Array.from(select.options ?? []).some(option => option.value === value);
}
