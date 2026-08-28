import { parse } from './parser.js';
import { PATCH_FORM_CONTROL_DEFAULTS, formControlDefaultSize, isNonvisualFormControl } from './form-layout.js';
import { formatPatchImageListSource, normalizeImageListDefinition } from './imagelist-control.js';
import { applyPatchPictureProportional } from './picture-control.js';
import { formatPatchPictureDeclaration } from './picture-source.js';
import { formatPatchButtonDeclaration, parseButtonImageBinding } from './button-image.js';
import { formatPatchWindowDeclaration, normalizeWindowIconExpression } from './window-icon.js';

const DEFAULT_WINDOW = { width: 640, height: 420 };
const CONTROL_MARGIN = 24;
const CONTROL_GAP = 12;

export function addDesignerWindow(source, options = {}) {
  const lines = normalizeLines(source);
  if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
  const windows = listDesignerWindows(source);
  const titleExpr = String(options.titleExpr ?? JSON.stringify(`Form ${windows.length + 1}`)).trim();
  if (!titleExpr) throw new Error('Window title expression cannot be empty.');
  const width = windowDimension(options.width ?? DEFAULT_WINDOW.width, 'width');
  const height = windowDimension(options.height ?? DEFAULT_WINDOW.height, 'height');
  const id = Object.hasOwn(options, 'id') ? validateId(options.id) : nextFormId(lines);
  if (windows.some(item => item.id === id)) throw new Error(`Form name '${id}' is already used.`);
  lines.push(formatPatchWindowDeclaration({ titleExpr, id, width, height, iconExpr: options.iconExpr ?? options.icon ?? null }));
  return tidy(lines.join('\n'));
}

export function listDesignerWindows(source) {
  const ast = parse(source);
  const windows = [];
  let windowIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    windows.push({
      windowIndex,
      line: node.line,
      id: node.id ?? null,
      titleExpr: node.titleExpr,
      width: node.width ?? null,
      height: node.height ?? null,
      iconExpr: node.iconExpr ?? null
    });
    windowIndex += 1;
  }
  return windows;
}

export function updateDesignerWindow(source, selector, changes = {}) {
  const windows = listDesignerWindows(source);
  const window = findWindow(windows, selector);
  const lines = normalizeLines(source);
  const lineIndex = window.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) throw new Error('Designer window selection no longer matches Patch source.');
  const indent = indentOf(lines[lineIndex]);
  const titleExpr = Object.hasOwn(changes, 'titleExpr') ? String(changes.titleExpr ?? '').trim() : window.titleExpr;
  if (!titleExpr) throw new Error('Window title expression cannot be empty.');
  const width = windowDimension(Object.hasOwn(changes, 'width') ? changes.width : (window.width ?? DEFAULT_WINDOW.width), 'width');
  const height = windowDimension(Object.hasOwn(changes, 'height') ? changes.height : (window.height ?? DEFAULT_WINDOW.height), 'height');
  let id = window.id;
  if (Object.hasOwn(changes, 'id')) {
    id = validateId(changes.id);
    if (id !== window.id && windows.some(item => item.id === id)) throw new Error(`Form name '${id}' is already used.`);
  }
  let iconExpr = window.iconExpr;
  if (Object.hasOwn(changes, 'iconExpr') || Object.hasOwn(changes, 'icon')) {
    const raw = Object.hasOwn(changes, 'iconExpr') ? changes.iconExpr : changes.icon;
    iconExpr = String(raw ?? '').trim() ? normalizeWindowIconExpression(raw).sourceExpr : null;
  }
  lines[lineIndex] = `${indent}${formatPatchWindowDeclaration({ titleExpr, id, width, height, iconExpr })}`;
  if (window.id && id && window.id !== id) renameFormActions(lines, window.id, id);
  return preserveTrailingNewline(source, lines.join('\n'));
}

