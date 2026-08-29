import { NativeGuiError, PATCH_NATIVE_GUI_IR_FORMAT } from './native-gui-frozen-lower.js?v=9ad29318e93c7c71';
import {
  buildNativeGuiIRV12,
  validateNativeGuiIRV12,
  flattenNativeGuiMenuItemsV12
} from './native-gui-ir-v12.js?v=9ad29318e93c7c71';

export const PATCH_NATIVE_GUI_IR_V13_VERSION = '1.3';

/** Native GUI IR 1.3 adds source-backed Slider range/step and numeric changed values. */
export function buildNativeGuiIRV13(compiled) {
  if (!compiled || !Array.isArray(compiled.ast)) {
    throw new NativeGuiError('A compiled Patch Window program is required for native GUI 1.3 lowering.');
  }
  rejectChromeStage1(compiled.ast);
  const compatibility = cloneCompiledWithPolicies(compiled);
  const sliders = rewriteSlidersForV12Compatibility(compatibility.ast, compiled.ast);
  const ir = buildNativeGuiIRV12(compatibility);
  if (sliders.length) restoreSliders(ir, sliders, compiled.ast);
  ir.version = PATCH_NATIVE_GUI_IR_V13_VERSION;
  return validateNativeGuiIRV13(ir);
}

export function validateNativeGuiIRV13(ir) {
  if (!ir || ir.format !== PATCH_NATIVE_GUI_IR_FORMAT || ir.version !== PATCH_NATIVE_GUI_IR_V13_VERSION) {
    throw new NativeGuiError('Native GUI IR 1.3 format/version is unsupported.');
  }
  const states = new Map((ir.states ?? []).map(state => [state.name, state]));
  const sliderIds = new Set();
  walkControls(ir, control => {
    if (control.type !== 'slider') return;
    if (!control.id || sliderIds.has(control.id)) {
      throw new NativeGuiError(`Native GUI IR 1.3 Slider id '${control.id ?? ''}' is missing or duplicated.`);
    }
    sliderIds.add(control.id);
    if (![control.min, control.max, control.step].every(Number.isFinite) || !(control.min < control.max) || !(control.step > 0)) {
      throw new NativeGuiError(`Native GUI IR 1.3 Slider '${control.id}' needs a finite increasing range and positive step.`);
    }
    if (control.binding !== null) {
      const state = states.get(control.binding);
      if (!state || state.type !== 'number' || control.binding !== control.id) {
        throw new NativeGuiError(`Native GUI IR 1.3 Slider '${control.id}' may bind only to same-name number state.`);
      }
    }
    if (control.selectionMode !== undefined || control.nodes !== undefined) {
      throw new NativeGuiError(`Native GUI IR 1.3 Slider '${control.id}' contains incompatible control metadata.`);
    }
  });

  for (const event of ir.events ?? []) {
    if (!sliderIds.has(event.control)) continue;
    if (event.event !== 'changed' || event.valueType !== 'number') {
      throw new NativeGuiError(`Native GUI IR 1.3 Slider '${event.control}' needs changed/number event semantics.`);
    }
    for (const action of event.actions ?? []) {
      if (action.kind !== 'change') continue;
      for (const op of action.ops ?? []) {
        if (op.value?.kind !== 'eventValue') continue;
        const target = states.get(action.target);
        if (action.stateType !== 'number' || target?.type !== 'number') {
          throw new NativeGuiError(`Native GUI IR 1.3 Slider '${event.control}' event value may mutate number state only.`);
        }
      }
    }
  }

  validateNativeGuiIRV12(toV12CompatibleV13(ir));
  return ir;
}

export function flattenNativeGuiControlsV13(ir) {
  validateNativeGuiIRV13(ir);
  return flattenControlsWithoutValidation(ir);
}

export function flattenNativeGuiMenuItemsV13(ir) {
  validateNativeGuiIRV13(ir);
  return flattenNativeGuiMenuItemsV12(toV12CompatibleV13(ir));
}

/**
 * Private compatibility projection used only below the Native GUI 1.3 boundary.
 * Slider becomes a text Input shadow so frozen IR 1.2 and older layers remain
 * byte/semantic compatible. Numeric event-value operations become harmless zero
 * literals here; backend 1.4 uses an adapter with collision-free sentinels and
 * restores the numeric event value before native source is compiled.
 */
