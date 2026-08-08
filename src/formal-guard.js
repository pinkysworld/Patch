export const PATCH_FORMAL_GUARD_VERSION = '0.1';

/**
 * Parse the integer/Boolean guard fragment that beta.23 can send to Lean.
 * Variables must be explicitly supplied (currently recipe parameters only).
 *
 * Integer fragment: literals, variables, +, -, unary -, and multiplication by
 * a non-negative integer literal. Boolean fragment: true/false, comparisons,
 * not/and/or and parentheses. Unsupported constructs fail conservatively.
 */
export function buildFormalGuardExpression(source, allowedVariables = new Set()) {
  try {
    const parser = new GuardParser(String(source ?? ''), new Set(allowedVariables));
    const expr = parser.parse();
    return {
      supported: true,
      version: PATCH_FORMAL_GUARD_VERSION,
      expression: String(source ?? '').trim(),
      expr,
      variables: [...parser.variables].sort()
    };
  } catch (error) {
    return {
      supported: false,
      version: PATCH_FORMAL_GUARD_VERSION,
      expression: String(source ?? '').trim(),
      expr: null,
      variables: [],
      reason: error?.message ?? String(error)
    };
  }
}

class GuardParser {
  constructor(source, allowedVariables) {
    this.tokens = tokenize(source);
    this.index = 0;
    this.allowedVariables = allowedVariables;
    this.variables = new Set();
  }

  parse() {
    const expr = this.parseOr();
    if (!this.peek('eof')) throw new Error(`unexpected '${this.current().text}' in formal guard`);
    return expr;
  }

  current() { return this.tokens[this.index] ?? { type: 'eof', text: 'end of guard' }; }
  peek(type, text) { return this.current().type === type && (text === undefined || this.current().text === text); }
  take(type, text) {
    if (!this.peek(type, text)) throw new Error(`expected '${text ?? type}', found '${this.current().text}' in formal guard`);
    return this.tokens[this.index++];
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.peek('word', 'or')) {
      this.index += 1;
      left = { kind: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.peek('word', 'and')) {
      this.index += 1;
      left = { kind: 'and', left, right: this.parseNot() };
    }
    return left;
  }

  parseNot() {
    if (this.peek('word', 'not')) {
      this.index += 1;
      return { kind: 'not', expr: this.parseNot() };
    }
    return this.parseBoolAtom();
  }

  parseBoolAtom() {
    if (this.peek('word', 'true')) { this.index += 1; return { kind: 'bool', value: true }; }
    if (this.peek('word', 'false')) { this.index += 1; return { kind: 'bool', value: false }; }

    // First try a numeric comparison. This lets arithmetic parentheses such as
    // `(bonus + 1) > 0` remain part of the integer expression grammar.
    const start = this.index;
    try {
      const left = this.parseIntAddSub();
      if (['==', '!=', '<', '>', '<=', '>='].some(op => this.peek(op))) {
        const op = this.tokens[this.index++].type;
        const right = this.parseIntAddSub();
        if (op === '==') return { kind: 'eq', left, right };
        if (op === '!=') return { kind: 'not', expr: { kind: 'eq', left, right } };
        if (op === '<') return { kind: 'lt', left, right };
        if (op === '<=') return { kind: 'le', left, right };
        if (op === '>') return { kind: 'lt', left: right, right: left };
        return { kind: 'le', left: right, right: left };
      }
    } catch {
      // Backtrack and try a parenthesized Boolean expression below.
    }
    this.index = start;

    if (this.peek('(')) {
      this.index += 1;
      const inner = this.parseOr();
      this.take(')');
      return inner;
    }

    throw new Error(`formal guard needs a Boolean literal or integer comparison near '${this.current().text}'`);
  }

  parseIntAddSub() {
    let left = this.parseIntMul();
    while (this.peek('+') || this.peek('-')) {
      const op = this.tokens[this.index++].type;
      const right = this.parseIntMul();
      left = { kind: op === '+' ? 'add' : 'sub', left, right };
    }
    return left;
  }

  parseIntMul() {
    let left = this.parseIntUnary();
    while (this.peek('*')) {
      this.index += 1;
      const right = this.parseIntUnary();
      left = normalizeScale(left, right);
    }
    return left;
  }

  parseIntUnary() {
    if (this.peek('-')) {
      this.index += 1;
      return { kind: 'neg', expr: this.parseIntUnary() };
    }
    return this.parseIntPrimary();
  }

  parseIntPrimary() {
    if (this.peek('number')) {
      const value = this.tokens[this.index++].value;
      if (!Number.isSafeInteger(value)) throw new Error(`integer literal '${value}' is outside the formal safe-integer guard fragment`);
      return { kind: 'lit', value };
    }
    if (this.peek('word')) {
      const name = this.tokens[this.index++].text;
      if (!this.allowedVariables.has(name)) {
        throw new Error(`guard variable '${name}' is not a recipe parameter in the beta.23 guard-aware fragment`);
      }
      this.variables.add(name);
      return { kind: 'var', name };
    }
    if (this.peek('(')) {
      this.index += 1;
      const inner = this.parseIntAddSub();
      this.take(')');
      return inner;
    }
    throw new Error(`expected integer expression near '${this.current().text}'`);
  }
}

function normalizeScale(left, right) {
  if (left.kind === 'lit' && left.value >= 0 && Number.isSafeInteger(left.value)) {
    return { kind: 'scale', factor: left.value, expr: right };
  }
  if (right.kind === 'lit' && right.value >= 0 && Number.isSafeInteger(right.value)) {
    return { kind: 'scale', factor: right.value, expr: left };
  }
  throw new Error('formal guard multiplication requires one non-negative integer literal operand');
}

function tokenize(source) {
  const tokens = [];
  const re = /\s*(?:(\d+)|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|\+|-|\*|<|>|\(|\)))/gy;
  let position = 0;
  while (position < source.length) {
    re.lastIndex = position;
    const match = re.exec(source);
    if (!match) throw new Error(`unsupported token near '${source.slice(position)}' in formal guard`);
    position = re.lastIndex;
    if (match[1] !== undefined) tokens.push({ type: 'number', text: match[1], value: Number(match[1]) });
    else if (match[2] !== undefined) tokens.push({ type: 'word', text: match[2] });
    else tokens.push({ type: match[3], text: match[3] });
  }
  tokens.push({ type: 'eof', text: 'end of guard' });
  return tokens;
}
