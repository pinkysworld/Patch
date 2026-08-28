import { parse } from './parser.js';
import { analyzeChangeSemantics } from './change-analysis.js';
import { buildFormalBridge } from './formal-bridge.js';
import { buildFormalSource } from './formal-source.js';
import { buildFormalCalls } from './formal-calls.js';
import { validateFormalSourceExtraction } from './source-validation.js';
import { validateFormalGuardExtraction } from './guard-validation.js';
import { validateCallSites } from './call-site-validation.js';
import { attachWindowLayoutPolicies, buildWindowLayoutPolicyManifest } from './window-layout-policy.js';

export const PATCH_IR_VERSION = '0.10';

export function compile(source, options = {}) {
  const ast = parse(source);
  const project = {
    name: options.name ?? 'PatchApp',
    kind: options.kind ?? inferKind(ast),
    entry: options.entry ?? 'main.patch'
  };
  const changeAnalysis = analyzeChangeSemantics(ast);
  const formalBridge = buildFormalBridge(ast, changeAnalysis);
  const formalSource = buildFormalSource(ast);
  const formalCalls = buildFormalCalls(ast, changeAnalysis);
  const sourceValidation = validateFormalSourceExtraction(source, formalSource);
  const guardValidation = validateFormalGuardExtraction(source, formalSource);
  const callSiteValidation = validateCallSites(source, ast);
  formalCalls.callSiteValidation = callSiteValidation;
  const windowLayoutPolicy = buildWindowLayoutPolicyManifest(source, ast);

  const ir = {
    format: 'patch-ir',
    version: PATCH_IR_VERSION,
    project,
    instructions: lowerBlock(ast),
    capabilities: inferRuntimeCapabilities(ast),
    changeSignatures: changeAnalysis.signatures,
    changeCapabilities: changeAnalysis.capabilities,
    formalBridge,
    formalSource,
    formalCalls,
    sourceValidation,
    guardValidation,
    callSiteValidation
  };

  attachWindowLayoutPolicies(ast, windowLayoutPolicy);
  return {
    ast, ir, project, changeAnalysis, formalBridge, formalSource, formalCalls,
    sourceValidation, guardValidation, callSiteValidation, windowLayoutPolicy
  };
}

function inferKind(ast) {
  return ast.some(node => node.kind === 'window') ? 'window' : 'console';
}

function lowerBlock(nodes) { return nodes.map(lowerNode); }

