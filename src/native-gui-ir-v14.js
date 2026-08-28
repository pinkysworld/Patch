import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js';
import { nativePictureDisplayUnsupportedMessage } from './picture-control.js';
import {
  buildNativeGuiIRV13,
  validateNativeGuiIRV13,
  flattenNativeGuiMenuItemsV13
} from './native-gui-ir-v13.js';

export const PATCH_NATIVE_GUI_IR_V14_VERSION = '1.4';
export const PATCH_NATIVE_CHROME_CONTROLS = Object.freeze(['panel', 'timer', 'picture', 'statusbar']);
const CHROME = new Set(PATCH_NATIVE_CHROME_CONTROLS);
const PANEL_FORBIDDEN = new Set(['panel', 'timer', 'statusbar', 'table', 'tree', 'tabs']);

/** Native GUI IR 1.4 adds source-backed Panel, Timer, PictureBox and StatusBar. */
export function buildNativeGuiIRV14(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.4 lowering.');
  }
  const compatibility = cloneCompiledWithPolicies(compiled);
  const chrome = rewriteChromeForV13Compatibility(compatibility.ast, compiled.ast);
  const ir = buildNativeGuiIRV13(compatibility);
  if (chrome.length) restoreChrome(ir, chrome);
  ir.version = PATCH_NATIVE_GUI_IR_V14_VERSION;
  return validateNativeGuiIRV14(ir);
}

export function validateNativeGuiIRV14(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V14_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.4 format/version is unsupported.');
  }
  const states = new Map((ir.states ?? []).map(state => [state.name, state]));
  const chromeIds = new Set();
  walkControls(ir, (control, insidePanel) => {
    if (!CHROME.has(control.type)) return;
    if (!control.id || chromeIds.has(control.id)) {
      throw new NativeGuiError(`Native GUI IR 1.4 ${displayChrome(control.type)} id '${control.id ?? ''}' is missing or duplicated.`);
    }
    chromeIds.add(control.id);
    if (control.selectionMode !== undefined || control.nodes !== undefined || control.pages !== undefined) {
      throw new NativeGuiError(`Native GUI IR 1.4 ${displayChrome(control.type)} '${control.id}' contains incompatible control metadata.`);
    }
    if (control.type === 'panel') {
      if (insidePanel) throw new NativeGuiError(`Native GUI IR 1.4 Panel '${control.id}' cannot nest another Panel.`);
      if (control.binding !== null) throw new NativeGuiError(`Native GUI IR 1.4 Panel '${control.id}' does not bind persistent state.`);
      if (!Array.isArray(control.controls)) throw new NativeGuiError(`Native GUI IR 1.4 Panel '${control.id}' needs a controls array.`);
      for (const child of control.controls) {
        if (!child?.type || PANEL_FORBIDDEN.has(child.type)) {
          throw new NativeGuiError(`Native GUI IR 1.4 Panel '${control.id}' cannot contain ${displayChrome(child?.type ?? 'unknown')}.`);
        }
      }
      return;
    }
    if (control.type === 'timer') {
      if (insidePanel) throw new NativeGuiError(`Native GUI IR 1.4 Timer '${control.id}' cannot nest inside a Panel.`);
      const interval = Number(control.interval);
      if (!Number.isInteger(interval) || interval < 1 || interval > 3600000) {
        throw new NativeGuiError(`Native GUI IR 1.4 Timer '${control.id}' needs an interval from 1 to 3600000 milliseconds.`);
      }
      if (control.binding !== null) throw new NativeGuiError(`Native GUI IR 1.4 Timer '${control.id}' does not bind persistent state.`);
      return;
    }
    if (control.type === 'picture') {
      if (typeof control.text !== 'string' || typeof (control.source ?? '') !== 'string') {
        throw new NativeGuiError(`Native GUI IR 1.4 PictureBox '${control.id}' needs text and source strings.`);
      }
      if (control.binding !== null) {
        const state = states.get(control.binding);
        if (!state || state.type !== 'text' || control.binding !== control.id) {
          throw new NativeGuiError(`Native GUI IR 1.4 PictureBox '${control.id}' may bind only to same-name text state.`);
        }
      }
      return;
    }
    if (insidePanel) throw new NativeGuiError(`Native GUI IR 1.4 StatusBar '${control.id}' cannot nest inside a Panel.`);
    if (typeof control.text !== 'string') {
      throw new NativeGuiError(`Native GUI IR 1.4 StatusBar '${control.id}' needs a text caption.`);
    }
    if (control.binding !== null) {
      const state = states.get(control.binding);
      if (!state || state.type !== 'text' || control.binding !== control.id) {
        throw new NativeGuiError(`Native GUI IR 1.4 StatusBar '${control.id}' may bind only to same-name text state.`);
      }
    }
  });

  for (const event of ir.events ?? []) {
    if (!chromeIds.has(event.control)) continue;
    const control = findControl(ir, event.control);
    if (control?.type === 'timer') {
      if (event.event !== 'ticked' || event.valueType !== null) {
        throw new NativeGuiError(`Native GUI IR 1.4 Timer '${event.control}' needs ticked events without an event value.`);
      }
      continue;
    }
    if (control?.type === 'picture') {
      if (event.event !== 'clicked' || event.valueType !== null) {
        throw new NativeGuiError(`Native GUI IR 1.4 PictureBox '${event.control}' needs clicked events without an event value.`);
      }
      continue;
    }
    throw new NativeGuiError(`Native GUI IR 1.4 ${displayChrome(control?.type ?? 'control')} '${event.control}' does not expose Patch events.`);
  }

  validateNativeGuiIRV13(toV13CompatibleV14(ir));
  return ir;
}

