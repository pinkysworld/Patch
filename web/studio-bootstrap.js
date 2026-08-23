(() => {
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
        ? await navigator.serviceWorker.register(canonicalWorkerUrl, { updateViaCache: 'none', scope: './' })
        : await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      await registration.update();
    } catch {
      // A network failure must not prevent the already-cached Studio from opening offline.
    }
  };

  // Run independently of the compiler/designer module graph so a stale or missing
  // application module cannot block service-worker recovery.
  void refresh();
})();
