import './designer-data-editor.js';
import './designer-tabs-nested.js';
import './designer-tabs-control-actions.js';
import './designer-tabs-page-duplicate.js';
import './designer-control-duplicate.js';
import './designer-form-duplicate.js';
import './designer-form-delete.js';
import './designer-table-actions.js';
import './designer-tree-duplicate.js';
import './designer-structure-ux.js';
import './designer-ux.js';
import './designer-event-inspector.js';
import './designer-focus-order.js';
import './designer-layout-actions.js';
import './form-designer-workflow.js';
import './designer-toolbox.js';

const STORAGE_KEY = 'patch-studio-designer-properties-v1';
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 480;
const BULK_WINDOW_SAMPLES = new Set(['workshopDesk', 'listboxMultiWindow']);

installClassicBrandMark();
installBulkSampleLoadGuard();
queueMicrotask(install);

function installClassicBrandMark() {
  const mark = document.querySelector('.brand-mark');
  if (!mark || mark.dataset.patchBrandMark === 'classic-p') return;
  mark.dataset.patchBrandMark = 'classic-p';
  mark.innerHTML = '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M8 6H22V18H13V26H8ZM13 10H18V14H13Z"/></svg>';
}

function installBulkSampleLoadGuard() {
  const sample = document.querySelector('#sample');
  const code = document.querySelector('#code');
  const root = document.documentElement;
  if (!sample || !code || root.dataset.patchSampleBatchGuard === 'true') return;
  root.dataset.patchSampleBatchGuard = 'true';

  let bulkSampleLoad = false;
  document.addEventListener('change', event => {
    if (event.target === sample && BULK_WINDOW_SAMPLES.has(sample.value)) {
      bulkSampleLoad = true;
      queueMicrotask(() => { bulkSampleLoad = false; });
      return;
    }

    // beta35-studio historically dispatched both input and change for a complete
    // source replacement. Input already schedules persistence, parsing and Designer
    // refresh. Let the following project-kind change perform the one immediate
    // refresh and suppress only the redundant source change pass. This keeps a
    // large showcase from rendering and compiling the same program several times
    // synchronously while preserving the normal public DOM synchronization path.
    if (bulkSampleLoad && event.target === code) event.stopImmediatePropagation();
  }, { capture: true });
}

function install() {
  const surface = document.querySelector('#designer .designer-surface');
  const inspector = document.querySelector('#designerInspector');
  const toolbar = document.querySelector('#designer .designer-toolbar');
  if (!surface || !inspector || !toolbar) {
    const observer = new MutationObserver(() => {
      const nextSurface = document.querySelector('#designer .designer-surface');
      const nextInspector = document.querySelector('#designerInspector');
      const nextToolbar = document.querySelector('#designer .designer-toolbar');
      if (!nextSurface || !nextInspector || !nextToolbar) return;
      observer.disconnect();
      install();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return;
  }
  if (surface.dataset.patchWorkspaceEnhanced === 'true') return;
  surface.dataset.patchWorkspaceEnhanced = 'true';

  const state = loadState();
  setWidth(surface, state.width ?? DEFAULT_WIDTH);

  const toggle = document.createElement('button');
  toggle.id = 'designerPropertiesToggle';
  toggle.type = 'button';
  toggle.className = 'secondary small designer-properties-toggle';
  toggle.textContent = 'Object Inspector';
  toggle.title = 'Show or hide the source-backed Object Inspector';
  toolbar.appendChild(toggle);

  const handle = document.createElement('span');
  handle.className = 'designer-inspector-resize';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.tabIndex = 0;
  handle.title = 'Drag to resize Object Inspector. Double-click to reset.';
  inspector.prepend(handle);

  const setCollapsed = collapsed => {
    surface.classList.toggle('designer-properties-collapsed', collapsed);
    toggle.setAttribute('aria-pressed', collapsed ? 'false' : 'true');
    toggle.textContent = collapsed ? 'Show Inspector' : 'Object Inspector';
    saveState({ width: currentWidth(surface), collapsed });
  };
  setCollapsed(Boolean(state.collapsed));

  toggle.addEventListener('click', () => {
    setCollapsed(!surface.classList.contains('designer-properties-collapsed'));
  });

  handle.addEventListener('dblclick', () => {
    setWidth(surface, DEFAULT_WIDTH);
    saveState({ width: DEFAULT_WIDTH, collapsed: false });
    setCollapsed(false);
  });

  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? DEFAULT_WIDTH
      : currentWidth(surface) + (event.key === 'ArrowLeft' ? 20 : -20);
    setWidth(surface, next);
    saveState({ width: currentWidth(surface), collapsed: false });
  });

  handle.addEventListener('pointerdown', event => {
    if (surface.classList.contains('designer-properties-collapsed')) return;
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    surface.classList.add('designer-properties-resizing');

    const move = moveEvent => {
      const rect = surface.getBoundingClientRect();
      setWidth(surface, rect.right - moveEvent.clientX);
    };
    const finish = finishEvent => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      surface.classList.remove('designer-properties-resizing');
      handle.releasePointerCapture?.(finishEvent.pointerId);
      saveState({ width: currentWidth(surface), collapsed: false });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  });
}

function setWidth(surface, value) {
  const rect = surface.getBoundingClientRect();
  const available = rect.width > 0 ? Math.max(MIN_WIDTH, rect.width - 360) : MAX_WIDTH;
  const max = Math.min(MAX_WIDTH, available);
  const width = Math.max(MIN_WIDTH, Math.min(max, Math.round(Number(value) || DEFAULT_WIDTH)));
  surface.style.setProperty('--designer-inspector-width', `${width}px`);
}

function currentWidth(surface) {
  const value = getComputedStyle(surface).getPropertyValue('--designer-inspector-width');
  return Math.round(parseFloat(value) || DEFAULT_WIDTH);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      width: Number.isFinite(Number(parsed.width)) ? Number(parsed.width) : DEFAULT_WIDTH,
      collapsed: parsed.collapsed === true
    };
  } catch {
    return { width: DEFAULT_WIDTH, collapsed: false };
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage can be unavailable */ }
}
