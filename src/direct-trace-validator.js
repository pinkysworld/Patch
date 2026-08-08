export const PATCH_DIRECT_TRACE_CONTRACT_VERSION = '0.1';

export class DirectTraceValidationError extends Error {}

/**
 * Build a deterministic contract for every CHANGE instruction in the supported
 * direct numeric IR subset. This module is deliberately separate from
 * wasm-direct.js and does not inspect generated Wasm bytes or backend metadata.
 */
export function buildDirectTraceContract(ir) {
  const sites = [];
  const siteByInstruction = new WeakMap();
  let nextSiteId = 0;

  const visitBlock = (block, scope) => {
    for (const instruction of block ?? []) {
      switch (instruction.code) {
        case 'CHANGE': {
          const site = {
            siteId: nextSiteId++,
            scope,
            line: instruction.line ?? null,
            target: instruction.target,
            operations: (instruction.operations ?? []).map(operation => ({
              op: operation.op,
              field: operation.field ?? null,
              expr: operation.expr ?? null,
              line: operation.line ?? null
            }))
          };
          sites.push(site);
          siteByInstruction.set(instruction, site);
          break;
        }
        case 'IF':
          visitBlock(instruction.then, scope);
          visitBlock(instruction.else, scope);
          break;
        case 'REPEAT':
          visitBlock(instruction.body, scope);
          break;
        case 'MAKE':
          visitBlock(instruction.body, instruction.name);
          break;
        default:
          break;
      }
    }
  };

  visitBlock(ir.instructions, '$program');
  return {
    format: 'patch-direct-trace-contract',
    version: PATCH_DIRECT_TRACE_CONTRACT_VERSION,
    irVersion: ir.version,
    sites,
    siteByInstruction
  };
}

/**
 * Independently execute the supported Change IR subset and derive the expected
 * ordered committed numeric transition sequence. This is a validator-side
 * execution model, not the Patch interpreter and not the Wasm backend.
 */
export function deriveExpectedDirectTrace(ir) {
  const contract = buildDirectTraceContract(ir);
  const state = new Map();
  const recipes = new Map();
  const trace = [];
  const activeRecipes = [];

  for (const instruction of ir.instructions ?? []) {
    if (instruction.code === 'MAKE') recipes.set(instruction.name, instruction);
  }

  const executeBlock = (block, locals = new Map(), scope = '$program') => {
    for (const instruction of block ?? []) {
      switch (instruction.code) {
        case 'ALLOW_CHANGES':
        case 'MAKE':
          break;

        case 'CREATE': {
          if (scope !== '$program') fail(`create '${instruction.name}' is outside validator direct subset`, instruction.line);
          if (instruction.valueType !== 'number') fail(`create ${instruction.valueType} is outside validator numeric subset`, instruction.line);
          if (state.has(instruction.name)) fail(`duplicate persistent binding '${instruction.name}'`, instruction.line);
          state.set(instruction.name, evaluateNumber(instruction.expr, state, locals, instruction.line));
          break;
        }

        case 'CHANGE': {
          if (!state.has(instruction.target)) fail(`unknown numeric target '${instruction.target}'`, instruction.line);
          const site = contract.siteByInstruction.get(instruction);
          if (!site) fail(`missing trace contract site for '${instruction.target}'`, instruction.line);
          const before = state.get(instruction.target);
          let current = before;
          for (const operation of instruction.operations ?? []) {
            if (operation.field) fail(`field changes are outside validator numeric subset`, operation.line ?? instruction.line);
            switch (operation.op) {
              case 'clear':
                current = 0;
                break;
              case 'set':
                current = evaluateNumber(operation.expr, stateWithTarget(state, instruction.target, current), locals, operation.line ?? instruction.line);
                break;
              case 'add':
                current += evaluateNumber(operation.expr, stateWithTarget(state, instruction.target, current), locals, operation.line ?? instruction.line);
                break;
              case 'remove':
                current -= evaluateNumber(operation.expr, stateWithTarget(state, instruction.target, current), locals, operation.line ?? instruction.line);
                break;
              default:
                fail(`change operation '${operation.op}' is outside validator subset`, operation.line ?? instruction.line);
            }
            requireFinite(current, `change result for '${instruction.target}'`, operation.line ?? instruction.line);
          }
          state.set(instruction.target, current);
          trace.push({
            siteId: site.siteId,
            scope: site.scope,
            line: site.line,
            target: instruction.target,
            before,
            after: current
          });
          break;
        }

        case 'SHOW':
          evaluateNumber(instruction.expr, state, locals, instruction.line);
          break;

        case 'IF': {
          const condition = evaluateBoolean(instruction.expr, state, locals, instruction.line);
          executeBlock(condition ? instruction.then : instruction.else, new Map(locals), scope);
          break;
        }

        case 'REPEAT': {
          const count = literalRepeatCount(instruction.expr, instruction.line);
          for (let i = 1; i <= count; i += 1) {
            const iterationLocals = new Map(locals);
            iterationLocals.set('count', i);
            executeBlock(instruction.body, iterationLocals, scope);
          }
          break;
        }

        case 'DO': {
          const recipe = recipes.get(instruction.name);
          if (!recipe) fail(`unknown recipe '${instruction.name}'`, instruction.line);
          if (activeRecipes.includes(instruction.name)) fail(`recursive recipe '${instruction.name}' is outside validator subset`, instruction.line);
          const params = recipe.params ?? [];
          const args = instruction.args ?? [];
          if (params.length !== args.length) fail(`recipe '${instruction.name}' arity mismatch`, instruction.line);
          const recipeLocals = new Map();
          params.forEach((name, index) => {
            const value = evaluateNumber(args[index], state, locals, instruction.line);
            const range = recipe.paramRanges?.[name];
            if (range && (value < range.min || value > range.max)) {
              fail(`recipe parameter '${name}' is outside ${range.min}..${range.max}`, instruction.line);
            }
            recipeLocals.set(name, value);
          });
          activeRecipes.push(instruction.name);
          try {
            executeBlock(recipe.body, recipeLocals, instruction.name);
          } finally {
            activeRecipes.pop();
          }
          break;
        }

        case 'RETURN':
          fail('return-valued recipes are outside validator direct subset', instruction.line);
          break;

        default:
          fail(`IR opcode '${instruction.code}' is outside validator direct subset`, instruction.line);
      }
    }
  };

  executeBlock(ir.instructions, new Map(), '$program');
  return {
    contract: serializableContract(contract),
    trace,
    state: Object.fromEntries(state)
  };
}