export function addDesignerControl(source, type, options = {}) {
  let normalized = String(source).replace(/\r\n/g, '\n');
  let windows = listDesignerWindows(normalized);
  if (!windows.length) {
    normalized = addDesignerWindow(normalized, { titleExpr: '"My App"' });
    windows = listDesignerWindows(normalized);
  }

  const requestedWindow = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  const targetWindow = windows.find(item => item.windowIndex === requestedWindow);
  if (!targetWindow) throw new Error(`Designer cannot find form ${requestedWindow + 1}.`);

  const lines = normalizeLines(normalized);
  const windowIndex = targetWindow.line - 1;
  const baseIndent = indentOf(lines[windowIndex]);
  const childIndent = `${baseIndent}  `;
  let insertAt = windowIndex + 1;
  let scan = insertAt;
  while (scan < lines.length) {
    const line = lines[scan];
    if (!line.trim()) { scan += 1; continue; }
    if (indentOf(line).length <= baseIndent.length) break;
    insertAt = scan + 1;
    scan += 1;
  }

  const existing = listDesignerControls(normalized).filter(item => item.windowIndex === requestedWindow);
  if (type === 'timer') {
    const control = makeControl(type, lines, null);
    lines.splice(insertAt, 0, `${childIndent}${control}`);
    return tidy(lines.join('\n'));
  }

  if (type === 'imagelist') {
    const id = nextId(lines, 'imagelist');
    const control = formatPatchImageListSource({ id, width: 16, height: 16, items: [] }, { indent: childIndent });
    lines.splice(insertAt, 0, ...control.split('\n'));
    return tidy(lines.join('\n'));
  }

  if (type === 'statusbar') {
    if (existing.some(item => item.type === 'statusbar')) {
      throw new Error('This Form already has a StatusBar. Edit the existing StatusBar instead of adding another one.');
    }
    const width = targetWindow.width ?? DEFAULT_WINDOW.width;
    const height = targetWindow.height ?? DEFAULT_WINDOW.height;
    const barHeight = PATCH_FORM_CONTROL_DEFAULTS.statusbar.height;
    const layout = { x: 0, y: Math.max(0, height - barHeight), width, height: barHeight };
    const id = nextId(lines, 'statusbar');
    lines.splice(insertAt, 0,
      `${childIndent}# @layout dock bottom`,
      `${childIndent}${formatControl('statusbar', id, '"Ready"', layout)}`
    );
    return tidy(lines.join('\n'));
  }

  const layout = nextControlLayout(existing, type);
  growWindowToFit(lines, targetWindow, layout);

  if (type === 'tabs') {
    const id = nextId(lines, 'tabs');
    lines.splice(insertAt, 0,
      `${childIndent}${formatControl('tabs', id, null, layout)}`,
      `${childIndent}  tab "General":`,
      `${childIndent}    text "General"`,
      `${childIndent}  tab "Advanced":`,
      `${childIndent}    text "Advanced"`
    );
    return tidy(lines.join('\n'));
  }

  if (type === 'panel') {
    const id = nextId(lines, 'panel');
    const buttonId = nextId(lines, 'button');
    lines.splice(insertAt, 0,
      `${childIndent}${formatControl('panel', id, null, layout)}`,
      `${childIndent}  text "Panel"`,
      `${childIndent}  button "Action" as ${buttonId}`
    );
    return tidy(lines.join('\n'));
  }

  if (type === 'table') {
    const id = nextId(lines, 'table');
    const columns = ['"Column 1"', '"Column 2"'];
    lines.splice(insertAt, 0,
      `${childIndent}${formatTableControl(id, columns, layout)}`,
      `${childIndent}  row "Value 1", "Value 2"`,
      `${childIndent}  row "Value 3", "Value 4"`
    );
    return tidy(lines.join('\n'));
  }

  if (type === 'tree') {
    const id = nextId(lines, 'tree');
    lines.splice(insertAt, 0,
      `${childIndent}${formatControl('tree', id, null, layout)}`,
      `${childIndent}  node "Root"`,
      `${childIndent}    node "Child 1"`,
      `${childIndent}    node "Child 2"`,
      `${childIndent}  node "Other"`
    );
    return tidy(lines.join('\n'));
  }

  const control = makeControl(type, lines, layout);
  lines.splice(insertAt, 0, `${childIndent}${control}`);
  return tidy(lines.join('\n'));
}

