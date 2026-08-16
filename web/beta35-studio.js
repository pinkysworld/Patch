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
}
