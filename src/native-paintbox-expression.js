import { evaluateExpression, evaluateLoose, ExpressionError } from './expression.js';

export const PATCH_NATIVE_PAINTBOX_EXPRESSION_VERSION = '0.1';
export const PATCH_NATIVE_PAINTBOX_EXPRESSION_STATE_TYPES = Object.freeze(['number', 'text', 'boolean']);
const SUPPORTED_STATE_TYPES = new Set(PATCH_NATIVE_PAINTBOX_EXPRESSION_STATE_TYPES);
const KEYWORDS = new Set(['true', 'false', 'and', 'or', 'not']);
const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|\+|-|\*|\/|%|<|>|\(|\)|\[|\]|,|\.))/gy;

export class NativePaintBoxExpressionError extends Error {}

/**
 * Native PaintBox runtime v1.7 deliberately starts with the scalar expression
 * subset already owned by the native GUI state model. Lists, Thing paths and
 * list literals fail closed rather than gaining a second cross-platform model.
 * `count` is available only while executing the body of a Patch repeat.
 */
export function validateNativePaintExpression(source, states, options = {}) {
  const expression = String(source ?? '').trim();
  if (!expression) throw new NativePaintBoxExpressionError('PaintBox native expression cannot be empty.');
  const stateByName = normalizeScalarStates(states);
  const allowCount = options.allowCount === true;
  const loose = options.loose === true;

  if (loose && isLooseLiteral(expression) && !stateByName.has(expression) && expression !== 'count') {
    return Object.freeze({ expression, references: Object.freeze([]), looseLiteral: true, usesCount: false });
  }

  const tokens = tokenize(expression);
  const references = new Set();
  let usesCount = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === '[' || token.type === ']' || token.type === ',') {
      throw new NativePaintBoxExpressionError('Native PaintBox expressions do not support list literals yet.');
    }
    if (token.type === '.') {
      throw new NativePaintBoxExpressionError('Native PaintBox expressions do not support Thing or property paths yet.');
    }
    if (token.type !== 'word' || KEYWORDS.has(token.value)) continue;
    if (token.value === 'count') {
      if (!allowCount) throw new NativePaintBoxExpressionError("PaintBox local 'count' is available only inside a repeat body.");
      usesCount = true;
      continue;
    }
    const state = stateByName.get(token.value);
    if (!state) throw new NativePaintBoxExpressionError(`Native PaintBox expression refers to unknown or unsupported state '${token.value}'.`);
    references.add(token.value);
  }

  const env = {
    state: new Map([...stateByName].map(([name, state]) => [name, placeholderValue(state.type)])),
    locals: allowCount ? { count: 1 } : {}
  };
  try {
    if (loose) evaluateLoose(expression, env);
    else evaluateExpression(expression, env);
  } catch (error) {
    if (error instanceof ExpressionError) throw new NativePaintBoxExpressionError(error.message);
    throw error;
  }

  return Object.freeze({
    expression,
    references: Object.freeze([...references]),
    looseLiteral: false,
    usesCount
  });
}

export function validateNativePaintProgramExpressions(program, states) {
  const stateByName = normalizeScalarStates(states);
  const visit = (nodes, allowCount, depth) => {
    if (!Array.isArray(nodes) || depth > 32) throw new NativePaintBoxExpressionError('PaintBox native expression program is malformed or too deeply nested.');
    for (const node of nodes) {
      if (node?.kind === 'draw') {
        if (node.command?.operation === 'text') {
          validateNativePaintExpression(node.command.textExpr, stateByName, { allowCount, loose: true });
        }
        continue;
      }
      if (node?.kind === 'if') {
        validateNativePaintExpression(node.expr, stateByName, { allowCount });
        visit(node.then ?? [], allowCount, depth + 1);
        visit(node.else ?? [], allowCount, depth + 1);
        continue;
      }
      if (node?.kind === 'repeat') {
        validateNativePaintExpression(node.expr, stateByName, { allowCount });
        visit(node.body ?? [], true, depth + 1);
        continue;
      }
    }
  };
  visit(program, false, 0);
  return true;
}

function normalizeScalarStates(states) {
  if (states instanceof Map) {
    const normalized = new Map();
    for (const [name, state] of states) normalized.set(name, normalizeState(name, state));
    return normalized;
  }
  const normalized = new Map();
  for (const state of states ?? []) {
    if (!state || typeof state.name !== 'string' || !state.name) continue;
    normalized.set(state.name, normalizeState(state.name, state));
  }
  return normalized;
}

function normalizeState(name, state) {
  const type = state?.type;
  if (!SUPPORTED_STATE_TYPES.has(type)) {
    throw new NativePaintBoxExpressionError(`Native PaintBox expression state '${name}' has unsupported type '${type ?? '?'}'.`);
  }
  return Object.freeze({ name, type });
}

function tokenize(source) {
  const tokens = [];
  let position = 0;
  while (position < source.length) {
    TOKEN.lastIndex = position;
    const match = TOKEN.exec(source);
    if (!match) throw new NativePaintBoxExpressionError(`I do not understand this PaintBox expression near: ${source.slice(position)}`);
    position = TOKEN.lastIndex;
    if (match[1] !== undefined) tokens.push({ type: 'number', value: match[1] });
    else if (match[2] !== undefined) tokens.push({ type: 'string', value: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: 'word', value: match[3] });
    else tokens.push({ type: match[4], value: match[4] });
  }
  return tokens;
}

function placeholderValue(type) {
  if (type === 'number') return 1;
  if (type === 'text') return 'x';
  if (type === 'boolean') return true;
  throw new NativePaintBoxExpressionError(`Unsupported native PaintBox state type '${type}'.`);
}

function isLooseLiteral(source) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(source);
}
