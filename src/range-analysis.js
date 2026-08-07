const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const NAME = /^[A-Za-z_]\w*$/;

export function inferNumericRange(expression, bindings = {}) {
  const env = bindings instanceof Map ? bindings : new Map(Object.entries(bindings));
  try {
    const parser = new RangeParser(String(expression ?? ''), env);
    const range = parser.parse();
    return range && Number.isFinite(range.min) && Number.isFinite(range.max) ? normalize(range) : null;
  } catch {
    return null;
  }
}

export function rangeWithin(range, min, max) {
  return Boolean(range && range.min >= min && range.max <= max);
}

export function formatRange(range) {
  if (!range) return 'unknown';
  if (range.min === range.max) return String(range.min);
  return `${range.min}..${range.max}`;
}

class RangeParser {
  constructor(source, env) {
    this.tokens = tokenize(source);
    this.i = 0;
    this.env = env;
  }

  parse() {
    if (!this.tokens.length) return null;
    const result = this.expression();
    if (this.i !== this.tokens.length) throw new Error('trailing token');
    return result;
  }

  expression() {
    let left = this.term();
    while (this.peek('+') || this.peek('-')) {
      const op = this.take();
      const right = this.term();
      left = op === '+' ? add(left, right) : sub(left, right);
    }
    return left;
  }

  term() {
    let left = this.unary();
    while (this.peek('*') || this.peek('/')) {
      const op = this.take();
      const right = this.unary();
      left = op === '*' ? mul(left, right) : div(left, right);
      if (!left) throw new Error('unsafe division');
    }
    return left;
  }

  unary() {
    if (this.peek('+')) { this.take(); return this.unary(); }
    if (this.peek('-')) { this.take(); return scale(this.unary(), -1); }
    return this.primary();
  }

  primary() {
    const token = this.take();
    if (token === '(') {
      const value = this.expression();
      if (this.take() !== ')') throw new Error('missing )');
      return value;
    }
    if (NUMBER.test(token)) {
      const n = Number(token);
      return { min: n, max: n };
    }
    if (NAME.test(token)) {
      const range = this.env.get(token);
      if (!range) throw new Error(`unknown ${token}`);
      return normalize(range);
    }
    throw new Error(`unexpected ${token}`);
  }

  peek(value) { return this.tokens[this.i] === value; }
  take() {
    if (this.i >= this.tokens.length) throw new Error('unexpected end');
    return this.tokens[this.i++];
  }
}

function tokenize(source) {
  const out = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ('()+-*/'.includes(ch)) { out.push(ch); i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[0-9.]/.test(source[j])) j++;
      const token = source.slice(i, j);
      if (!NUMBER.test(token)) throw new Error('bad number');
      out.push(token); i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
      out.push(source.slice(i, j)); i = j; continue;
    }
    throw new Error(`unsupported token ${ch}`);
  }
  return out;
}

function normalize(range) {
  const min = Number(range.min);
  const max = Number(range.max);
  return min <= max ? { min, max } : { min: max, max: min };
}
function add(a, b) { return { min: a.min + b.min, max: a.max + b.max }; }
function sub(a, b) { return { min: a.min - b.max, max: a.max - b.min }; }
function scale(a, factor) { return normalize({ min: a.min * factor, max: a.max * factor }); }
function mul(a, b) {
  const xs = [a.min * b.min, a.min * b.max, a.max * b.min, a.max * b.max];
  return { min: Math.min(...xs), max: Math.max(...xs) };
}
function div(a, b) {
  if (b.min <= 0 && b.max >= 0) return null;
  const xs = [a.min / b.min, a.min / b.max, a.max / b.min, a.max / b.max];
  return { min: Math.min(...xs), max: Math.max(...xs) };
}
