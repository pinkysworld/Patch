import { formControlDefaultSize, isNonvisualFormControl } from './form-layout.js';

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

export const PATCH_COMPONENT_REGISTRY_VERSION = '0.1';
export const PATCH_COMPONENTS = Object.freeze(COMPONENTS.map(([type, label, category, visual]) => {
  if (visual === isNonvisualFormControl(type)) {
    throw new Error(`Component visibility mismatch for '${type}'.`);
  }
  const size = formControlDefaultSize(type);
  return Object.freeze({
    type,
    label,
    category,
    visual,
    defaultSize: Object.freeze({ width: size.width, height: size.height })
  });
}));

const BY_TYPE = new Map(PATCH_COMPONENTS.map(component => [component.type, component]));

export function listPatchComponents(options = {}) {
  const category = options.category ? String(options.category) : null;
  if (!category) return [...PATCH_COMPONENTS];
  return PATCH_COMPONENTS.filter(component => component.category === category);
}

export function patchComponent(type) {
  return BY_TYPE.get(String(type ?? '')) ?? null;
}

export function patchComponentCategories() {
  return [...new Set(PATCH_COMPONENTS.map(component => component.category))];
}