export function listDesignerControls(source) {
  const ast = parse(source);
  const controls = [];
  let windowIndex = 0;
  for (const node of ast) {
    if (node.kind !== 'window') continue;
    let controlIndex = 0;
    for (const child of node.body ?? []) {
      if (child.kind !== 'uiControl' && child.kind !== 'tabs') continue;
      const item = {
        windowIndex,
        controlIndex,
        line: child.line,
        type: child.kind === 'tabs' ? 'tabs' : child.control,
        id: child.id ?? null,
        textExpr: child.textExpr ?? null,
        options: Array.isArray(child.options) ? [...child.options] : null,
        pages: child.kind === 'tabs' ? (child.body ?? []).map(page => page.titleExpr) : null,
        x: child.layout?.x ?? null,
        y: child.layout?.y ?? null,
        width: child.layout?.width ?? null,
        height: child.layout?.height ?? null
      };
      if (child.kind === 'uiControl' && child.control === 'table') {
        item.columns = Array.isArray(child.columns) ? [...child.columns] : [];
        item.rows = Array.isArray(child.rows) ? child.rows.map(row => [...row]) : [];
      }
      if (child.kind === 'uiControl' && child.control === 'tree') {
        item.treeNodes = cloneTreeNodes(child.treeNodes);
      }
      if (child.kind === 'uiControl' && child.control === 'slider') {
        item.min = child.min;
        item.max = child.max;
        item.step = child.step;
      }
      if (child.kind === 'uiControl' && child.control === 'timer') {
        item.interval = child.interval;
      }
      if (child.kind === 'uiControl' && child.control === 'imagelist') {
        item.logicalWidth = child.logicalWidth;
        item.logicalHeight = child.logicalHeight;
        item.items = (child.items ?? []).map(image => ({
          name: image.name,
          sourceExpr: image.sourceExpr,
          resourceId: image.resourceId
        }));
      }
      if (child.kind === 'uiControl' && child.control === 'picture') {
        item.sourceExpr = child.sourceExpr ?? null;
        item.fit = child.fit;
        item.center = child.center;
        item.opacity = child.opacity;
        item.description = child.description ?? '';
        item.proportional = child.proportional;
        item.legacyCaption = child.legacyCaption === true;
      }
      if (child.kind === 'uiControl' && child.control === 'button' && (child.imageListId || child.imageItem)) {
        item.imageListId = child.imageListId ?? null;
        item.imageItem = child.imageItem ?? null;
      }
      if (child.kind === 'uiControl' && child.control === 'panel') {
        item.childCount = (child.body ?? []).length;
        item.childIds = (child.body ?? []).map(nested => nested.id).filter(Boolean);
        item.childTypes = (child.body ?? []).map(nested => nested.control);
      }
      controls.push(item);
      controlIndex += 1;
    }
    windowIndex += 1;
  }
  return controls;
}

