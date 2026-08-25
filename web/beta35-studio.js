const sample = document.querySelector('#sample');
const code = document.querySelector('#code');
const projectKind = document.querySelector('#projectKind');

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

  sample.addEventListener('change', event => {
    if (sample.value !== 'listboxMultiWindow') return;

    // Playground owns the built-in sample map. Intercept only this beta.35 sample,
    // then use the same public DOM signals as normal Studio editing so canonical
    // project persistence, Designer refresh and native-build state stay aligned.
    event.stopImmediatePropagation();
    code.value = MULTISELECT_SAMPLE;
    projectKind.value = 'window';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    projectKind.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#tabDesigner')?.click();
  }, { capture: true });

  // A selected <option> does not emit change when the user selects the same item
  // again. That made the first visible "Workshop desk" entry misleading because
  // playground.js historically restored Counter unless the select value changed.
  // Keep sample loading explicit and repeatable without introducing a second
  // source model: this button simply asks the canonical Playground listener to
  // load the currently selected example.
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

  // On a genuinely fresh Studio session the first visible example and the
  // editor must agree. Preserve an existing local project, but otherwise load
  // Workshop Desk immediately so Run and Designer show its Forms on first use.
  let hasSavedProject = false;
  try { hasSavedProject = Boolean(localStorage.getItem('patchStudio.project')); } catch { /* storage can be unavailable */ }
  if (!hasSavedProject && sample.value === 'workshopDesk') queueMicrotask(loadSelectedSample);
}
