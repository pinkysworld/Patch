export const PATCH_INDEPENDENT_RANGE_EXPRESSION_VERSION = '0.1';

/**
 * Independently parse and evaluate the beta.9 integer RangeExpr fragment.
 *
 * This module intentionally imports neither formal-range.js, range-analysis.js,
 * parser.js, nor production AST helpers. It normalizes raw expression text into
 * the same declarative RangeExpr vocabulary so source-validation.js can compare
 * independently derived evidence with compiler-produced formalSource evidence.
 */
export function buildIndependentRangeExpression(expression, bindings = {}) {
  const source = String(expression ?? '');
  const ranges = bindings instanceof Map ? new Map(bindings) : new Map(Object.entries(bindings));
  try {
    const parser = new IndependentRangeParser(source, ranges);
    const expr = parser.parse();
    const range = inferIndependentRange(expr, ranges);
    if (!range) throw new Error('independent range could not be inferred');
    return {
      supported: true,
      version: PATCH_INDEPENDENT_RANGE_EXPRESSION_VERSION,
      expression: source,
      expr,
      bindings: independentUsedBindings(expr, ranges),
      range,
      reason: null
    };
  } catch (error) {
    return {
      supported: false,
      version: PATCH_INDEPENDENT_RANGE_EXPRESSION_VERSION,
      expression: source,
      expr: null,
      bindings: {},
      range: null,
      reason: error?.message ?? String(error)
    };
  }
}

export function inferIndependentRange(expr, bindings = {}) {
  const ranges = bindings instanceof Map ? bindings : new Map(Object.entries(bindings));
  switch (expr?.kind) {
    case 'lit':
      return independentSafeRange(expr.value, expr.value);
    case 'var': {
      const range = ranges.get(expr.name);
      if (!isSafeIntegerRange(range)) return null;
      return { min: range.min, max: range.max };
    }
    case 'add': {
      const left = inferIndependentRange(expr.left, ranges);
      const right = inferIndependentRange(expr.right, ranges);
      return left && right ? independentSafeRange(left.min + right.min, left.max + right.max) : null;
    }
    case 'sub': {
      const left = inferIndependentRange(expr.left, ranges);
      const right = inferIndependentRange(expr.right, ranges);
      return left && right ? independentSafeRange(left.min - right.max, left.max - right.min) : null;
    }
    case 'neg': {
      const inner = inferIndependentRange(expr.expr, ranges);
      return inner ? independentSafeRange(-inner.max, -inner.min) : null;
    }
    case 'scale': {
      if (!Number.isSafeInteger(expr.factor) || expr.factor < 0) return null;
      const inner = inferIndependentRange(expr.expr, ranges);
      return inner ? independentSafeRange(inner.min * expr.factor, inner.max * expr.factor) : null;
    }
    default:
      return null;
  }
}

class IndependentRangeParser {
  constructor(source, ranges) {
    this.tokens = lex(source);
    this.position = 0;
    this.ranges = ranges;
  }

  parse() {
    if (this.at('eof')) throw new Error('empty numeric expression');
    const expr = this.parseSum();
    if (!this.at('eof')) throw new Error(`unsupported trailing token '${this.token().text}' in independent range expression`);
    return expr;
  }

  token(offset = 0) {
    return this.tokens[this.position + offset] ?? { kind: 'eof', text: 'end of expression' };
  }

  at(kind, text) {
    const token = this.token();
    return token.kind === kind && (text === undefined || token.text === text);
  }

  take(kind, text) {
    if (!this.at(kind, text)) {
      throw new Error(`expected '${text ?? kind}', found '${this.token().text}' in independent range expression`);
    }
    return this.tokens[this.position++];
  }

  parseSum() {
    let left = this.parseProduct();
    while (this.at('operator', '+') || this.at('operator', '-')) {
      const op = this.tokens[this.position++].text;
      const right = this.parseProduct();
      left = { kind: op === '+' ? 'add' : 'sub', left, right };
    }
    return left;
  }

  parseProduct() {
    let left = this.parseUnary();
    while (this.at('operator', '*')) {
      this.position += 1;
      const right = this.parseUnary();
      left = independentScaleProduct(left, right);
    }
    if (this.at('operator', '/')) {
      throw new Error('division is outside the beta.9 independent verified range fragment');
    }
    return left;
  }

  parseUnary() {
    if (this.at('operator', '+')) {
      this.position += 1;
      return this.parseUnary();
    }
    if (this.at('operator', '-')) {
      this.position += 1;
      return { kind: 'neg', expr: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.at('lparen')) {
      this.position += 1;
      const expr = this.parseSum();
      this.take('rparen');
      return expr;
    }

    if (this.at('number')) {
      const value = this.tokens[this.position++].value;
      if (!Number.isSafeInteger(value)) throw new Error('integer literal exceeds independent safe-integer range');
      return { kind: 'lit', value };
    }

    if (this.at('word')) {
      const name = this.tokens[this.position++].text;
      const range = this.ranges.get(name);
      if (!isSafeIntegerRange(range)) throw new Error(`'${name}' has no safe integer range for independent formal analysis`);
      return { kind: 'var', name };
    }

    throw new Error(`unsupported token '${this.token().text}' in independent range expression`);
  }
}

function independentScaleProduct(left, right) {
  if (left.kind === 'lit' && Number.isSafeInteger(left.value) && left.value >= 0) {
    return { kind: 'scale', factor: left.value, expr: right };
  }
  if (right.kind === 'lit' && Number.isSafeInteger(right.value) && right.value >= 0) {
    return { kind: 'scale', factor: right.value, expr: left };
  }
  throw new Error('general multiplication is outside the beta.9 independent range fragment; one operand must be a non-negative integer literal');
}

function lex(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9]/.test(char)) {
      const start = index;
      while (index < source.length && /[0-9]/.test(source[index])) index += 1;
      if (source[index] === '.') throw new Error('decimal literals are outside the beta.9 independent range fragment');
      const text = source.slice(start, index);
      tokens.push({ kind: 'number', text, value: Number(text) });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1;
      tokens.push({ kind: 'word', text: source.slice(start, index) });
      continue;
    }
    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ kind: 'operator', text: char });
      index += 1;
      continue;
    }
    if (char === '(') {
      tokens.push({ kind: 'lparen', text: char });
      index += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ kind: 'rparen', text: char });
      index += 1;
      continue;
    }
    throw new Error(`unsupported token '${char}' in independent range expression`);
  }
  tokens.push({ kind: 'eof', text: 'end of expression' });
  return tokens;
}

function independentUsedBindings(expr, ranges) {
  const names = new Set();
  walk(expr, node => {
    if (node.kind === 'var') names.add(node.name);
  });
  const out = {};
  for (const name of [...names].sort()) {
    const range = ranges.get(name);
    if (!isSafeIntegerRange(range)) throw new Error(`'${name}' has no safe integer range for independent formal analysis`);
    out[name] = { min: range.min, max: range.max };
  }
  return out;
}

function walk(expr, visit) {
  visit(expr);
  if (expr.left) walk(expr.left, visit);
  if (expr.right) walk(expr.right, visit);
  if (expr.expr) walk(expr.expr, visit);
}

function isSafeIntegerRange(range) {
  return Boolean(range && Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) && range.min <= range.max);
}

function independentSafeRange(min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return null;
  return { min, max };
}