export function updateDesignerControl(source, selector, changes = {}) {
  const controls = listDesignerControls(source);
  const control = findControl(controls, selector);
  const lines = normalizeLines(source);
  const lineIndex = control.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) throw new Error('Designer selection no longer matches Patch source.');

  const oldId = control.id;
  let nextId = oldId;
  if (control.type !== 'text' && Object.hasOwn(changes, 'id')) {
    nextId = validateId(changes.id);
    if (nextId !== oldId && controls.some(item => item.id === nextId)) {
      throw new Error(`Control id '${nextId}' is already used in this Patch window project.`);
    }
  }

  if (control.type === 'imagelist') {
    const definition = normalizeImageListDefinition({
      id: nextId,
      width: Object.hasOwn(changes, 'logicalWidth') ? changes.logicalWidth : control.logicalWidth,
      height: Object.hasOwn(changes, 'logicalHeight') ? changes.logicalHeight : control.logicalHeight,
      items: Object.hasOwn(changes, 'items') ? changes.items : (control.items ?? [])
    });
    const indent = indentOf(lines[lineIndex]);
    const baseIndent = indent.length;
    let end = lineIndex + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    const replacement = formatPatchImageListSource(definition, { indent }).split('\n');
    lines.splice(lineIndex, end - lineIndex, ...replacement);
    return preserveTrailingNewline(source, lines.join('\n'));
  }

  let nextTextExpr = control.textExpr;
  if (['text', 'button', 'checkbox', 'statusbar'].includes(control.type) && Object.hasOwn(changes, 'textExpr')) {
    nextTextExpr = String(changes.textExpr ?? '').trim();
    if (!nextTextExpr) throw new Error('Text expression cannot be empty.');
  }

  let nextOptions = control.options;
  if (['combo', 'listbox', 'radio'].includes(control.type) && Object.hasOwn(changes, 'options')) {
    const label = control.type === 'radio' ? 'radio group' : control.type;
    if (!Array.isArray(changes.options) || changes.options.length < 2) throw new Error(`A ${label} needs at least two options.`);
    nextOptions = changes.options.map(option => String(option ?? '').trim()).filter(Boolean);
    if (nextOptions.length < 2) throw new Error(`A ${label} needs at least two options.`);
  }

  let slider = null;
  if (control.type === 'slider') {
    const min = sliderNumber(Object.hasOwn(changes, 'min') ? changes.min : control.min, 'minimum');
    const max = sliderNumber(Object.hasOwn(changes, 'max') ? changes.max : control.max, 'maximum');
    const step = sliderNumber(Object.hasOwn(changes, 'step') ? changes.step : control.step, 'step');
    if (!(min < max)) throw new Error('Slider minimum must be smaller than its maximum.');
    if (!(step > 0)) throw new Error('Slider step must be greater than zero.');
    slider = { min, max, step };
  }

  let timerInterval = null;
  if (control.type === 'timer') {
    timerInterval = timerIntervalNumber(Object.hasOwn(changes, 'interval') ? changes.interval : control.interval);
  }

  if (control.type === 'picture') {
    const layout = normalizeControlLayout(control, changes);
    const indent = indentOf(lines[lineIndex]);
    lines[lineIndex] = `${indent}${formatPictureControl(control, nextId, changes, layout)}`;
    if (oldId && nextId !== oldId) renameEventHeaders(lines, oldId, nextId);
    return preserveTrailingNewline(source, lines.join('\n'));
  }

  if (control.type === 'button') {
    const layout = normalizeControlLayout(control, changes);
    const indent = indentOf(lines[lineIndex]);
    lines[lineIndex] = `${indent}${formatButtonControl(control, nextId, nextTextExpr, changes, layout)}`;
    if (oldId && nextId !== oldId) renameEventHeaders(lines, oldId, nextId);
    return preserveTrailingNewline(source, lines.join('\n'));
  }

  const layout = normalizeControlLayout(control, changes);
  const indent = indentOf(lines[lineIndex]);
  if (control.type === 'table') {
    lines[lineIndex] = `${indent}${formatTableControl(nextId, control.columns ?? [], layout)}`;
  } else {
    lines[lineIndex] = `${indent}${formatControl(control.type, nextId, nextTextExpr, layout, nextOptions, slider, timerInterval)}`;
  }

  if (oldId && nextId !== oldId && !['tabs', 'panel'].includes(control.type)) renameEventHeaders(lines, oldId, nextId);
  return preserveTrailingNewline(source, lines.join('\n'));
}

export function removeDesignerControl(source, selector) {
  const controls = listDesignerControls(source);
  const control = findControl(controls, selector);
  const lines = normalizeLines(source);
  const lineIndex = control.line - 1;
  const directiveIndex = layoutDirectiveBefore(lines, lineIndex);
  if (control.type === 'tabs' || control.type === 'panel' || control.type === 'table' || control.type === 'tree' || control.type === 'imagelist') {
    const baseIndent = indentOf(lines[lineIndex]).length;
    let end = lineIndex + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    const start = directiveIndex >= 0 ? directiveIndex : lineIndex;
    lines.splice(start, end - start);
    if (control.id) removeEventBlocks(lines, control.id);
    if (control.type === 'panel') {
      for (const childId of control.childIds ?? []) removeEventBlocks(lines, childId);
    }
  } else {
    const start = directiveIndex >= 0 ? directiveIndex : lineIndex;
    lines.splice(start, lineIndex - start + 1);
    if (control.id) removeEventBlocks(lines, control.id);
  }
  return tidy(lines.join('\n'));
}

