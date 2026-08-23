(() => {
  installDesignerMutationGuard();
  installSmokeProbe();

  if (!('serviceWorker' in navigator)) return;

  const reloadGuardKey = 'patch-studio-sw-reload-guard';
  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src, window.location.href) : null;
  const siteRevision = scriptUrl?.searchParams.get('v') || '';
  const reloadGuardValue = siteRevision || 'unversioned';

  let reloadedForActivation = false;
  try {
    reloadedForActivation = sessionStorage.getItem(reloadGuardKey) === reloadGuardValue;
  } catch {}

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloadRequested = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadedForActivation || reloadRequested) return;
    reloadRequested = true;
    try { sessionStorage.setItem(reloadGuardKey, reloadGuardValue); } catch {}
    window.location.reload();
  });

  const refresh = async () => {
    try {
      const registration = siteRevision
        ? await navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(siteRevision)}`, { updateViaCache: 'none', scope: './' })
        : await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      await registration.update();
    } catch {
      // A network failure must not prevent the already-cached Studio from opening offline.
    }
  };

  // Bootstrap owns service-worker registration and refresh. Keeping this before the
  // module graph gives stale deployments one deterministic recovery path without
  // late module registrations changing the active controller again.
  void refresh();

  function installDesignerMutationGuard() {
    const NativeMutationObserver = window.MutationObserver;
    if (typeof NativeMutationObserver !== 'function' || window.__patchStudioMutationGuardInstalled === true) return;
    window.__patchStudioMutationGuardInstalled = true;

    const scheduleMicrotask = typeof queueMicrotask === 'function'
      ? queueMicrotask
      : callback => Promise.resolve().then(callback);

    class PatchStudioMutationObserver {
      constructor(callback) {
        if (typeof callback !== 'function') throw new TypeError('MutationObserver callback must be a function');
        this.callback = callback;
        this.observations = [];
        this.active = true;
        this.guarded = false;
        this.reconnectQueued = false;
        this.nativeObserver = new NativeMutationObserver(records => {
          if (!this.guarded) {
            this.callback(records, this);
            return;
          }

          // Designer observers commonly schedule a DOM reconciliation microtask.
          // Keep the observer disconnected through that microtask so mutations made
          // by its own reconciliation cannot immediately trigger the same observer
          // again and starve Chrome's main thread.
          this.nativeObserver.disconnect();
          this.reconnectQueued = true;
          try {
            this.callback(records, this);
          } finally {
            scheduleMicrotask(() => this.reconnect());
          }
        });
      }

      observe(target, options) {
        this.active = true;
        const existing = this.observations.findIndex(item => item.target === target);
        const observation = { target, options: { ...(options ?? {}) } };
        if (existing >= 0) this.observations[existing] = observation;
        else this.observations.push(observation);
        if (isDesignerTarget(target)) this.guarded = true;
        this.nativeObserver.observe(target, options);
      }

      disconnect() {
        this.active = false;
        this.reconnectQueued = false;
        this.observations = [];
        this.nativeObserver.disconnect();
      }

      takeRecords() {
        return this.nativeObserver.takeRecords();
      }

      reconnect() {
        if (!this.reconnectQueued || !this.active) return;
        this.reconnectQueued = false;
        for (const { target, options } of this.observations) {
          this.nativeObserver.observe(target, options);
        }
      }
    }

    function isDesignerTarget(target) {
      if (!target) return false;
      if (target.id === 'designer' || target.id === 'designerCanvas') return true;
      const element = target.nodeType === 1 ? target : target.parentElement;
      return Boolean(element?.closest?.('#designer'));
    }

    window.MutationObserver = PatchStudioMutationObserver;
  }

  function installSmokeProbe() {
    let enabled = false;
    try { enabled = new URL(window.location.href).searchParams.get('patch-smoke') === '1'; }
    catch { return; }
    if (!enabled) return;

    document.documentElement.dataset.patchStudioSmoke = 'pending';
    const smokeDeadline = Date.now() + 7000;

    const probeReadyStudio = () => {
      const run = document.querySelector('#run');
      const app = document.querySelector('#app');
      if (run && app) {
        run.click();
        const renderedWindow = app.querySelector('.patch-window');
        if (!app.hidden && renderedWindow) {
          document.documentElement.dataset.patchStudioSmoke = 'ready';
          return;
        }
      }

      if (Date.now() >= smokeDeadline) {
        document.documentElement.dataset.patchStudioSmoke = 'failed';
        return;
      }
      window.setTimeout(probeReadyStudio, 200);
    };

    // Production module loading can legitimately take longer than local CI. Probe
    // the real Run behavior instead of assuming its listener exists after 1 second.
    window.setTimeout(probeReadyStudio, 250);
  }
})();
