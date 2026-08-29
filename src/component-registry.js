import { formControlDefaultSize, isNonvisualFormControl } from './form-layout.js';

const EVENT_BY_TYPE = Object.freeze({
  button: Object.freeze([{ name: 'clicked', label: 'OnClick', value: false }]),
  picture: Object.freeze([{ name: 'clicked', label: 'OnClick', value: false }]),
  paintbox: Object.freeze([{ name: 'paint', label: 'OnPaint', value: false }]),
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

const COMMON_LAYOUT_PROPERTIES = Object.freeze([
  Object.freeze({ name: 'x', kind: 'integer' }),
  Object.freeze({ name: 'y', kind: 'integer' }),
  Object.freeze({ name: 'width', kind: 'integer' }),
  Object.freeze({ name: 'height', kind: 'integer' })
]);
const ID_PROPERTY = Object.freeze({ name: 'id', kind: 'name' });
const TEXT_PROPERTY = Object.freeze({ name: 'textExpr', kind: 'expression' });

const PROPERTY_BY_TYPE = Object.freeze({
  text: Object.freeze([TEXT_PROPERTY, ...COMMON_LAYOUT_PROPERTIES]),
  button: Object.freeze([
    ID_PROPERTY,
    TEXT_PROPERTY,
    Object.freeze({ name: 'imageListId', kind: 'name' }),
    Object.freeze({ name: 'imageItem', kind: 'name' }),
    ...COMMON_LAYOUT_PROPERTIES
  ]),
  input: Object.freeze([ID_PROPERTY, ...COMMON_LAYOUT_PROPERTIES]),
  checkbox: Object.freeze([ID_PROPERTY, TEXT_PROPERTY, ...COMMON_LAYOUT_PROPERTIES]),
  radio: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'options', kind: 'expression-list' }), ...COMMON_LAYOUT_PROPERTIES]),
  combo: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'options', kind: 'expression-list' }), ...COMMON_LAYOUT_PROPERTIES]),
  listbox: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'options', kind: 'expression-list' }), ...COMMON_LAYOUT_PROPERTIES]),
  slider: Object.freeze([
    ID_PROPERTY,
    Object.freeze({ name: 'min', kind: 'number' }),
    Object.freeze({ name: 'max', kind: 'number' }),
    Object.freeze({ name: 'step', kind: 'number' }),
    ...COMMON_LAYOUT_PROPERTIES
  ]),
  table: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'columns', kind: 'expression-list' }), Object.freeze({ name: 'rows', kind: 'table-rows' }), ...COMMON_LAYOUT_PROPERTIES]),
  tree: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'treeNodes', kind: 'tree' }), ...COMMON_LAYOUT_PROPERTIES]),
  tabs: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'pages', kind: 'tabs' }), ...COMMON_LAYOUT_PROPERTIES]),
  panel: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'children', kind: 'controls' }), ...COMMON_LAYOUT_PROPERTIES]),
  picture: Object.freeze([
    ID_PROPERTY,
    Object.freeze({ name: 'sourceExpr', kind: 'expression' }),
    Object.freeze({ name: 'fit', kind: 'enum', values: Object.freeze(['contain', 'cover', 'fill', 'none']) }),
    Object.freeze({ name: 'center', kind: 'boolean' }),
    Object.freeze({ name: 'opacity', kind: 'number' }),
    Object.freeze({ name: 'description', kind: 'text' }),
    ...COMMON_LAYOUT_PROPERTIES
  ]),
  shape: Object.freeze([
    ID_PROPERTY,
    Object.freeze({ name: 'shapeKind', kind: 'enum', values: Object.freeze(['rectangle', 'rounded', 'ellipse', 'line']) }),
    Object.freeze({ name: 'fill', kind: 'color' }),
    Object.freeze({ name: 'stroke', kind: 'color' }),
    Object.freeze({ name: 'strokeWidth', kind: 'number' }),
    Object.freeze({ name: 'cornerRadius', kind: 'number' }),
    Object.freeze({ name: 'opacity', kind: 'number' }),
    ...COMMON_LAYOUT_PROPERTIES
  ]),
  paintbox: Object.freeze([ID_PROPERTY, ...COMMON_LAYOUT_PROPERTIES]),
  statusbar: Object.freeze([ID_PROPERTY, TEXT_PROPERTY, ...COMMON_LAYOUT_PROPERTIES]),
  timer: Object.freeze([ID_PROPERTY, Object.freeze({ name: 'interval', kind: 'integer' })]),
  imagelist: Object.freeze([
    ID_PROPERTY,
    Object.freeze({ name: 'logicalWidth', kind: 'integer' }),
    Object.freeze({ name: 'logicalHeight', kind: 'integer' }),
    Object.freeze({ name: 'items', kind: 'imagelist-items' })
  ])
});

const DESKTOP_TARGETS = Object.freeze({
  studio: 'supported',
  web: 'supported',
  windows: 'supported',
  macos: 'supported',
  linux: 'supported',
  freebsd: 'unsupported'
});

const SHAPE_STAGE1_TARGETS = Object.freeze({ ...DESKTOP_TARGETS });
const PAINTBOX_STAGE1_TARGETS = Object.freeze({ ...DESKTOP_TARGETS });
const IMAGELIST_STAGE1_TARGETS = Object.freeze({
  studio: 'authoring',
  web: 'supported',
  windows: 'supported',
  macos: 'supported',
  linux: 'supported',
  freebsd: 'unsupported'
});

const TARGETS_BY_TYPE = Object.freeze({
  shape: SHAPE_STAGE1_TARGETS,
  paintbox: PAINTBOX_STAGE1_TARGETS,
  imagelist: IMAGELIST_STAGE1_TARGETS
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
  ['shape', 'Shape', 'Graphics', true],
  ['paintbox', 'PaintBox', 'Graphics', true],
  ['statusbar', 'StatusBar', 'Chrome', true],
  ['timer', 'Timer', 'Nonvisual', false],
  ['imagelist', 'ImageList', 'Nonvisual', false]
];

export const PATCH_COMPONENT_REGISTRY_VERSION = '0.8';
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
    properties: PROPERTY_BY_TYPE[type] ?? Object.freeze([]),
    events: Object.freeze((EVENT_BY_TYPE[type] ?? []).map(event => Object.freeze({ ...event }))),
    designRenderer: type,
    targetSupport: TARGETS_BY_TYPE[type] ?? DESKTOP_TARGETS
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
