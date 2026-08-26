import { formControlDefaultSize, isNonvisualFormControl } from './form-layout.js';

const EVENT_BY_TYPE = Object.freeze({
  button: Object.freeze([{ name: 'clicked', label: 'OnClick', value: false }]),
  picture: Object.freeze([{ name: 'clicked', label: 'OnClick', value: false }]),
  timer: Object.freeze([{ name: 'ticked', label: 'OnTick', value: false }]),
  input: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }]),
  checkbox: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }]),
  radio: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }]),
  combo: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }]),
  listbox: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }]),
  slider: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }]),
  table: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }]),
  tree: Object.freeze([{ name: 'changed', label: 'OnChange', value: true }])
});

const COMPONENTS = [
  ['text', 'Text', 'Basic', true],
  ['button', 'Button', 'Basic', true],
  ['input', 'Input', 'Basic', true],
  ['checkbox', 'Checkbox', 'Basic', true],
  ['radio', 'Radio group', 'Choices', true],
  ['combo', 'ComboBox', 'Choices', true],
  ['listbox', 'ListBox', 'Choices', true],
  ['slider', 'Slider', 'Choices', true],
  ['table', 'Table', 'Data', true],
  ['tree', 'TreeView', 'Data', true],
  ['tabs', 'Tabs', 'Containers', true],
  ['panel', 'Panel', 'Containers', true],
  ['picture', 'Picture', 'Graphics', true],
  ['statusbar', 'StatusBar', 'Chrome', true],
  ['timer', 'Timer', 'Nonvisual', false]
];

export const PATCH_COMPONENT_REGISTRY_VERSION = '0.2';
export const PATCH_COMPONENTS = Object.freeze(COMPONENTS.map(([type, label, category, visual]) => {
  if (visual === isNonvisualFormControl(type)) {
    throw new Error(`Component visibility mismatch for '${type}'.`);
  }
  const size = formControlDefaultSize(type);
  return Object.freeze({
    type,
    label,
    category,
    buttonId: `add${type[0].toUpperCase()}${type.slice(1)}`,
    visual,
    defaultSize: Object.freeze({ width: size.width, height: size.height }),
    events: Object.freeze((EVENT_BY_TYPE[type] ?? []).map(event => Object.freeze({ ...event })))
  });
}));

const BY_TYPE = new Map(PATCH_COMPONENTS.map(component => [component.type, component]));
const BY_BUTTON = new Map(PATCH_COMPONENTS.map(component => [component.buttonId, component]));

export function listPatchComponents(options = {}) {
  const category = options.category ? String(options.category) : null;
  if (!category) return [...PATCH_COMPONENTS];
  return PATCH_COMPONENTS.filter(component => component.category === category);
}

export function patchComponent(type) {
  return BY_TYPE.get(String(type ?? '')) ?? null;
}

export function patchComponentForButton(buttonId) {
  return BY_BUTTON.get(String(buttonId ?? '')) ?? null;
}

export function patchComponentCategories() {
  return [...new Set(PATCH_COMPONENTS.map(component => component.category))];
}