export function toV12CompatibleV13(input) {
  const ir = cloneNativeGuiIrWithPolicies(input);
  ir.version = '1.2';
  const usedStates = new Set((ir.states ?? []).map(state => state.name));
  const sliderIds = new Set();
  let sliderIndex = 0;
  const rewrite = controls => (controls ?? []).map(control => {
    if (control.type === 'tabs') {
      return { ...control, pages: control.pages.map(page => ({ ...page, controls: rewrite(page.controls) })) };
    }
    if (control.type !== 'slider') return control;
    sliderIds.add(control.id);
    const shadowState = uniqueShadowState(usedStates, ++sliderIndex);
    const initial = control.binding && (ir.states ?? []).find(state => state.name === control.binding)?.type === 'number'
      ? String((ir.states ?? []).find(state => state.name === control.binding).initial)
      : String(control.min);
    ir.states.push({ name: shadowState, type: 'text', initial });
    return {
      type: 'input', id: control.id, text: '', binding: shadowState, options: [],
      layout: cloneLayoutWithPolicy(control.layout)
    };
  });
  for (const form of ir.forms ?? []) form.controls = rewrite(form.controls);
  for (const event of ir.events ?? []) {
    if (!sliderIds.has(event.control)) continue;
    event.valueType = 'text';
    for (const action of event.actions ?? []) {
      if (action.kind !== 'change') continue;
      for (const op of action.ops ?? []) {
        if (op.value?.kind === 'eventValue') op.value = { kind: 'literal', value: 0 };
      }
    }
  }
  return ir;
}