export function renameDesignerButton(source, id, newText) {
  const control = listDesignerControls(source).find(item => item.type === 'button' && item.id === id);
  if (!control) throw new Error(`Cannot find button '${id}' in Patch source.`);
  return updateDesignerControl(source, control, { textExpr: JSON.stringify(String(newText)) });
}

function findWindow(windows, selector) {
  const windowIndex = Number.isInteger(selector) ? selector : selector?.windowIndex;
  if (!Number.isInteger(windowIndex)) throw new Error('Designer window selection is invalid.');
  const window = windows.find(item => item.windowIndex === windowIndex);
  if (!window) throw new Error('Designer window selection no longer exists in Patch source.');
  return window;
}

function findControl(controls, selector) {
  if (!selector || !Number.isInteger(selector.windowIndex) || !Number.isInteger(selector.controlIndex)) {
    throw new Error('Designer selection is invalid.');
  }
  const control = controls.find(item => item.windowIndex === selector.windowIndex && item.controlIndex === selector.controlIndex);
  if (!control) throw new Error('Designer window selection no longer exists in Patch source.');
  return control;
}

function validateId(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z_]\w*$/.test(id)) throw new Error(`'${id || '?'}' is not a valid Patch name.`);
  return id;
}

function normalizeControlLayout(control, changes) {
  const defaults = formControlDefaultSize(control.type);
  const touched = ['x','y','width','height'].some(key => Object.hasOwn(changes, key));
  const existing = control.x !== null || control.y !== null || control.width !== null || control.height !== null;
  if (!touched && !existing) return null;
  return {
    x: coordinate(Object.hasOwn(changes, 'x') ? changes.x : (control.x ?? CONTROL_MARGIN), 'x'),
    y: coordinate(Object.hasOwn(changes, 'y') ? changes.y : (control.y ?? CONTROL_MARGIN), 'y'),
    width: controlDimension(Object.hasOwn(changes, 'width') ? changes.width : (control.width ?? defaults.width), 'width'),
    height: controlDimension(Object.hasOwn(changes, 'height') ? changes.height : (control.height ?? defaults.height), 'height')
  };
}

function nextControlLayout(existing, type) {
  const defaults = PATCH_FORM_CONTROL_DEFAULTS[type];
  if (!defaults) throw new Error(`Designer cannot add '${type}' yet.`);
  let y = CONTROL_MARGIN;
  let visualIndex = 0;
  for (const control of existing) {
    if (isNonvisualFormControl(control.type)) continue;
    const currentDefaults = formControlDefaultSize(control.type);
    const currentY = control.y ?? (CONTROL_MARGIN + visualIndex * 48);
    const currentHeight = control.height ?? currentDefaults.height;
    y = Math.max(y, currentY + currentHeight + CONTROL_GAP);
    visualIndex += 1;
  }
  return { x: CONTROL_MARGIN, y, width: defaults.width, height: defaults.height };
}

function growWindowToFit(lines, window, layout) {
  const currentHeight = window.height ?? DEFAULT_WINDOW.height;
  const requiredHeight = layout.y + layout.height + CONTROL_MARGIN;
  if (requiredHeight <= currentHeight) return;
  const lineIndex = window.line - 1;
  if (lineIndex < 0 || lineIndex >= lines.length) throw new Error('Designer window selection no longer matches Patch source.');
  const indent = indentOf(lines[lineIndex]);
  const width = window.width ?? DEFAULT_WINDOW.width;
  lines[lineIndex] = `${indent}${formatPatchWindowDeclaration({
    titleExpr: window.titleExpr,
    id: window.id,
    width,
    height: requiredHeight,
    iconExpr: window.iconExpr
  })}`;
}

function coordinate(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`Control ${name} must be a whole number zero or greater.`);
  return number;
}

function controlDimension(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 16) throw new Error(`Control ${name} must be a whole number of at least 16.`);
  return number;
}

function sliderNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Slider ${name} must be a finite number.`);
  return number;
}

function timerIntervalNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 3600000) {
    throw new Error('Timer interval must be a whole number from 1 to 3600000 milliseconds.');
  }
  return number;
}

function windowDimension(value, name) {
  const number = Number(value);
  const minimum = name === 'width' ? 120 : 80;
  if (!Number.isInteger(number) || number < minimum) throw new Error(`Window ${name} must be a whole number of at least ${minimum}.`);
  return number;
}

function renameEventHeaders(lines, oldId, nextId) {
  const escapedId = escapeRegExp(oldId);
  const pattern = new RegExp(`^(\\s*)when\\s+${escapedId}\\s+(clicked|changed|closed|ticked|paint)\\s*:\\s*$`);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (match) lines[i] = `${match[1]}when ${nextId} ${match[2]}:`;
  }
}

function renameFormActions(lines, oldId, nextId) {
  const escapedId = escapeRegExp(oldId);
  const pattern = new RegExp(`^(\\s*)(open|close)\\s+${escapedId}\\s*$`);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (match) lines[i] = `${match[1]}${match[2]} ${nextId}`;
  }
}

function removeEventBlocks(lines, id) {
  const escapedId = escapeRegExp(id);
  const pattern = new RegExp(`^(\\s*)when\\s+${escapedId}\\s+(clicked|changed|closed|ticked|paint)\\s*:\\s*$`);
  for (let i = 0; i < lines.length;) {
    const match = lines[i].match(pattern);
    if (!match) { i += 1; continue; }
    const baseIndent = match[1].length;
    let end = i + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) { end += 1; continue; }
      if (indentOf(lines[end]).length <= baseIndent) break;
      end += 1;
    }
    lines.splice(i, end - i);
  }
}

function layoutDirectiveBefore(lines, lineIndex) {
  if (lineIndex < 1) return -1;
  return /^\s*#\s*@layout\b/i.test(lines[lineIndex - 1]) ? lineIndex - 1 : -1;
}

function makeControl(type, lines, layout) {
  if (!PATCH_FORM_CONTROL_DEFAULTS[type]) throw new Error(`Designer cannot add '${type}' yet.`);
  if (type === 'text') return formatControl(type, null, '"Text"', layout);
  if (type === 'button') return formatControl(type, nextId(lines, 'button'), '"Button"', layout);
  if (type === 'input') return formatControl(type, nextId(lines, 'input'), null, layout);
  if (type === 'checkbox') return formatControl(type, nextId(lines, 'checkbox'), '"Checkbox"', layout);
  if (type === 'radio') return formatControl(type, nextId(lines, 'radio'), null, layout, ['"Option 1"', '"Option 2"', '"Option 3"']);
  if (type === 'combo') return formatControl(type, nextId(lines, 'combo'), null, layout, ['"Option 1"', '"Option 2"', '"Option 3"']);
  if (type === 'listbox') return formatControl(type, nextId(lines, 'listbox'), null, layout, ['"Option 1"', '"Option 2"', '"Option 3"']);
  if (type === 'slider') return formatControl(type, nextId(lines, 'slider'), null, layout, null, { min: 0, max: 100, step: 1 });
  if (type === 'timer') return formatControl(type, nextId(lines, 'timer'), null, layout, null, null, 1000);
  if (type === 'picture') return formatControl(type, nextId(lines, 'picture'), null, layout);
  if (type === 'statusbar') return formatControl(type, nextId(lines, 'statusbar'), '"Ready"', layout);
  if (type === 'panel') return formatControl(type, nextId(lines, 'panel'), null, layout);
  throw new Error(`Designer cannot add '${type}' yet.`);
}

function formatControl(type, id, textExpr, layout, options = null, slider = null, timerInterval = null) {
  let core;
  if (type === 'text') core = `text ${textExpr}`;
  else if (type === 'button') core = formatPatchButtonDeclaration({ id, textExpr });
  else if (type === 'input') core = `input ${id}`;
  else if (type === 'checkbox') core = `checkbox ${textExpr} as ${id}`;
  else if (type === 'radio') core = `radio ${(options ?? []).join(', ')} as ${id}`;
  else if (type === 'combo') core = `combo ${(options ?? []).join(', ')} as ${id}`;
  else if (type === 'listbox') core = `listbox ${(options ?? []).join(', ')} as ${id}`;
  else if (type === 'slider') core = `slider ${formatNumber(slider?.min ?? 0)}..${formatNumber(slider?.max ?? 100)} as ${id} step ${formatNumber(slider?.step ?? 1)}`;
  else if (type === 'timer') core = `timer as ${id} interval ${timerIntervalNumber(timerInterval ?? 1000)}`;
  else if (type === 'picture') core = formatPatchPictureDeclaration({ id });
  else if (type === 'statusbar') core = `statusbar ${textExpr ?? '"Ready"'} as ${id}`;
  else if (type === 'panel') core = `panel as ${id}`;
  else if (type === 'tabs') core = `tabs as ${id}`;
  else if (type === 'tree') core = `tree as ${id}`;
  else throw new Error(`Designer cannot edit '${type}' controls yet.`);
  const block = type === 'tabs' || type === 'panel' || type === 'tree';
  if (!layout) return block ? `${core}:` : core;
  const positioned = `${core} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}`;
  return block ? `${positioned}:` : positioned;
}

function formatTableControl(id, columns, layout) {
  const core = `table ${(columns ?? []).join(', ')} as ${id}`;
  if (!layout) return `${core}:`;
  return `${core} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}:`;
}

function formatButtonControl(control, id, textExpr, changes, layout) {
  let imageListId = Object.hasOwn(changes, 'imageListId') ? changes.imageListId : control.imageListId;
  let imageItem = Object.hasOwn(changes, 'imageItem') ? changes.imageItem : control.imageItem;
  if (Object.hasOwn(changes, 'image')) {
    const binding = parseButtonImageBinding(changes.image);
    imageListId = binding?.imageListId ?? null;
    imageItem = binding?.imageItem ?? null;
  }
  const core = formatPatchButtonDeclaration({ id, textExpr, imageListId, imageItem });
  if (!layout) return core;
  return `${core} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}`;
}

function formatPictureControl(control, id, changes, layout) {
  const next = {
    id,
    sourceExpr: Object.hasOwn(changes, 'sourceExpr') ? changes.sourceExpr : control.sourceExpr,
    fit: Object.hasOwn(changes, 'fit') ? changes.fit : control.fit,
    center: Object.hasOwn(changes, 'center') ? changes.center : control.center,
    opacity: Object.hasOwn(changes, 'opacity') ? changes.opacity : control.opacity,
    description: Object.hasOwn(changes, 'description') ? changes.description : control.description,
    textExpr: control.textExpr,
    legacyCaption: control.legacyCaption === true
  };
  if (Object.hasOwn(changes, 'sourceExpr') && String(changes.sourceExpr ?? '').trim()) {
    next.legacyCaption = false;
  }
  if (Object.hasOwn(changes, 'proportional')) {
    next.fit = applyPatchPictureProportional(next.fit, changes.proportional);
    next.legacyCaption = false;
  }
  if (['fit', 'center', 'opacity', 'description'].some(key => Object.hasOwn(changes, key))) {
    next.legacyCaption = false;
  }
  const core = formatPatchPictureDeclaration(next);
  if (!layout) return core;
  return `${core} at ${layout.x}, ${layout.y} size ${layout.width}, ${layout.height}`;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(number);
}

function cloneTreeNodes(nodes = []) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    children: cloneTreeNodes(node.children)
  }));
}

function nextId(lines, base) {
  const text = lines.join('\n');
  let i = 1;
  while (new RegExp(`\\b${base}_${i}\\b`).test(text)) i++;
  return `${base}_${i}`;
}

function nextFormId(lines) {
  const text = lines.join('\n');
  let i = 1;
  while (new RegExp(`\\bas\\s+form_${i}\\b`).test(text)) i++;
  return `form_${i}`;
}

function normalizeLines(source) {
  return String(source).replace(/\r\n/g, '\n').split('\n');
}

function indentOf(line) {
  return line.match(/^\s*/)?.[0] ?? '';
}

function preserveTrailingNewline(original, text) {
  const hasNewline = /(?:\r?\n)$/.test(String(original));
  return text.replace(/\s+$/, '') + (hasNewline ? '\n' : '');
}

function tidy(text) {
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
