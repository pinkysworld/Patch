const INTEGER = /^\d+$/;
const NAME = /^[A-Za-z_]\w*$/;

/**
 * Parse the production expression text into the beta.9 formal integer range
 * fragment. This extractor is intentionally independent of range-analysis.js.
 * Supported: integer literals, ranged names, parentheses, unary +/- , +, -,
 * and multiplication where one operand is a non-negative integer literal.
 * General multiplication, decimals and division remain outside the verified
 * range fragment.
 */
export function buildFormalRangeExpression(expression, bindings = {}) {
  const ranges = bindings instanceof Map ? new Map(bindings) : new Map(Object.entries(bindings));
  try {
    const parser = new FormalRangeParser(String(expression ?? ''), ranges);
    const expr = parser.parse();
    const range = inferFormalRange(expr, ranges);
    if (!range) throw new Error('formal range could not be inferred');
    return {
      supported: true,
      expression: String(expression ?? ''),
      expr,
      bindings: usedBindings(expr, ranges),
      range,
      reason: null
    };
  } catch (error) {
    return {
      supported: false,
      expression: String(expression ?? ''),
      expr: null,
      bindings: {},
      range: null,
      reason: error.message
    };
  }
}

export function inferFormalRange(expr, bindings = {}) {
  const ranges = bindings instanceof Map ? bindings : new Map(Object.entries(bindings));
  switch (expr?.kind) {
    case 'lit': return { min: expr.value, max: expr.value };
    case 'var': {
      const range = ranges.get(expr.name);
      if (!isIntegerRange(range)) return null;
      return { min: range.min, max: range.max };
    }
    case 'add': {
      const left = inferFormalRange(expr.left, ranges);
      const right = inferFormalRange(expr.right, ranges);
      return left && right ? safeRange(left.min + right.min, left.max + right.max) : null;
    }
    case 'sub': {
      const left = inferFormalRange(expr.left, ranges);
      const right = inferFormalRange(expr.right, ranges);
      return left && right ? safeRange(left.min - right.max, left.max - right.min) : null;
    }
    case 'neg': {
      const inner = inferFormalRange(expr.expr, ranges);
      return inner ? safeRange(-inner.max, -inner.min) : null;
    }
    case 'scale': {
      const inner = inferFormalRange(expr.expr, ranges);
      return inner ? safeRange(inner.min * expr.factor, inner.max * expr.factor) : null;
    }
    default: return null;
  }
}

class FormalRangeParser {
  constructor(source, ranges) {
    this.tokens = tokenize(source);
    this.i = 0;
    this.ranges = ranges;
  }

  parse() {
    if (!this.tokens.length) throw new Error('empty numeric expression');
    const expr = this.expression();
    if (this.i !== this.tokens.length) throw new Error(`unsupported trailing token '${this.tokens[this.i]}'`);
    return expr;
  }

  expression() {
    let left = this.term();
    while (this.peek('+') || this.peek('-')) {
      const op = this.take();
      const right = this.term();
      left = op === '+' ? { kind: 'add', left, right } : { kind: 'sub', left, right };
    }
    return left;
  }

  term() {
    let left = this.unary();
    while (this.peek('*')) {
      this.take();
      const right = this.unary();
      left = scaleProduct(left, right);
    }
    if (this.peek('/')) throw new Error('division is outside the beta.9 verified range fragment');
    return left;
  }

  unary() {
    if (this.peek('+')) { this.take(); return this.unary(); }
    if (this.peek('-')) { this.take(); return { kind: 'neg', expr: this.unary() }; }
    return this.primary();
  }

  primary() {
    const token = this.take();
    if (token === '(') {
      const expr = this.expression();
      if (this.take() !== ')') throw new Error('missing closing parenthesis');
      return expr;
    }
    if (INTEGER.test(token)) {
      const value = Number(token);
      if (!Number.isSafeInteger(value)) throw new Error('integer literal exceeds JavaScript safe-integer range');
      return { kind: 'lit', value };
    }
    if (NAME.test(token)) {
      const range = this.ranges.get(token);
      if (!isIntegerRange(range)) throw new Error(`'${token}' has no safe integer range for formal analysis`);
      return { kind: 'var', name: token };
    }
    throw new Error(`unsupported token '${token}'`);
  }

  peek(value) { return this.tokens[this.i] === value; }
  take() {
    if (this.i >= this.tokens.length) throw new Error('unexpected end of expression');
    return this.tokens[this.i++];
  }
}

function scaleProduct(left, right) {
  if (left.kind === 'lit' && left.value >= 0) return { kind: 'scale', factor: left.value, expr: right };
  if (right.kind === 'lit' && right.value >= 0) return { kind: 'scale', factor: right.value, expr: left };
  throw new Error('general multiplication is outside the beta.9 verified range fragment; one operand must be a non-negative integer literal');
}

function tokenize(source) {
  const out = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ('()+-*/'.includes(ch)) { out.push(ch); i++; continue; }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[0-9]/.test(source[j])) j++;
      if (source[j] === '.') throw new Error('decimal literals are outside the beta.9 verified range fragment');
      out.push(source.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
      out.push(source.slice(i, j));
      i = j;
      continue;
    }
    throw new Error(`unsupported token '${ch}'`);
  }
  return out;
}

function usedBindings(expr, ranges) {
  const names = new Set();
  walkExpr(expr, node => { if (node.kind === 'var') names.add(node.name); });
  const out = {};
  for (const name of [...names].sort()) {
    const range = ranges.get(name);
    if (!isIntegerRange(range)) throw new Error(`'${name}' has no safe integer range for formal analysis`);
    out[name] = { min: range.min, max: range.max };
  }
  return out;
}

function walkExpr(expr, visit) {
  visit(expr);
  if (expr.left) walkExpr(expr.left, visit);
  if (expr.right) walkExpr(expr.right, visit);
  if (expr.expr) walkExpr(expr.expr, visit);
}

function isIntegerRange(range) {
  return Boolean(range && Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) && range.min <= range.max);
}

function safeRange(min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return null;
  return { min, max };
}
