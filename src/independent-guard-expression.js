export const PATCH_INDEPENDENT_GUARD_EXPRESSION_VERSION = '0.1';

/**
 * Independently parse the small beta.23 Boolean/integer guard language.
 *
 * This module intentionally does not import formal-guard.js, parser.js, or any
 * production AST helper. Its output is normalized into the same declarative
 * GuardExpr shape so guard-validation.js can compare two separately parsed
 * representations before certification.
 */
export function buildIndependentGuardExpression(source, allowedVariables = new Set()) {
  const expression = String(source ?? '').trim();
  try {
    const parser = new IndependentGuardParser(expression, new Set(allowedVariables));
    const expr = parser.parse();
    return {
      supported: true,
      version: PATCH_INDEPENDENT_GUARD_EXPRESSION_VERSION,
      expression,
      expr,
      variables: [...parser.variables].sort()
    };
  } catch (error) {
    return {
      supported: false,
      version: PATCH_INDEPENDENT_GUARD_EXPRESSION_VERSION,
      expression,
      expr: null,
      variables: [],
      reason: error?.message ?? String(error)
    };
  }
}

class IndependentGuardParser {
  constructor(source, allowedVariables) {
    this.tokens = lex(source);
    this.position = 0;
    this.allowedVariables = allowedVariables;
    this.variables = new Set();
  }

  parse() {
    const result = this.parseOr();
    if (!this.at('eof')) throw new Error(`unexpected '${this.token().text}' in independent guard`);
    return result;
  }

  token(offset = 0) {
    return this.tokens[this.position + offset] ?? { kind: 'eof', text: 'end of guard' };
  }

  at(kind, text) {
    const token = this.token();
    return token.kind === kind && (text === undefined || token.text === text);
  }

  consume(kind, text) {
    if (!this.at(kind, text)) {
      throw new Error(`expected '${text ?? kind}', found '${this.token().text}' in independent guard`);
    }
    return this.tokens[this.position++];
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.at('word', 'or')) {
      this.position += 1;
      left = { kind: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.at('word', 'and')) {
      this.position += 1;
      left = { kind: 'and', left, right: this.parseNot() };
    }
    return left;
  }

  parseNot() {
    if (this.at('word', 'not')) {
      this.position += 1;
      return { kind: 'not', expr: this.parseNot() };
    }
    return this.parseBooleanAtom();
  }

  parseBooleanAtom() {
    if (this.at('word', 'true')) {
      this.position += 1;
      return { kind: 'bool', value: true };
    }
    if (this.at('word', 'false')) {
      this.position += 1;
      return { kind: 'bool', value: false };
    }

    const checkpoint = this.position;
    let arithmeticError = null;
    try {
      const left = this.parseIntegerSum();
      if (this.at('operator') && COMPARISONS.has(this.token().text)) {
        const op = this.tokens[this.position++].text;
        const right = this.parseIntegerSum();
        return comparison(op, left, right);
      }
    } catch (error) {
      arithmeticError = error;
    }
    this.position = checkpoint;

    if (this.at('lparen')) {
      this.position += 1;
      const inner = this.parseOr();
      this.consume('rparen');
      return inner;
    }

    if (arithmeticError) throw arithmeticError;
    throw new Error(`independent guard needs a Boolean literal or integer comparison near '${this.token().text}'`);
  }

  parseIntegerSum() {
    let left = this.parseIntegerProduct();
    while (this.at('operator', '+') || this.at('operator', '-')) {
      const op = this.tokens[this.position++].text;
      const right = this.parseIntegerProduct();
      left = { kind: op === '+' ? 'add' : 'sub', left, right };
    }
    return left;
  }

  parseIntegerProduct() {
    let left = this.parseIntegerUnary();
    while (this.at('operator', '*')) {
      this.position += 1;
      const right = this.parseIntegerUnary();
      left = independentScale(left, right);
    }
    return left;
  }

  parseIntegerUnary() {
    if (this.at('operator', '-')) {
      this.position += 1;
      return { kind: 'neg', expr: this.parseIntegerUnary() };
    }
    return this.parseIntegerPrimary();
  }

  parseIntegerPrimary() {
    if (this.at('number')) {
      const value = this.tokens[this.position++].value;
      if (!Number.isSafeInteger(value)) throw new Error(`integer literal '${value}' is outside the independent safe-integer guard fragment`);
      return { kind: 'lit', value };
    }

    if (this.at('word')) {
      const name = this.tokens[this.position++].text;
      if (!this.allowedVariables.has(name)) {
        throw new Error(`guard variable '${name}' is not an allowed recipe parameter in the independent guard fragment`);
      }
      this.variables.add(name);
      return { kind: 'var', name };
    }

    if (this.at('lparen')) {
      this.position += 1;
      const inner = this.parseIntegerSum();
      this.consume('rparen');
      return inner;
    }

    throw new Error(`expected integer expression near '${this.token().text}' in independent guard`);
  }
}

const COMPARISONS = new Set(['==', '!=', '<', '>', '<=', '>=']);

function comparison(op, left, right) {
  if (op === '==') return { kind: 'eq', left, right };
  if (op === '!=') return { kind: 'not', expr: { kind: 'eq', left, right } };
  if (op === '<') return { kind: 'lt', left, right };
  if (op === '<=') return { kind: 'le', left, right };
  if (op === '>') return { kind: 'lt', left: right, right: left };
  if (op === '>=') return { kind: 'le', left: right, right: left };
  throw new Error(`unsupported independent guard comparison '${op}'`);
}

function independentScale(left, right) {
  if (left.kind === 'lit' && left.value >= 0 && Number.isSafeInteger(left.value)) {
    return { kind: 'scale', factor: left.value, expr: right };
  }
  if (right.kind === 'lit' && right.value >= 0 && Number.isSafeInteger(right.value)) {
    return { kind: 'scale', factor: right.value, expr: left };
  }
  throw new Error('independent guard multiplication requires one non-negative integer literal operand');
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
      const text = source.slice(start, index);
      tokens.push({ kind: 'number', text, value: Number(text) });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1;
      const text = source.slice(start, index);
      tokens.push({ kind: 'word', text });
      continue;
    }

    const pair = source.slice(index, index + 2);
    if (['==', '!=', '<=', '>='].includes(pair)) {
      tokens.push({ kind: 'operator', text: pair });
      index += 2;
      continue;
    }

    if (['+', '-', '*', '<', '>'].includes(char)) {
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

    throw new Error(`unsupported token near '${source.slice(index)}' in independent guard`);
  }

  tokens.push({ kind: 'eof', text: 'end of guard' });
  return tokens;
}
