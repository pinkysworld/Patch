(() => {
  installStartupDiagnostics();
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

  function installStartupDiagnostics() {
    if (window.__patchStudioStartupDiagnostics) return;

    const root = document.documentElement;
    const entries = [];
    const maxEntries = 8;
    const startupDeadlineMs = 10_000;
    let ready = false;
    let surface = null;
    let summary = null;
    let details = null;
    let copyButton = null;
    let dismissed = false;

    root.dataset.patchStudioStartup = 'booting';

    const api = Object.freeze({
      snapshot: () => entries.map(entry => ({ ...entry })),
      format: formatStartupReport,
      report: (type, message, asset = '') => record(type, message, asset),
      get state() { return root.dataset.patchStudioStartup ?? 'booting'; }
    });
    window.__patchStudioStartupDiagnostics = api;

    window.addEventListener('error', event => {
      if (ready) return;
      const target = event.target;
      if (target?.tagName === 'SCRIPT' && target.src) {
        record('module-load', 'A critical Patch Studio module failed to load.', target.src);
        return;
      }
      const message = event.error?.message ?? event.message;
      if (message) record('startup-error', message);
    }, true);

    window.addEventListener('unhandledrejection', event => {
      if (ready) return;
      const reason = event.reason;
      record('startup-rejection', reason?.message ?? reason ?? 'A startup promise was rejected.');
    });

    window.addEventListener('patch:studio-ready', () => {
      ready = true;
      window.clearTimeout(watchdog);
      root.dataset.patchStudioReady = 'true';
      root.dataset.patchStudioStartup = entries.length ? 'degraded' : 'ready';
      if (!entries.length && surface) surface.hidden = true;
      else render();
    }, { once: true });

    const watchdog = window.setTimeout(() => {
      if (ready) return;
      record('startup-timeout', 'Patch Studio modules did not finish initialization within 10 seconds.');
    }, startupDeadlineMs);

    // The production browser gate can inject one safe synthetic startup failure to
    // prove this early diagnostic path on the deployed site without breaking a real
    // module request. Normal users never receive this entry.
    try {
      if (new URL(window.location.href).searchParams.get('startup-diagnostic-smoke') === '1') {
        record('module-load', 'Synthetic startup smoke with Bearer patch-startup-smoke-secret.', './__patch_startup_diagnostic_smoke__.js?token=patch-startup-smoke-secret');
      }
    } catch {}

    function record(type, message, asset = '') {
      const entry = {
        time: new Date().toISOString(),
        type: redactStartupText(type, 80),
        message: redactStartupText(message, 600),
        asset: sanitizeAsset(asset)
      };
      const previous = entries[entries.length - 1];
      if (previous?.type === entry.type && previous?.message === entry.message && previous?.asset === entry.asset) return previous;
      entries.push(entry);
      if (entries.length > maxEntries) entries.splice(0, entries.length - maxEntries);
      dismissed = false;
      root.dataset.patchStudioStartup = ready ? 'degraded' : 'failed';
      render();
      window.dispatchEvent(new CustomEvent('patch:studio-startup-diagnostic', { detail: { ...entry } }));
      return entry;
    }

    function render() {
      ensureSurface();
      if (!surface) return;
      surface.hidden = dismissed || entries.length === 0;
      if (surface.hidden) return;
      const latest = entries[entries.length - 1];
      summary.textContent = root.dataset.patchStudioStartup === 'degraded'
        ? 'Patch Studio started, but a startup issue was detected.'
        : 'Patch Studio could not confirm a clean startup.';
      const asset = latest.asset ? ` · ${latest.asset}` : '';
      details.textContent = `${latest.type}${asset}\n${latest.message}`;
      copyButton.dataset.copyState = 'idle';
      copyButton.textContent = 'Copy startup diagnostics';
    }

    function ensureSurface() {
      if (surface?.isConnected) return;
      const studio = document.querySelector('.studio');
      if (!studio) return;

      installStartupStyles();
      surface = document.createElement('section');
      surface.id = 'startupDiagnostics';
      surface.className = 'startup-diagnostics';
      surface.setAttribute('role', 'status');
      surface.setAttribute('aria-live', 'polite');
      surface.setAttribute('aria-label', 'Patch Studio startup diagnostics');

      const copy = document.createElement('div');
      copy.className = 'startup-diagnostics-copy';
      const title = document.createElement('strong');
      title.textContent = 'Startup diagnostics';
      summary = document.createElement('span');
      summary.className = 'startup-diagnostics-summary';
      copy.append(title, summary);

      const disclosure = document.createElement('details');
      const disclosureLabel = document.createElement('summary');
      disclosureLabel.textContent = 'Redacted details';
      details = document.createElement('pre');
      details.className = 'startup-diagnostics-details';
      disclosure.append(disclosureLabel, details);

      const actions = document.createElement('div');
      actions.className = 'startup-diagnostics-actions';
      copyButton = document.createElement('button');
      copyButton.id = 'copyStartupDiagnostics';
      copyButton.type = 'button';
      copyButton.className = 'secondary small';
      copyButton.textContent = 'Copy startup diagnostics';
      copyButton.addEventListener('click', async () => {
        try {
          await copyStartupText(formatStartupReport());
          copyButton.dataset.copyState = 'copied';
          copyButton.textContent = 'Copied';
        } catch {
          copyButton.dataset.copyState = 'failed';
          copyButton.textContent = 'Copy unavailable';
        }
      });
      const dismiss = document.createElement('button');
      dismiss.id = 'dismissStartupDiagnostics';
      dismiss.type = 'button';
      dismiss.className = 'secondary small';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', () => {
        dismissed = true;
        surface.hidden = true;
      });
      actions.append(copyButton, dismiss);

      surface.append(copy, disclosure, actions);
      studio.prepend(surface);
    }

    function formatStartupReport() {
      const version = redactStartupText(document.querySelector('.studio')?.dataset.patchVersion ?? 'unknown', 80);
      const state = root.dataset.patchStudioStartup ?? 'booting';
      const lines = [
        `Patch Studio startup diagnostics ${version}`,
        `State: ${state}`,
        `Entries: ${entries.length}`
      ];
      for (const entry of entries) {
        lines.push(`- ${entry.time} [${entry.type}]${entry.asset ? ` ${entry.asset}` : ''} ${entry.message}`);
      }
      lines.push('', 'Privacy: Patch source omitted; tokens, email addresses, home-directory usernames and URL query/fragment data redacted; nothing uploaded.');
      return lines.join('\n');
    }

    async function copyStartupText(text) {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch {
          // Fall through to the local textarea path when clipboard permission is unavailable.
        }
      }
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand?.('copy');
      area.remove();
      if (!copied) throw new Error('Clipboard access is unavailable.');
    }

    function sanitizeAsset(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      try {
        const url = new URL(raw, window.location.href);
        return redactStartupText(url.pathname, 240);
      } catch {
        return redactStartupText(raw.split(/[?#]/, 1)[0], 240);
      }
    }

    function redactStartupText(value, maxLength = 600) {
      let text = String(value ?? '');
      text = text
        .replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted-token]')
        .replace(/\bgh[pousr]_[A-Za-z0-9]+\b/g, '[redacted-token]')
        .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted-token]')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
        .replace(/\/Users\/[^/\s]+/g, '/Users/[redacted-user]')
        .replace(/\/home\/[^/\s]+/g, '/home/[redacted-user]')
        .replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/g, 'C:\\Users\\[redacted-user]')
        .replace(/https?:\/\/[^\s)]+/gi, raw => {
          try {
            const url = new URL(raw);
            return `${url.origin}${url.pathname}`;
          } catch {
            return '[redacted-url]';
          }
        });
      const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 600;
      return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}…`;
    }

    function installStartupStyles() {
      if (document.querySelector('style[data-patch-startup-diagnostics]')) return;
      const style = document.createElement('style');
      style.dataset.patchStartupDiagnostics = '1';
      style.textContent = `
        .startup-diagnostics {
          margin: 12px 18px 0;
          padding: 12px 14px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px 16px;
          align-items: center;
          border: 1px solid var(--border-strong, #8b8b91);
          border-radius: 12px;
          background: var(--surface, #fff);
          color: var(--text, #17171a);
        }
        .startup-diagnostics[hidden] { display: none !important; }
        .startup-diagnostics-copy { min-width: 0; display: grid; gap: 2px; }
        .startup-diagnostics-copy strong { font-size: 12px; }
        .startup-diagnostics-summary { color: var(--muted, #666); font-size: 11px; line-height: 1.4; }
        .startup-diagnostics details { grid-column: 1 / -1; min-width: 0; }
        .startup-diagnostics details summary { cursor: pointer; font-size: 10px; font-weight: 700; }
        .startup-diagnostics-details { margin: 7px 0 0; max-height: 150px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 10px; }
        .startup-diagnostics-actions { display: flex; gap: 7px; justify-content: flex-end; align-items: center; }
        @media (max-width: 640px) {
          .startup-diagnostics { grid-template-columns: 1fr; margin-inline: 10px; }
          .startup-diagnostics-actions { justify-content: flex-start; flex-wrap: wrap; }
        }
        @media (forced-colors: active) {
          .startup-diagnostics { border: 1px solid CanvasText; }
        }
      `;
      document.head.appendChild(style);
    }
  }

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