/**
 * Validate an observed direct-Wasm trace against the independently derived IR
 * transition contract. The observed trace intentionally need not contain siteId;
 * site identity is reconstructed by the validator from the expected execution.
 */
export function validateDirectTrace(ir, observedTrace) {
  const expected = deriveExpectedDirectTrace(ir);
  if (!Array.isArray(observedTrace)) throw new DirectTraceValidationError('Observed direct trace must be an array.');
  if (observedTrace.length !== expected.trace.length) {
    throw new DirectTraceValidationError(`Direct trace length mismatch: expected ${expected.trace.length}, observed ${observedTrace.length}.`);
  }

  const annotatedTrace = [];
  for (let index = 0; index < expected.trace.length; index += 1) {
    const want = expected.trace[index];
    const got = observedTrace[index];
    if (got?.target !== want.target) {
      throw new DirectTraceValidationError(`Trace ${index} target mismatch at site ${want.siteId}: expected '${want.target}', observed '${got?.target}'.`);
    }
    if (!sameNumber(got?.before, want.before)) {
      throw new DirectTraceValidationError(`Trace ${index} before-value mismatch at site ${want.siteId}: expected ${formatNumber(want.before)}, observed ${formatNumber(got?.before)}.`);
    }
    if (!sameNumber(got?.after, want.after)) {
      throw new DirectTraceValidationError(`Trace ${index} after-value mismatch at site ${want.siteId}: expected ${formatNumber(want.after)}, observed ${formatNumber(got?.after)}.`);
    }
    annotatedTrace.push({ ...want, observed: { ...got } });
  }

  return {
    ok: true,
    contract: expected.contract,
    expectedTrace: expected.trace,
    annotatedTrace,
    expectedState: expected.state
  };
}

function serializableContract(contract) {
  return {
    format: contract.format,
    version: contract.version,
    irVersion: contract.irVersion,
    sites: contract.sites
  };
}

function stateWithTarget(state, target, value) {
  const copy = new Map(state);
  copy.set(target, value);
  return copy;
}

function evaluateNumber(source, state, locals, line) {
  const result = new IndependentExpressionEvaluator(String(source ?? ''), state, locals).evaluate();
  if (result.kind !== 'number') fail(`expression '${source}' is not numeric`, line);
  requireFinite(result.value, `numeric expression '${source}'`, line);
  return result.value;
}

function evaluateBoolean(source, state, locals, line) {
  const result = new IndependentExpressionEvaluator(String(source ?? ''), state, locals).evaluate();
  if (result.kind !== 'boolean') fail(`condition '${source}' is not boolean in validator direct subset`, line);
  return result.value;
}

class IndependentExpressionEvaluator {
  constructor(source, state, locals) {
    this.tokens = tokenize(source);
    this.index = 0;
    this.state = state;
    this.locals = locals;
  }

  evaluate() {
    const value = this.or();
    if (!this.peek('eof')) fail(`unexpected '${this.current().text}' in validator expression`);
    return value;
  }

  current() { return this.tokens[this.index] ?? { type: 'eof', text: 'end of expression' }; }
  peek(type, text) { return this.current().type === type && (text === undefined || this.current().text === text); }
  consume(type, text) {
    if (!this.peek(type, text)) fail(`expected '${text ?? type}', found '${this.current().text}' in validator expression`);
    return this.tokens[this.index++];
  }

  or() {
    let left = this.and();
    while (this.peek('word', 'or')) {
      this.index += 1;
      const right = this.and();
      requireValueKinds(left, right, 'boolean', 'or');
      left = { kind: 'boolean', value: left.value || right.value };
    }
    return left;
  }