function rewriteSlidersForV12Compatibility(ast, originalAst) {
  const sliders = [];
  const usedNames = collectUsedNames(originalAst);
  const numberStates = new Map((originalAst ?? []).filter(node => node.kind === 'create' && node.valueType === 'number').map(node => [node.name, node]));
  const byId = new Map();
  let sequence = 0;
  const rewrite = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'slider') {
        if (!node.id) throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.3 Slider needs a simple Patch name after 'as'.`);
        let compatId = `__patch_native_slider_${identifier(node.id)}_${++sequence}`;
        while (usedNames.has(compatId)) compatId += '_x';
        usedNames.add(compatId);
        const metadata = {
          id: node.id,
          compatId,
          min: Number(node.min), max: Number(node.max), step: Number(node.step),
          binding: numberStates.has(node.id) ? node.id : null,
          line: node.line
        };
        if (![metadata.min, metadata.max, metadata.step].every(Number.isFinite) || !(metadata.min < metadata.max) || !(metadata.step > 0)) {
          throw new NativeGuiError(`line ${node.line ?? '?'}: native GUI 1.3 Slider needs a finite increasing range and positive step.`);
        }
        sliders.push(metadata);
        byId.set(metadata.id, metadata);
        node.control = 'input';
        node.id = compatId;
        delete node.min; delete node.max; delete node.step;
      }
      if (node.body) rewrite(node.body);
      if (node.thenBody) rewrite(node.thenBody);
      if (node.elseBody) rewrite(node.elseBody);
    }
  };
  rewrite(ast);
  if (!sliders.length) return sliders;

  const shadowCreates = sliders.map(slider => ({
    kind: 'create', name: slider.compatId, valueType: 'text',
    expr: JSON.stringify(String(slider.binding ? numberStates.get(slider.binding)?.expr ?? slider.min : slider.min)),
    line: slider.line
  }));
  ast.unshift(...shadowCreates);

  const rewriteEventBody = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'change') {
        for (const op of node.ops ?? []) if (String(op.expr ?? '').trim() === 'value') op.expr = '0';
      }
      if (node.body) rewriteEventBody(node.body);
      if (node.thenBody) rewriteEventBody(node.thenBody);
      if (node.elseBody) rewriteEventBody(node.elseBody);
    }
  };
  for (const node of ast) {
    if (node.kind !== 'event') continue;
    const slider = byId.get(node.control);
    if (!slider) continue;
    node.control = slider.compatId;
    rewriteEventBody(node.body);
  }
  return sliders;
}

function restoreSliders(ir, sliders, originalAst) {
  const byCompatId = new Map(sliders.map(slider => [slider.compatId, slider]));
  const byOriginalId = new Map(sliders.map(slider => [slider.id, slider]));
  walkControls(ir, control => {
    const slider = byCompatId.get(control.id);
    if (!slider) return;
    control.type = 'slider';
    control.id = slider.id;
    control.text = '';
    control.binding = slider.binding;
    control.options = [];
    control.min = slider.min;
    control.max = slider.max;
    control.step = slider.step;
  });
  ir.states = (ir.states ?? []).filter(state => !byCompatId.has(state.name));

  const originalEvents = new Map((originalAst ?? []).filter(node => node.kind === 'event').map(node => [`${node.control}\u0000${node.event}`, node]));
  for (const event of ir.events ?? []) {
    const slider = byCompatId.get(event.control);
    if (!slider) continue;
    event.control = slider.id;
    event.valueType = 'number';
    const original = originalEvents.get(`${slider.id}\u0000${event.event}`);
    if (!original) continue;
    restoreNumericEventValues(event.actions ?? [], original.body ?? []);
  }

  for (const event of ir.events ?? []) {
    if (!byOriginalId.has(event.control)) continue;
    if (event.event !== 'changed') throw new NativeGuiError(`Native GUI IR 1.3 Slider '${event.control}' exposes only 'changed'.`);
  }
}

function restoreNumericEventValues(actions, originalNodes) {
  let actionIndex = 0;
  for (const node of originalNodes ?? []) {
    const action = actions[actionIndex];
    if (!action) break;
    if (node.kind === 'change' && action.kind === 'change') {
      for (let opIndex = 0; opIndex < Math.min(node.ops?.length ?? 0, action.ops?.length ?? 0); opIndex += 1) {
        if (String(node.ops[opIndex].expr ?? '').trim() === 'value') action.ops[opIndex].value = { kind: 'eventValue' };
      }
    }
    actionIndex += 1;
  }
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
  const walk = controls => {
    for (const control of controls ?? []) {
      visit(control);
      if (control.type === 'tabs') for (const page of control.pages ?? []) walk(page.controls);
    }
  };
  for (const form of ir.forms ?? []) walk(form.controls);
}

function flattenControlsWithoutValidation(ir) {
  const out = [];
  for (let formIndex = 0; formIndex < (ir.forms ?? []).length; formIndex += 1) {
    const form = ir.forms[formIndex];
    for (const control of form.controls ?? []) {
      const nativeIndex = out.length;
      out.push({ ...control, formIndex, nativeIndex, parentTabIndex: -1, pageIndex: -1, pageTitles: control.type === 'tabs' ? control.pages.map(page => page.title) : [] });
      if (control.type !== 'tabs') continue;
      for (let pageIndex = 0; pageIndex < control.pages.length; pageIndex += 1) {
        for (const child of control.pages[pageIndex].controls ?? []) {
          out.push({ ...child, formIndex, nativeIndex: out.length, parentTabIndex: nativeIndex, pageIndex, pageTitles: [] });
        }
      }
    }
  }
  return out;
}

function cloneCompiledWithPolicies(compiled) {
  const cloned = structuredClone(compiled);
  const originalNodes = [], clonedNodes = [];
  collectLayoutNodes(compiled.ast, originalNodes); collectLayoutNodes(cloned.ast, clonedNodes);
  for (let index = 0; index < Math.min(originalNodes.length, clonedNodes.length); index += 1) {
    const policy = originalNodes[index].layout?.policy;
    if (policy && clonedNodes[index].layout) defineLayoutPolicy(clonedNodes[index].layout, structuredClone(policy));
  }
  return cloned;
}
function collectLayoutNodes(nodes, out) { for (const node of nodes ?? []) { if (node.kind === 'uiControl' || node.kind === 'tabs') out.push(node); if (node.body) collectLayoutNodes(node.body, out); if (node.thenBody) collectLayoutNodes(node.thenBody, out); if (node.elseBody) collectLayoutNodes(node.elseBody, out); } }
function rejectChromeStage1(nodes) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' && ['panel', 'timer', 'picture', 'statusbar'].includes(node.control)) {
      throw new NativeGuiError(
        `line ${node.line ?? '?'}: Native GUI IR 1.3 does not include ${displayChromeControl(node.control)}. ` +
        'Use Native GUI IR 1.4 / payload v14 / runtime v1.5 for Panel, Timer, PictureBox and StatusBar.'
      );
    }
    if (node.body) rejectChromeStage1(node.body);
    if (node.thenBody) rejectChromeStage1(node.thenBody);
    if (node.elseBody) rejectChromeStage1(node.elseBody);
  }
}
function displayChromeControl(type) {
  if (type === 'picture') return 'PictureBox';
  if (type === 'statusbar') return 'StatusBar';
  return type[0].toUpperCase() + type.slice(1);
}
function cloneNativeGuiIrWithPolicies(input) { const layouts=[]; const collect=controls=>{for(const control of controls??[]){layouts.push(control.layout?.policy?structuredClone(control.layout.policy):null);if(control.type==='tabs')for(const page of control.pages??[])collect(page.controls);}}; for(const form of input.forms??[])collect(form.controls); const cloned=structuredClone(input); let cursor=0; const restore=controls=>{for(const control of controls??[]){const policy=layouts[cursor++];if(policy&&control.layout)defineLayoutPolicy(control.layout,policy);if(control.type==='tabs')for(const page of control.pages??[])restore(page.controls);}};for(const form of cloned.forms??[])restore(form.controls);return cloned; }
function cloneLayoutWithPolicy(layout) { if (!layout) return layout; const cloned=structuredClone(layout); if(layout.policy)defineLayoutPolicy(cloned,structuredClone(layout.policy)); return cloned; }
function defineLayoutPolicy(layout, policy) { Object.defineProperty(layout,'policy',{value:policy,enumerable:false,configurable:true,writable:false}); }
function uniqueShadowState(used, seed) { let name=`__patch_native_slider_shadow_${seed}`; while(used.has(name))name+='_x'; used.add(name); return name; }
function identifier(value) { return String(value).replace(/[^A-Za-z0-9_]/g,'_').replace(/^[0-9]/,'_$&'); }