export function flattenNativeGuiControlsV14(ir) {
  validateNativeGuiIRV14(ir);
  return flattenControlsWithoutValidation(ir);
}

export function flattenNativeGuiMenuItemsV14(ir) {
  validateNativeGuiIRV14(ir);
  return flattenNativeGuiMenuItemsV13(toV13CompatibleV14(ir));
}

export function hasNativeChromeStage1(input) {
  let found = false;
  walkControls(input, control => {
    if (CHROME.has(control.type)) found = true;
  });
  return found;
}

/**
 * Private compatibility projection used only below the Native GUI 1.4 boundary.
 * Panel becomes a Text shadow with children hoisted beside it, Timer/PictureBox
 * become Button shadows, and StatusBar becomes a Text shadow so frozen IR 1.3
 * remains byte/semantic compatible. Backend 1.5 restores native GROUPBOX,
 * WM_TIMER/NSTimer/g_timeout_add, STATIC/NSImageView/GtkImage and STATUS widgets.
 */
export function toV13CompatibleV14(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.3';
  const timerIds = new Set();
  const rewrite = controls => {
    const out = [];
    for (const control of controls ?? []) {
      if (control.type === 'tabs') {
        out.push({ ...control, pages: control.pages.map(page => ({ ...page, controls: rewrite(page.controls) })) });
        continue;
      }
      if (control.type === 'panel') {
        out.push({
          type: 'text', id: control.id, text: '', binding: null, options: [],
          layout: cloneLayoutWithPolicy(control.layout)
        });
        out.push(...rewrite(control.controls));
        continue;
      }
      if (control.type === 'timer') {
        timerIds.add(control.id);
        out.push({
          type: 'button', id: control.id, text: '', binding: null, options: [],
          layout: cloneLayoutWithPolicy(control.layout)
        });
        continue;
      }
      if (control.type === 'picture') {
        out.push({
          type: 'button', id: control.id, text: control.text ?? '', binding: null, options: [],
          layout: cloneLayoutWithPolicy(control.layout)
        });
        continue;
      }
      if (control.type === 'statusbar') {
        out.push({
          type: 'text', id: control.id, text: control.text ?? '', binding: control.binding ?? null, options: [],
          layout: cloneLayoutWithPolicy(control.layout)
        });
        continue;
      }
      out.push(control);
    }
    return out;
  };
  for (const form of ir.forms ?? []) form.controls = rewrite(form.controls);
  for (const event of ir.events ?? []) {
    if (!timerIds.has(event.control)) continue;
    event.event = 'clicked';
    event.valueType = null;
  }
  return ir;
}