  and() {
    let left = this.equality();
    while (this.peek('word', 'and')) {
      this.index += 1;
      const right = this.equality();
      requireValueKinds(left, right, 'boolean', 'and');
      left = { kind: 'boolean', value: left.value && right.value };
    }
    return left;
  }

  equality() {
    let left = this.comparison();
    while (this.peek('==') || this.peek('!=')) {
      const op = this.tokens[this.index++].type;
      const right = this.comparison();
      if (left.kind !== right.kind) fail(`${op} requires same-kind operands in validator`);
      left = { kind: 'boolean', value: op === '==' ? left.value === right.value : left.value !== right.value };
    }
    return left;
  }

  comparison() {
    let left = this.additive();
    while (this.peek('<') || this.peek('>') || this.peek('<=') || this.peek('>=')) {
      const op = this.tokens[this.index++].type;
      const right = this.additive();
      requireValueKinds(left, right, 'number', op);
      const value = op === '<' ? left.value < right.value
        : op === '>' ? left.value > right.value
          : op === '<=' ? left.value <= right.value
            : left.value >= right.value;
      left = { kind: 'boolean', value };
    }
    return left;
  }

  additive() {
    let left = this.multiplicative();
    while (this.peek('+') || this.peek('-')) {
      const op = this.tokens[this.index++].type;
      const right = this.multiplicative();
      requireValueKinds(left, right, 'number', op);
      left = { kind: 'number', value: op === '+' ? left.value + right.value : left.value - right.value };
    }
    return left;
  }

  multiplicative() {
    let left = this.unary();
    while (this.peek('*') || this.peek('/') || this.peek('%')) {
      const op = this.tokens[this.index++].type;
      if (op === '%') fail("'%' is outside validator direct subset");
      const right = this.unary();
      requireValueKinds(left, right, 'number', op);
      left = { kind: 'number', value: op === '*' ? left.value * right.value : left.value / right.value };
    }
    return left;
  }

  unary() {
    if (this.peek('-')) {
      this.index += 1;
      const value = this.unary();
      if (value.kind !== 'number') fail('unary - requires a number in validator');
      return { kind: 'number', value: -value.value };
    }
    if (this.peek('word', 'not')) {
      this.index += 1;
      const value = this.unary();
      if (value.kind !== 'boolean') fail('not requires a boolean in validator');
      return { kind: 'boolean', value: !value.value };
    }
    return this.primary();
  }

  primary() {
    if (this.peek('number')) return { kind: 'number', value: this.consume('number').value };
    if (this.peek('word', 'true')) { this.index += 1; return { kind: 'boolean', value: true }; }
    if (this.peek('word', 'false')) { this.index += 1; return { kind: 'boolean', value: false }; }
    if (this.peek('word')) {
      const name = this.consume('word').text;
      if (this.locals.has(name)) return { kind: 'number', value: this.locals.get(name) };
      if (this.state.has(name)) return { kind: 'number', value: this.state.get(name) };
      fail(`unknown validator numeric name '${name}'`);
    }
    if (this.peek('(')) {
      this.index += 1;
      const value = this.or();
      this.consume(')');
      return value;
    }
    fail(`unexpected '${this.current().text}' in validator expression`);
  }
}

function tokenize(source) {
  const text = source.trim();
  const out = [];
  const token = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|\+|-|\*|\/|%|<|>|\(|\)))/gy;
  let position = 0;
  while (position < text.length) {
    token.lastIndex = position;
    const match = token.exec(text);
    if (!match) fail(`cannot parse validator expression near '${text.slice(position)}'`);
    position = token.lastIndex;
    if (match[1] !== undefined) out.push({ type: 'number', value: Number(match[1]), text: match[1] });
    else if (match[2] !== undefined) out.push({ type: 'word', text: match[2] });
    else out.push({ type: match[3], text: match[3] });
  }
  out.push({ type: 'eof', text: 'end of expression' });
  return out;
}

function literalRepeatCount(source, line) {
  const text = String(source ?? '').trim();
  if (!/^\d+$/.test(text)) fail(`repeat '${text}' is not a literal whole number`, line);
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count < 0 || count > 100000) fail('repeat must be 0..100000', line);
  return count;
}

function requireValueKinds(left, right, kind, operator) {
  if (left.kind !== kind || right.kind !== kind) fail(`${operator} requires ${kind} operands in validator`);
}

function requireFinite(value, context, line) {
  if (!Number.isFinite(value)) fail(`${context} produced non-finite number outside validator subset`, line);
}

function sameNumber(a, b) {
  return typeof a === 'number' && typeof b === 'number' && Object.is(a, b);
}

function formatNumber(value) {
  return typeof value === 'number' ? String(value) : JSON.stringify(value);
}

function fail(message, line = null) {
  const suffix = line === null || line === undefined ? '' : ` at line ${line}`;
  throw new DirectTraceValidationError(`Direct trace validator: ${message}${suffix}.`);
}
