(() => {
  if (!('serviceWorker' in navigator)) return;

  const reloadGuardKey = 'patch-studio-sw-reload-guard';
  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src, window.location.href) : null;
  const siteRevision = scriptUrl?.searchParams.get('v') || '';
  let reloadedForActivation = false;
  try {
    reloadedForActivation = sessionStorage.getItem(reloadGuardKey) === '1';
    if (reloadedForActivation) sessionStorage.removeItem(reloadGuardKey);
  } catch {}

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloadRequested = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadedForActivation || reloadRequested) return;
    reloadRequested = true;
    try { sessionStorage.setItem(reloadGuardKey, '1'); } catch {}
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
})();
