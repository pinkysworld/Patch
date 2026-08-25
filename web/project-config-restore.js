import { parseStoredStudioProject, studioStateFromBundle } from '../src/studio-project.js';

const CURRENT_KEYS = ['patchStudio.project.v3', 'patchStudio.project.v2', 'patchStudio.project.v1'];
const buildTarget = document.querySelector('#buildTarget');
const nativeBuildMode = document.querySelector('#nativeBuildMode');
const sample = document.querySelector('#sample');

installDesignerObserverCoordinator();

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

function installDesignerObserverCoordinator() {
  const BaseObserver = window.MutationObserver;
  if (typeof BaseObserver !== 'function' || window.__patchStudioDesignerObserverCoordinator === true) return;
  window.__patchStudioDesignerObserverCoordinator = true;

  const pendingObservers = new Set();
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
      if (isDesignerTarget(target)) this.designerBound = true;
      this.base.observe(target, options);
    }

    disconnect() {
      this.active = false;
      this.pending = [];
      this.observations = [];
      pendingObservers.delete(this);
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
    // Pause every participating Designer observer before invoking any callback.
    // DOM reconciliation performed by one callback therefore cannot synchronously
    // wake another observer and create A -> B -> A mutation ping-pong.
    for (const observer of batch) observer.pause();
    try {
      for (const observer of batch) {
        const records = observer.pending.splice(0);
        if (records.length && observer.active) observer.callback(records, observer);
      }
    } finally {
      // Keep the whole batch paused through callbacks' own reconciliation
      // microtasks. Reconnect once those writes have settled.
      queueMicrotask(() => {
        for (const observer of batch) observer.reconnect();
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