function lowerNode(node) {
  switch (node.kind) {
    case 'create':
      return op('CREATE', node, { valueType: node.valueType, name: node.name, expr: node.expr });
    case 'createThing':
      return op('CREATE_THING', node, {
        name: node.name,
        fields: node.fields.map(field => ({ name: field.name, expr: field.expr, line: field.line }))
      });
    case 'window': {
      const fields = { titleExpr: node.titleExpr, body: lowerBlock(node.body) };
      if (node.id) fields.id = node.id;
      if (node.iconExpr) fields.iconExpr = node.iconExpr;
      return op('WINDOW', node, fields);
    }
    case 'tabs':
      return op('TABS', node, { id: node.id, body: lowerBlock(node.body ?? []) });
    case 'tabPage':
      return op('TAB_PAGE', node, { titleExpr: node.titleExpr, body: lowerBlock(node.body ?? []) });
    case 'menu':
      return op('MENU', node, { titleExpr: node.titleExpr, body: lowerBlock(node.body ?? []) });
    case 'menuItem':
      return op('MENU_ITEM', node, {
        id: node.id,
        textExpr: node.textExpr,
        enabledState: node.enabledState ?? null,
        checkedState: node.checkedState ?? null,
        shortcutExpr: node.shortcutExpr ?? null
      });
    case 'menuSeparator':
      return op('MENU_SEPARATOR', node);
    case 'dialog':
      return op('DIALOG', node, { titleExpr: node.titleExpr, messageExpr: node.messageExpr });
    case 'confirmDialog':
      return op('CONFIRM_DIALOG', node, { id: node.id, titleExpr: node.titleExpr, messageExpr: node.messageExpr });
    case 'openFileDialog':
      return op('OPEN_FILE_DIALOG', node, { id: node.id, titleExpr: node.titleExpr });
    case 'saveFileDialog':
      return op('SAVE_FILE_DIALOG', node, { id: node.id, titleExpr: node.titleExpr });
    case 'uiControl': {
      const fields = { control: node.control, id: node.id, textExpr: node.textExpr };
      if (Array.isArray(node.options)) fields.options = [...node.options];
      if (Array.isArray(node.columns)) fields.columns = [...node.columns];
      if (Array.isArray(node.rows)) fields.rows = node.rows.map(row => [...row]);
      if (Array.isArray(node.treeNodes)) fields.treeNodes = lowerTreeNodes(node.treeNodes);
      if (node.control === 'slider') {
        fields.min = node.min;
        fields.max = node.max;
        fields.step = node.step;
      }
      if (node.control === 'timer') fields.interval = node.interval;
      if (node.control === 'imagelist') {
        fields.logicalWidth = node.logicalWidth;
        fields.logicalHeight = node.logicalHeight;
        fields.items = (node.items ?? []).map(item => ({
          name: item.name,
          sourceExpr: item.sourceExpr,
          resourceId: item.resourceId,
          line: item.line ?? null
        }));
      }
      if (node.control === 'picture') {
        if (node.sourceExpr) fields.sourceExpr = node.sourceExpr;
        fields.fit = node.fit;
        fields.center = node.center;
        fields.opacity = node.opacity;
        if (node.description) fields.description = node.description;
      }
      if (node.control === 'button') {
        if (node.imageListId) fields.imageListId = node.imageListId;
        if (node.imageItem) fields.imageItem = node.imageItem;
      }
      if (node.control === 'panel') fields.body = lowerBlock(node.body ?? []);
      return op('UI_CONTROL', node, fields);
    }
    case 'event':
      return op('EVENT', node, { control: node.control, event: node.event, body: lowerBlock(node.body) });
    case 'drawPaint':
      return op('DRAW_PAINT', node, { command: { ...node.command } });
    case 'openForm': return op('OPEN_FORM', node, { form: node.form });
    case 'closeForm': return op('CLOSE_FORM', node, { form: node.form });
    case 'allow':
      return op('ALLOW_CHANGES', node, {
        name: node.name,
        rules: node.rules.map(rule => ({ target: rule.target, field: rule.field, operation: rule.operation, maxAmount: rule.maxAmount, line: rule.line }))
      });
    case 'show': return op('SHOW', node, { expr: node.expr });
    case 'why': return op('WHY', node, { expr: node.expr });
    case 'watch': return op('WATCH', node, { target: node.target });
    case 'history': return op('HISTORY', node, { target: node.target });
    case 'undo': return op('UNDO', node, { name: node.name });
    case 'redo': return op('REDO', node);
    case 'preview': return op('PREVIEW', node, { body: lowerBlock(node.body) });
    case 'change':
      return op('CHANGE', node, {
        target: node.target,
        name: node.name,
        operations: node.ops.map(change => ({ op: change.op, field: change.field, expr: change.expr ?? null, line: change.line }))
      });
    case 'if': return op('IF', node, { expr: node.expr, then: lowerBlock(node.thenBody), else: lowerBlock(node.elseBody) });
    case 'repeat': return op('REPEAT', node, { expr: node.expr, body: lowerBlock(node.body) });
    case 'function':
      return op('MAKE', node, { name: node.name, params: node.params, paramRanges: node.paramRanges ?? {}, body: lowerBlock(node.body) });
    case 'call': return op('DO', node, { name: node.name, args: node.args });
    case 'return': return op('RETURN', node, { expr: node.expr });
    case 'capRule': throw new Error('Capability rules only belong inside allow blocks.');
    default: throw new Error(`Compiler does not know AST node '${node.kind}'.`);
  }
}

