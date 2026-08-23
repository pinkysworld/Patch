(() => {
  installDesignerMutationGuard();

  if (!('serviceWorker' in navigator)) return;

  const reloadGuardKey = 'patch-studio-sw-reload-guard';
  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src, window.location.href) : null;
  const siteRevision = scriptUrl?.searchParams.get('v') || '';
  const reloadGuardValue = siteRevision || 'unversioned';
  const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
  const canonicalWorker = new URL('./sw.js', window.location.href);
  const canonicalWorkerUrl = siteRevision
    ? `./sw.js?v=${encodeURIComponent(siteRevision)}`
    : './sw.js';

  // Patch Studio historically registered the worker from more than one module.
  // Keep those legacy calls harmless by forcing every local sw.js registration
  // onto the same revision-bound script URL and scope. This prevents a late
  // unversioned registration from replacing the controller after Studio boot.
  if (siteRevision) {
    try {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        configurable: true,
        value: (scriptURL, options = {}) => {
          let requested;
          try { requested = new URL(String(scriptURL), window.location.href); }
          catch { return originalRegister(scriptURL, options); }
          if (requested.origin === canonicalWorker.origin && requested.pathname === canonicalWorker.pathname) {
            return originalRegister(canonicalWorkerUrl, {
              ...(options ?? {}),
              updateViaCache: 'none',
              scope: options?.scope ?? './'
            });
          }
          return originalRegister(scriptURL, options);
        }
      });
    } catch {
      // If a browser does not allow shadowing register(), the canonical bootstrap
      // registration below still provides the normal recovery path.
    }
  }

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

  // Run independently of the compiler/designer module graph so a stale or missing
  // application module cannot block service-worker recovery.
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
})();
