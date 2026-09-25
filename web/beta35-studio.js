const sample = document.querySelector('#sample');
const code = document.querySelector('#code');
const projectKind = document.querySelector('#projectKind');

// Workshop Desk is owned by project-config-restore.js as the canonical Project-v4
// sample. Keep beta35-studio focused on its beta35-only incremental additions.
const MULTISELECT_SAMPLE = `create list fruits = ["Banana", "Mango"]

window "Fruit Picker" as main size 540, 360:
  text "Pick one or more fruits"
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits at 24, 72 size 260, 140
  text "Selection is committed only by the changed handler"

when fruits changed:
  change fruits:
    set = value
  show value`;

if (sample && code && projectKind) {
  let option = sample.querySelector('option[value="listboxMultiWindow"]');
  if (!option) {
    option = document.createElement('option');
    option.value = 'listboxMultiWindow';
    option.textContent = 'Multi-select ListBox';
    const capabilities = sample.querySelector('option[value="capabilities"]');
    sample.insertBefore(option, capabilities ?? null);
  }

  const loadWindowSample = source => {
    code.value = source;
    projectKind.value = 'window';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    projectKind.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#tabDesigner')?.click();
  };

  sample.addEventListener('change', event => {
    if (sample.value !== 'listboxMultiWindow') return;

    // Intercept only Studio-owned samples, then use the same public DOM signals as
    // normal editing so persistence, Designer refresh and native-build state stay aligned.
    event.stopImmediatePropagation();
    loadWindowSample(MULTISELECT_SAMPLE);
  }, { capture: true });

  // A selected <option> does not emit change when the user selects the same item
  // again. Keep sample loading explicit and repeatable.
  const toolbar = sample.closest('.toolbar');
  let loadButton = document.querySelector('#loadSample');
  if (!loadButton && toolbar) {
    loadButton = document.createElement('button');
    loadButton.id = 'loadSample';
    loadButton.type = 'button';
    loadButton.className = 'secondary';
    loadButton.textContent = 'Load example';
    loadButton.title = 'Load or reload the selected example into main.patch';
    loadButton.setAttribute('aria-label', 'Load selected example');
    const field = sample.closest('.compact-field');
    field?.after(loadButton);
  }

  const loadSelectedSample = () => {
    if (!sample.value) return;
    sample.dispatchEvent(new Event('change', { bubbles: true }));
  };
  loadButton?.addEventListener('click', loadSelectedSample);

  // Keep fresh Studio startup lightweight. The default Window app already
  // matches playground.js, while Workshop Desk remains the explicit large showcase
  // and stress fixture loaded through the same source-backed public DOM signals.
}

// Multi-Form projects can contain hundreds of controls. Keep every Form in the
// source-backed DOM so structural adapters and selection indices stay stable,
// but let the browser fully render only the active Form. The Form selector is
// already the canonical active-Form control used by forms-designer.js.
queueMicrotask(installActiveFormRendering);

function installActiveFormRendering() {
  const canvas = document.querySelector('#designerCanvas');
  if (!canvas || canvas.dataset.patchActiveFormRendering === 'true') return;

  const attach = () => {
    const select = document.querySelector('#patchFormSelect');
    if (!select) return false;
    canvas.dataset.patchActiveFormRendering = 'true';

    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        syncActiveFormRendering(canvas, select);
      });
    };

    select.addEventListener('change', schedule);
    canvas.addEventListener('patch-designer-selection-change', schedule);
    code?.addEventListener('input', schedule);
    code?.addEventListener('change', schedule);
    new MutationObserver(schedule).observe(canvas, { childList: true, subtree: true });
    schedule();
    return true;
  };

  if (attach()) return;
  const observer = new MutationObserver(() => {
    if (!attach()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function syncActiveFormRendering(canvas, select) {
  const shells = [...canvas.querySelectorAll(':scope .patch-window')];
  if (!shells.length) return;
  const requested = Number(select.value);
  const active = Number.isInteger(requested)
    ? Math.max(0, Math.min(requested, shells.length - 1))
    : 0;

  shells.forEach((shell, index) => {
    const isActive = index === active;
    shell.hidden = !isActive;
    shell.dataset.patchDesignerFormDetail = isActive ? 'full' : 'deferred';
  });
  canvas.dataset.patchDesignerActiveForm = String(active);
}