function lowerTreeNodes(nodes) {
  return (nodes ?? []).map(node => ({
    labelExpr: node.labelExpr,
    line: node.line ?? null,
    children: lowerTreeNodes(node.children)
  }));
}

function op(code, node, fields = {}) { return { code, line: node.line ?? null, ...fields }; }

function inferRuntimeCapabilities(ast) {
  const caps = new Set(['state.change']);
  walk(ast, node => {
    if (node.kind === 'show') caps.add('console.output');
    if (['window', 'uiControl', 'tabs', 'tabPage', 'menu', 'menuItem', 'menuSeparator', 'dialog', 'confirmDialog', 'openFileDialog', 'saveFileDialog', 'event', 'openForm', 'closeForm'].includes(node.kind)) caps.add('ui.window');
    if (node.kind === 'tabs' || node.kind === 'tabPage') caps.add('ui.tabs');
    if (node.kind === 'menu' || node.kind === 'menuItem' || node.kind === 'menuSeparator') caps.add('ui.menu');
    if (node.kind === 'menuSeparator') caps.add('ui.menu-separator');
    if (node.kind === 'menuItem' && node.shortcutExpr) caps.add('ui.menu-shortcut');
    if (node.kind === 'menuItem' && node.enabledState) caps.add('ui.menu-enabled-state');
    if (node.kind === 'menuItem' && node.checkedState) caps.add('ui.menu-checked-state');
    if (node.kind === 'dialog') caps.add('ui.dialog');
    if (['confirmDialog', 'openFileDialog', 'saveFileDialog'].includes(node.kind)) caps.add('ui.dialog-result');
    if (node.kind === 'confirmDialog') caps.add('ui.confirm-dialog');
    if (node.kind === 'openFileDialog' || node.kind === 'saveFileDialog') caps.add('ui.file-dialog');
    if (node.kind === 'uiControl' && node.control === 'radio') caps.add('ui.radio');
    if (node.kind === 'uiControl' && node.control === 'table') caps.add('ui.table');
    if (node.kind === 'uiControl' && node.control === 'tree') caps.add('ui.tree');
    if (node.kind === 'uiControl' && node.control === 'slider') caps.add('ui.slider');
    if (node.kind === 'uiControl' && node.control === 'panel') caps.add('ui.panel');
    if (node.kind === 'uiControl' && node.control === 'timer') caps.add('ui.timer');
    if (node.kind === 'uiControl' && node.control === 'imagelist') caps.add('ui.imagelist');
    if (node.kind === 'window' && node.iconExpr) caps.add('ui.window-icon');
    if (node.kind === 'uiControl' && node.control === 'button' && node.imageListId && node.imageItem) caps.add('ui.button-image');
    if (node.kind === 'uiControl' && node.control === 'picture') caps.add('ui.picture');
    if (node.kind === 'uiControl' && node.control === 'shape') caps.add('ui.shape');
    if (node.kind === 'uiControl' && node.control === 'paintbox') caps.add('ui.paintbox');
    if (node.kind === 'drawPaint') caps.add('ui.paintbox-draw');
    if (node.kind === 'uiControl' && node.control === 'statusbar') caps.add('ui.statusbar');
    if (node.kind === 'openForm' || node.kind === 'closeForm') caps.add('ui.form-lifecycle');
    if (node.kind === 'watch' || node.kind === 'history' || node.kind === 'undo' || node.kind === 'redo' || node.kind === 'why') caps.add('change.history');
    if (node.kind === 'why') caps.add('change.provenance');
    if (node.kind === 'allow') caps.add('change.capabilities');
    if (node.kind === 'function' && Object.keys(node.paramRanges ?? {}).length) caps.add('change.range-analysis');
  });
  return [...caps].sort();
}

function walk(nodes, visit) {
  for (const node of nodes) {
    visit(node);
    if (node.body) walk(node.body, visit);
    if (node.thenBody) walk(node.thenBody, visit);
    if (node.elseBody) walk(node.elseBody, visit);
  }
}