function rewriteChromeForV13Compatibility(ast, originalAst) {
  const chrome = [];
  const usedNames = collectUsedNames(originalAst);
  const textStates = new Map((originalAst ?? []).filter(node => node.kind === 'create' && node.valueType === 'text').map(node => [node.name, node]));
  const byId = new Map();
  let sequence = 0;

  const allocCompat = (prefix, id) => {
    let compatId = `__patch_native_chrome_${prefix}_${identifier(id)}_${++sequence}`;
    while (usedNames.has(compatId)) compatId += '_x';
    usedNames.add(compatId);
    return compatId;
  };

  const rewriteNodes = nodes => {
    const out = [];
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'panel') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.4 Panel needs a simple Patch name after 'as'.`);
        const children = rewriteNodes(node.body ?? []);
        const metadata = {
          kind: 'panel', id: node.id, compatId: allocCompat('panel', node.id),
          childCount: children.length, line: node.line
        };
        chrome.push(metadata);
        byId.set(metadata.id, metadata);
        node.control = 'text';
        node.id = metadata.compatId;
        node.textExpr = null;
        delete node.body;
        out.push(node, ...children);
        continue;
      }
      if (node.kind === 'uiControl' && node.control === 'timer') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.4 Timer needs a simple Patch name after 'as'.`);
        const interval = Number(node.interval);
        if (!Number.isInteger(interval) || interval < 1 || interval > 3600000) {
          throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.4 Timer needs an interval from 1 to 3600000 milliseconds.`);
        }
        const metadata = {
          kind: 'timer', id: node.id, compatId: allocCompat('timer', node.id),
          interval, line: node.line
        };
        chrome.push(metadata);
        byId.set(metadata.id, metadata);
        node.control = 'button';
        node.id = metadata.compatId;
        node.textExpr = null;
        delete node.interval;
        out.push(node);
        continue;
      }
      if (node.kind === 'uiControl' && node.control === 'picture') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.4 PictureBox needs a simple Patch name after 'as'.`);
        const unsupported = nativePictureDisplayUnsupportedMessage(node, node.line);
        if (unsupported) throw new NativeGuiError(unsupported);
        const text = optionalQuotedText(node.textExpr, node.line, 'PictureBox caption');
        const source = pictureSource(node, textStates);
        const metadata = {
          kind: 'picture', id: node.id, compatId: allocCompat('picture', node.id),
          text, source, binding: textStates.has(node.id) ? node.id : null, line: node.line
        };
        chrome.push(metadata);
        byId.set(metadata.id, metadata);
        node.control = 'button';
        node.id = metadata.compatId;
        node.textExpr = node.textExpr ?? null;
        delete node.sourceExpr;
        out.push(node);
        continue;
      }
      if (node.kind === 'uiControl' && node.control === 'statusbar') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.4 StatusBar needs a simple Patch name after 'as'.`);
        const text = requireQuotedText(node.textExpr ?? '"Ready"', node.line, 'StatusBar text');
        const metadata = {
          kind: 'statusbar', id: node.id, compatId: allocCompat('statusbar', node.id),
          text, binding: textStates.has(node.id) ? node.id : null, line: node.line
        };
        chrome.push(metadata);
        byId.set(metadata.id, metadata);
        node.control = 'text';
        node.id = metadata.compatId;
        out.push(node);
        continue;
      }
      if (node.body && node.kind !== 'menu') node.body = rewriteNodes(node.body);
      if (node.thenBody) node.thenBody = rewriteNodes(node.thenBody);
      if (node.elseBody) node.elseBody = rewriteNodes(node.elseBody);
      out.push(node);
    }
    return out;
  };

  const rewritten = rewriteNodes(ast);
  ast.length = 0;
  ast.push(...rewritten);
  if (!chrome.length) return chrome;

  for (const node of ast) {
    if (node.kind !== 'event') continue;
    const item = byId.get(node.control);
    if (!item) continue;
    node.control = item.compatId;
    if (item.kind === 'timer' && node.event === 'ticked') node.event = 'clicked';
  }
  return chrome;
}

function restoreChrome(ir, chrome) {
  const byCompatId = new Map(chrome.map(item => [item.compatId, item]));
  const restoreList = controls => {
    const out = [];
    let index = 0;
    while (index < (controls ?? []).length) {
      const control = controls[index];
      const item = byCompatId.get(control.id);
      if (item?.kind === 'panel') {
        const children = controls.slice(index + 1, index + 1 + item.childCount);
        if (children.length !== item.childCount) {
          throw new NativeGuiError(`Native GUI IR 1.4 Panel '${item.id}' lost nested controls in the compatibility projection.`);
        }
        control.type = 'panel';
        control.id = item.id;
        control.text = '';
        control.binding = null;
        control.options = [];
        control.controls = restoreList(children);
        out.push(control);
        index += 1 + item.childCount;
        continue;
      }
      if (item?.kind === 'timer') {
        control.type = 'timer';
        control.id = item.id;
        control.text = '';
        control.binding = null;
        control.options = [];
        control.interval = item.interval;
        out.push(control);
        index += 1;
        continue;
      }
      if (item?.kind === 'picture') {
        control.type = 'picture';
        control.id = item.id;
        control.text = item.text;
        control.source = item.source;
        control.binding = item.binding;
        control.options = [];
        out.push(control);
        index += 1;
        continue;
      }
      if (item?.kind === 'statusbar') {
        control.type = 'statusbar';
        control.id = item.id;
        control.text = item.text;
        control.binding = item.binding;
        control.options = [];
        out.push(control);
        index += 1;
        continue;
      }
      if (control.type === 'tabs') {
        for (const page of control.pages ?? []) page.controls = restoreList(page.controls);
      }
      out.push(control);
      index += 1;
    }
    return out;
  };

  for (const form of ir.forms ?? []) form.controls = restoreList(form.controls);

  for (const event of ir.events ?? []) {
    const item = byCompatId.get(event.control);
    if (!item) continue;
    event.control = item.id;
    if (item.kind === 'timer') {
      event.event = 'ticked';
      event.valueType = null;
    } else if (item.kind === 'picture') {
      event.event = 'clicked';
      event.valueType = null;
    }
  }
}

function pictureSource(node, textStates) {
  const expr = String(node.sourceExpr ?? '').trim();
  if (!expr) return '';
  const quoted = tryQuotedText(expr);
  if (quoted !== null) return quoted;
  if (expr === node.id && textStates.has(node.id)) return '';
  throw new NativeGuiError(
    `line ${node.line ?? '?'}: native GUI 1.4 PictureBox source must be quoted text or same-name text state.`
  );
}

function tryQuotedText(expr) {
  const text = String(expr ?? '').trim();
  if (!(text.startsWith('"') && text.endsWith('"'))) return null;
  try {
    const value = JSON.parse(text);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function optionalQuotedText(expr, line, label) {
  if (expr == null || String(expr).trim() === '') return '';
  return requireQuotedText(expr, line, label);
}

function requireQuotedText(expr, line, label) {
  const text = String(expr ?? '').trim();
  if (!(text.startsWith('"') && text.endsWith('"'))) {
    throw new NativeGuiError(`line ${line ?? '?'}: ${label} must currently be simple text in quotes for native GUI 1.4.`);
  }
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'string') throw new Error('not text');
    return value;
  } catch {
    throw new NativeGuiError(`line ${line ?? '?'}: ${label} is not valid quoted text.`);
  }
}

function findControl(ir, id) {
  let found = null;
  walkControls(ir, control => {
    if (control.id === id) found = control;
  });
  return found;
}

function collectUsedNames(ast) {
  const out = new Set();
  const walk = nodes => {
    for (const node of nodes ?? []) {
      if (node.name) out.add(node.name);
      if (node.id) out.add(node.id);
      if (node.body) walk(node.body);
      if (node.thenBody) walk(node.thenBody);
      if (node.elseBody) walk(node.elseBody);
    }
  };
  walk(ast);
  return out;
}

function walkControls(ir, visit) {
  const walk = (controls, insidePanel = false) => {
    for (const control of controls ?? []) {
      visit(control, insidePanel);
      if (control.type === 'tabs') for (const page of control.pages ?? []) walk(page.controls, insidePanel);
      if (control.type === 'panel') walk(control.controls, true);
    }
  };
  for (const form of ir.forms ?? []) walk(form.controls, false);
}

function flattenControlsWithoutValidation(ir) {
  const out = [];
  const emit = (control, formIndex, parentTabIndex, pageIndex, pageTitles, parentPanelIndex) => {
    const nativeIndex = out.length;
    out.push({
      ...control,
      formIndex,
      nativeIndex,
      parentTabIndex,
      pageIndex,
      pageTitles,
      parentPanelIndex
    });
    if (control.type === 'tabs') {
      for (let pageIndexCursor = 0; pageIndexCursor < (control.pages ?? []).length; pageIndexCursor += 1) {
        for (const child of control.pages[pageIndexCursor].controls ?? []) {
          emit(child, formIndex, nativeIndex, pageIndexCursor, [], parentPanelIndex);
        }
      }
    }
    if (control.type === 'panel') {
      for (const child of control.controls ?? []) {
        emit(child, formIndex, parentTabIndex, pageIndex, [], nativeIndex);
      }
    }
  };
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (const control of form.controls ?? []) {
      emit(control, formIndex, -1, -1, control.type === 'tabs' ? control.pages.map(page => page.title) : [], -1);
    }
  }
  return out;
}

function cloneCompiledWithPolicies(compiled) {
  const cloned = structuredClone(compiled);
  const originalNodes = [], clonedNodes = [];
  collectLayoutNodes(compiled.ast, originalNodes);
  collectLayoutNodes(cloned.ast, clonedNodes);
  for (let index = 0; index < Math.min(originalNodes.length, clonedNodes.length); index += 1) {
    const policy = originalNodes[index].layout?.policy;
    if (policy && clonedNodes[index].layout) defineLayoutPolicy(clonedNodes[index].layout, structuredClone(policy));
  }
  return cloned;
}

function collectLayoutNodes(nodes, out) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' || node.kind === 'tabs') out.push(node);
    if (node.body) collectLayoutNodes(node.body, out);
    if (node.thenBody) collectLayoutNodes(node.thenBody, out);
    if (node.elseBody) collectLayoutNodes(node.elseBody, out);
  }
}

function cloneNativeGuiIrWithPolicies(input) {
  const layouts = [];
  const collect = controls => {
    for (const control of controls ?? []) {
      layouts.push(control.layout?.policy ? structuredClone(control.layout.policy) : null);
      if (control.type === 'tabs') for (const page of control.pages ?? []) collect(page.controls);
      if (control.type === 'panel') collect(control.controls);
    }
  };
  for (const form of input.forms ?? []) collect(form.controls);
  const cloned = structuredClone(input);
  let cursor = 0;
  const restore = controls => {
    for (const control of controls ?? []) {
      const policy = layouts[cursor++];
      if (policy && control.layout) defineLayoutPolicy(control.layout, policy);
      if (control.type === 'tabs') for (const page of control.pages ?? []) restore(page.controls);
      if (control.type === 'panel') restore(control.controls);
    }
  };
  for (const form of cloned.forms ?? []) restore(form.controls);
  return cloned;
}

function cloneLayoutWithPolicy(layout) {
  if (!layout) return layout;
  const cloned = structuredClone(layout);
  if (layout.policy) defineLayoutPolicy(cloned, structuredClone(layout.policy));
  return cloned;
}

function defineLayoutPolicy(layout, policy) {
  Object.defineProperty(layout, 'policy', { value: policy, enumerable: false, configurable: true, writable: false });
}

function displayChrome(type) {
  if (type === 'picture') return 'PictureBox';
  if (type === 'statusbar') return 'StatusBar';
  if (!type) return 'control';
  return type[0].toUpperCase() + type.slice(1);
}

function identifier(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}
