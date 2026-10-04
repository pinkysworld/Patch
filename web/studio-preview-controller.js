import { createStudioFormMaterializationPlan } from '../src/studio-form-materialization.js';
import { createStudioLanguageClient } from './studio-language-client.js';

export const PATCH_STUDIO_PREVIEW_CONTROLLER_VERSION = '0.1';
export const PATCH_STUDIO_PREVIEW_DEBOUNCE_MS = 220;

export function createStudioPreviewLifecycle({
  languageClient,
  readSource,
  languageProjectOptions = () => ({}),
  formatChangeAnalysis = () => '',
  onChangeContract = () => {},
  onChangeContractError = () => {},
  getSelectedFormIndex = () => 0,
  onDesignerModel = () => {},
  onDesignerEmpty = () => {},
  onDesignerError = () => {},
  debounceMs = PATCH_STUDIO_PREVIEW_DEBOUNCE_MS,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancelSchedule = handle => clearTimeout(handle),
  disposeLanguageClient = true
} = {}) {
  if (!languageClient || typeof languageClient.compile !== 'function' || typeof languageClient.designModel !== 'function') {
    throw new Error('Studio preview lifecycle requires a language client with compile and designModel.');
  }
  if (typeof readSource !== 'function') throw new Error('Studio preview lifecycle requires readSource().');

  let designerTimer = null;
  let changeContractTimer = null;
  let designerRevision = 0;
  let changeContractRevision = 0;
  let disposed = false;

  function clearDesignerTimer() {
    if (designerTimer === null) return;
    cancelSchedule(designerTimer);
    designerTimer = null;
  }

  function clearChangeContractTimer() {
    if (changeContractTimer === null) return;
    cancelSchedule(changeContractTimer);
    changeContractTimer = null;
  }

  function isCurrent(revision, source, kind) {
    if (disposed || String(readSource() ?? '') !== source) return false;
    return kind === 'designer'
      ? revision === designerRevision
      : revision === changeContractRevision;
  }

  async function refreshChangeContract() {
    clearChangeContractTimer();
    if (disposed) return false;
    const revision = ++changeContractRevision;
    const source = String(readSource() ?? '');
    try {
      const compiled = await languageClient.compile(source, languageProjectOptions());
      if (!isCurrent(revision, source, 'change-contract')) return false;
      onChangeContract(formatChangeAnalysis(compiled.ir));
      return true;
    } catch (error) {
      if (!isCurrent(revision, source, 'change-contract')) return false;
      onChangeContractError(error);
      return false;
    }
  }

  function scheduleChangeContract() {
    clearChangeContractTimer();
    if (disposed) return;
    changeContractTimer = schedule(() => {
      changeContractTimer = null;
      void refreshChangeContract();
    }, debounceMs);
  }

  async function refreshDesigner(requestedFormIndex = null) {
    clearDesignerTimer();
    if (disposed) return false;
    const revision = ++designerRevision;
    const source = String(readSource() ?? '');
    const selectedFormIndex = requestedFormIndex === null || requestedFormIndex === undefined
      ? getSelectedFormIndex()
      : requestedFormIndex;
    try {
      const preview = await languageClient.designModel(source);
      if (!isCurrent(revision, source, 'designer')) return false;
      const ui = Array.isArray(preview?.ui) ? preview.ui : [];
      const materialization = createStudioFormMaterializationPlan(ui.length, selectedFormIndex);
      onDesignerModel(ui, { materialization });
      if (!ui.length) onDesignerEmpty();
      return true;
    } catch (error) {
      if (!isCurrent(revision, source, 'designer')) return false;
      onDesignerError(error);
      return false;
    }
  }

  function scheduleDesigner() {
    clearDesignerTimer();
    if (disposed) return;
    designerTimer = schedule(() => {
      designerTimer = null;
      void refreshDesigner();
    }, debounceMs);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    designerRevision += 1;
    changeContractRevision += 1;
    clearDesignerTimer();
    clearChangeContractTimer();
    if (disposeLanguageClient) languageClient.dispose?.();
  }

  return Object.freeze({
    version: PATCH_STUDIO_PREVIEW_CONTROLLER_VERSION,
    refreshDesigner,
    scheduleDesigner,
    refreshChangeContract,
    scheduleChangeContract,
    dispose
  });
}

export function installStudioPreviewController({
  code,
  changesView,
  designerCanvas,
  studioWindowRenderer,
  languageProjectOptions,
  formatChangeAnalysis,
  formatStudioStop,
  languageClient = createStudioLanguageClient(),
  getSelectedFormIndex = () => designerCanvas?.ownerDocument?.querySelector('#patchFormSelect')?.value
} = {}) {
  if (!code || !changesView || !designerCanvas || !studioWindowRenderer) {
    throw new Error('Studio preview controller requires code, changes, Designer canvas and renderer surfaces.');
  }

  const showDesignerMessage = (message, error = null) => {
    const doc = designerCanvas.ownerDocument;
    const paragraph = doc.createElement('p');
    paragraph.className = 'empty-preview';
    paragraph.append(message);
    if (error) {
      paragraph.append(doc.createElement('br'));
      paragraph.append(error?.message ?? String(error));
    }
    designerCanvas.replaceChildren(paragraph);
  };

  const lifecycle = createStudioPreviewLifecycle({
    languageClient,
    readSource: () => code.value,
    languageProjectOptions,
    formatChangeAnalysis,
    getSelectedFormIndex,
    onChangeContract(text) {
      changesView.textContent = text;
    },
    onChangeContractError(error) {
      changesView.textContent = `Change contract stopped:\n${formatStudioStop(error, 'compile')}`;
    },
    onDesignerModel(ui, { materialization }) {
      studioWindowRenderer.renderDesigner(designerCanvas, ui, { materialization });
    },
    onDesignerEmpty() {
      showDesignerMessage('This console project has no Form to design.');
    },
    onDesignerError(error) {
      showDesignerMessage('Designer is waiting for valid Patch code.', error);
    }
  });

  const handleActiveFormChange = event => {
    const requested = Number(event.detail?.windowIndex);
    void lifecycle.refreshDesigner(Number.isInteger(requested) ? requested : null);
  };
  designerCanvas.addEventListener('patch-designer-active-form-change', handleActiveFormChange);

  return Object.freeze({
    ...lifecycle,
    dispose() {
      designerCanvas.removeEventListener('patch-designer-active-form-change', handleActiveFormChange);
      lifecycle.dispose();
    }
  });
}
