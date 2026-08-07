import { parse } from './parser.js';

export const PATCH_IR_VERSION = '0.2';

export function compile(source, options = {}) {
  const ast = parse(source);
  const project = {
    name: options.name ?? 'PatchApp',
    kind: options.kind ?? inferKind(ast),
    entry: options.entry ?? 'main.patch'
  };

  const ir = {
    format: 'patch-ir',
    version: PATCH_IR_VERSION,
    project,
    instructions: lowerBlock(ast),
    capabilities: inferCapabilities(ast)
  };

  return { ast, ir, project };
}

function inferKind(ast) {
  // Window syntax is planned for the next parser increment. Until then all
  // current programs are console programs unless Studio explicitly selects a target.
  return ast.some(node => node.kind === 'window') ? 'window' : 'console';
}

function lowerBlock(nodes) {
  return nodes.map(lowerNode);
}

function lowerNode(node) {
  switch (node.kind) {
    case 'create':
      return op('CREATE', node, { valueType: node.valueType, name: node.name, expr: node.expr });
    case 'createThing':
      return op('CREATE_THING', node, {
        name: node.name,
        fields: node.fields.map(field => ({ name: field.name, expr: field.expr, line: field.line }))
      });
    case 'show':
      return op('SHOW', node, { expr: node.expr });
    case 'watch':
      return op('WATCH', node, { target: node.target });
    case 'history':
      return op('HISTORY', node, { target: node.target });
    case 'undo':
      return op('UNDO', node, { name: node.name });
    case 'redo':
      return op('REDO', node);
    case 'preview':
      return op('PREVIEW', node, { body: lowerBlock(node.body) });
    case 'change':
      return op('CHANGE', node, {
        target: node.target,
        name: node.name,
        operations: node.ops.map(change => ({
          op: change.op,
          field: change.field,
          expr: change.expr ?? null,
          line: change.line
        }))
      });
    case 'if':
      return op('IF', node, {
        expr: node.expr,
        then: lowerBlock(node.thenBody),
        else: lowerBlock(node.elseBody)
      });
    case 'repeat':
      return op('REPEAT', node, { expr: node.expr, body: lowerBlock(node.body) });
    case 'function':
      return op('MAKE', node, { name: node.name, params: node.params, body: lowerBlock(node.body) });
    case 'call':
      return op('DO', node, { name: node.name, args: node.args });
    case 'return':
      return op('RETURN', node, { expr: node.expr });
    default:
      throw new Error(`Compiler does not know AST node '${node.kind}'.`);
  }
}

function op(code, node, fields = {}) {
  return { code, line: node.line ?? null, ...fields };
}

function inferCapabilities(ast) {
  const caps = new Set(['state.change']);
  walk(ast, node => {
    if (node.kind === 'show') caps.add('console.output');
    if (node.kind === 'watch' || node.kind === 'history' || node.kind === 'undo' || node.kind === 'redo') caps.add('change.history');
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
