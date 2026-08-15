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
      return op('WINDOW', node, fields);
    }
    case 'tabs':
      return op('TABS', node, { id: node.id, body: lowerBlock(node.body ?? []) });
    case 'tabPage':
      return op('TAB_PAGE', node, { titleExpr: node.titleExpr, body: lowerBlock(node.body ?? []) });
    case 'menu':
      return op('MENU', node, { titleExpr: node.titleExpr, body: lowerBlock(node.body ?? []) });
    case 'menuItem':
      return op('MENU_ITEM', node, { id: node.id, textExpr: node.textExpr });
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
      return op('UI_CONTROL', node, fields);
    }
    case 'event':
      return op('EVENT', node, { control: node.control, event: node.event, body: lowerBlock(node.body) });
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

function op(code, node, fields = {}) { return { code, line: node.line ?? null, ...fields }; }

function inferRuntimeCapabilities(ast) {
  const caps = new Set(['state.change']);
  walk(ast, node => {
    if (node.kind === 'show') caps.add('console.output');
    if (['window', 'uiControl', 'tabs', 'tabPage', 'menu', 'menuItem', 'dialog', 'confirmDialog', 'openFileDialog', 'saveFileDialog', 'event', 'openForm', 'closeForm'].includes(node.kind)) caps.add('ui.window');
    if (node.kind === 'tabs' || node.kind === 'tabPage') caps.add('ui.tabs');
    if (node.kind === 'menu' || node.kind === 'menuItem') caps.add('ui.menu');
    if (node.kind === 'dialog') caps.add('ui.dialog');
    if (['confirmDialog', 'openFileDialog', 'saveFileDialog'].includes(node.kind)) caps.add('ui.dialog-result');
    if (node.kind === 'confirmDialog') caps.add('ui.confirm-dialog');
    if (node.kind === 'openFileDialog' || node.kind === 'saveFileDialog') caps.add('ui.file-dialog');
    if (node.kind === 'uiControl' && node.control === 'radio') caps.add('ui.radio');
    if (node.kind === 'uiControl' && node.control === 'table') caps.add('ui.table');
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
