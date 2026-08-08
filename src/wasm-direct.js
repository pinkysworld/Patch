import { compile } from './compiler.js';

export const PATCH_DIRECT_WASM_VERSION = '0.3-recipes';

export class DirectWasmUnsupportedError extends Error {}

/**
 * Compile a numeric console subset of Patch directly to executable WebAssembly.
 * The generated module executes state changes, control flow and non-recursive
 * numeric recipes itself. Unsupported constructs fail explicitly instead of
 * falling back to the interpreter.
 */
export function compileToDirectWasm(source, options = {}) {
  const compiled = compile(source, options);
  if (compiled.project.kind !== 'console') {
    throw unsupported('direct Wasm beta supports console projects only');
  }

  const numericNames = collectNumericBindings(compiled.ir.instructions);
  const globals = new Map(numericNames.map((name, index) => [name, index]));
  const recipeList = collectRecipes(compiled.ir.instructions);
  validateAcyclicRecipes(recipeList);

  const recipes = new Map(recipeList.map((instruction, index) => [instruction.name, {
    instruction,
    functionIndex: 2 + index, // function 0 is imported show_number; function 1 is run
    typeIndex: 2 + index,
    params: instruction.params ?? [],
    paramRanges: instruction.paramRanges ?? {}
  }]));

  const runContext = makeContext({
    globals,
    defined: new Set(),
    locals: new Map(),
    recipes,
    scope: 'program',
    functionName: '$program',
    allowCreate: true,
    allowDefinitions: true,
    paramCount: 0
  });
  lowerBlock(compiled.ir.instructions, runContext);

  const recipeFunctions = recipeList.map(instruction => {
    const recipe = recipes.get(instruction.name);
    const locals = new Map();
    recipe.params.forEach((name, index) => locals.set(name, { index, kind: 'f64-number' }));
    const ctx = makeContext({
      globals,
      defined: new Set(globals.keys()),
      locals,
      recipes,
      scope: 'recipe',
      functionName: instruction.name,
      allowCreate: false,
      allowDefinitions: false,
      paramCount: recipe.params.length
    });
    emitParameterRangeGuards(recipe, ctx);
    lowerBlock(instruction.body ?? [], ctx);
    return {
      name: instruction.name,
      params: recipe.params,
      paramRanges: recipe.paramRanges,
      functionIndex: recipe.functionIndex,
      typeIndex: recipe.typeIndex,
      instructions: ctx.instructions,
      localCount: ctx.allocator.declaredLocals
    };
  });

  const stateExports = Object.fromEntries(numericNames.map((name, index) => [name, {
    export: `patch_state_${name}`,
    globalIndex: index
  }]));

  const module = buildModule({
    globalCount: numericNames.length,
    runFunction: {
      instructions: runContext.instructions,
      localCount: runContext.allocator.declaredLocals
    },
    recipeFunctions,
    stateExports
  });

  const metadata = {
    format: 'patch-wasm-direct',
    version: PATCH_DIRECT_WASM_VERSION,
    project: compiled.project,
    irVersion: compiled.ir.version,
    numericModel: 'wasm-f64 / JavaScript Number subset',
    hostAbi: { module: 'patch', showNumber: 'show_number(f64) -> void' },
    stateExports,
    recipes: Object.fromEntries(recipeFunctions.map(recipe => [recipe.name, {
      params: recipe.params,
      paramRanges: recipe.paramRanges,
      functionIndex: recipe.functionIndex
    }])),
    supported: [
      'create number at top level',
      'change number set/add/remove/clear',
      'show numeric expression',
      'numeric literals, earlier bindings, recipe parameters and repeat count',
      'numeric + - * /',
      'if/else with supported boolean/numeric comparisons',
      'literal repeat 0..100000 with Patch count local',
      'non-recursive make/do recipes with numeric arguments',
      'ranged numeric recipe parameters with Wasm runtime guards'
    ]
  };

  return { module, metadata, compiled };
}

/** Instantiate and execute a directly compiled module with the minimal Patch host ABI. */
export async function runDirectWasm(module, metadata, options = {}) {
  const output = [];
  const imports = {
    patch: {
      show_number(value) {
        output.push(String(value));
        if (options.showNumber) options.showNumber(value);
      }
    }
  };
  const instantiated = await WebAssembly.instantiate(module, imports);
  const instance = instantiated.instance ?? instantiated;
  instance.exports.run();

  const state = {};
  for (const [name, info] of Object.entries(metadata.stateExports ?? {})) {
    state[name] = Number(instance.exports[info.export].value);
  }
  return { output, state, instance };
}

function collectNumericBindings(instructions) {
  const names = [];
  const seen = new Set();
  for (const instruction of instructions) {
    if (instruction.code !== 'CREATE') continue;
    if (instruction.valueType !== 'number') {
      throw unsupported(`create ${instruction.valueType} at line ${instruction.line ?? '?'} is outside the direct numeric Wasm subset`);
    }
    if (seen.has(instruction.name)) {
      throw unsupported(`duplicate binding '${instruction.name}' is not valid for direct Wasm lowering`);
    }
    seen.add(instruction.name);
    names.push(instruction.name);
  }
  return names;
}

function collectRecipes(instructions) {
  const recipes = [];
  const seen = new Set();
  for (const instruction of instructions) {
    if (instruction.code !== 'MAKE') continue;
    if (seen.has(instruction.name)) throw unsupported(`recipe '${instruction.name}' is declared more than once`);
    seen.add(instruction.name);
    recipes.push(instruction);
  }
  return recipes;
}

function validateAcyclicRecipes(recipeList) {
  const recipes = new Map(recipeList.map(recipe => [recipe.name, recipe]));
  const visiting = new Set();
  const visited = new Set();

  const visit = name => {
    if (visited.has(name)) return;
    if (visiting.has(name)) throw unsupported(`recursive recipe cycle involving '${name}' is outside the direct Wasm subset`);
    visiting.add(name);
    const recipe = recipes.get(name);
    for (const target of collectCalls(recipe.body ?? [])) {
      if (!recipes.has(target)) throw unsupported(`recipe '${name}' calls unknown recipe '${target}'`);
      visit(target);
    }
    visiting.delete(name);
    visited.add(name);
  };

  for (const recipe of recipeList) visit(recipe.name);
}

function collectCalls(block, out = new Set()) {
  for (const instruction of block) {
    if (instruction.code === 'DO') out.add(instruction.name);
    if (instruction.code === 'IF') {
      collectCalls(instruction.then ?? [], out);
      collectCalls(instruction.else ?? [], out);
    }
    if (instruction.code === 'REPEAT') collectCalls(instruction.body ?? [], out);
  }
  return out;
}

function makeContext({ globals, defined, locals, recipes, scope, functionName, allowCreate, allowDefinitions, paramCount }) {
  return {
    globals,
    defined,
    locals,
    recipes,
    scope,
    functionName,
    allowCreate,
    allowDefinitions,
    instructions: [],
    allocator: {
      nextLocal: paramCount,
      declaredLocals: 0
    }
  };
}

function lowerBlock(block, ctx) {
  for (const instruction of block) lowerInstruction(instruction, ctx);
}

function childContext(ctx, instructions, locals = ctx.locals) {
  return {
    globals: ctx.globals,
    defined: ctx.defined,
    locals,
    recipes: ctx.recipes,
    scope: ctx.scope,
    functionName: ctx.functionName,
    allowCreate: false,
    allowDefinitions: false,
    allocator: ctx.allocator,
    instructions
  };
}

function lowerInstruction(instruction, ctx) {
  const { globals, defined, instructions } = ctx;
  switch (instruction.code) {
    case 'ALLOW_CHANGES':
      if (!ctx.allowDefinitions) throw unsupported(`allow declaration at line ${instruction.line ?? '?'} must be top level for direct execution`);
      // The production compiler already validated Change Capabilities. There is
      // no runtime instruction for the declaration itself.
      return;

    case 'MAKE':
      if (!ctx.allowDefinitions) throw unsupported(`nested recipe '${instruction.name}' is outside the direct Wasm subset`);
      // Recipe definitions are emitted as separate Wasm functions.
      return;

    case 'CREATE': {
      if (!ctx.allowCreate) {
        throw unsupported(`create '${instruction.name}' at line ${instruction.line ?? '?'} is only supported at top level by the direct backend`);
      }
      if (instruction.valueType !== 'number') {
        throw unsupported(`only numeric create is directly lowered, got ${instruction.valueType}`);
      }
      const index = requireGlobal(instruction.name, globals, instruction.line);
      instructions.push(...compileNumericExpression(instruction.expr, ctx, instruction.line));
      instructions.push(0x24, ...u32(index)); // global.set
      defined.add(instruction.name);
      return;
    }

    case 'CHANGE': {
      const index = requireDefinedNumeric(instruction.target, globals, defined, instruction.line);
      for (const operation of instruction.operations) {
        if (operation.field) {
          throw unsupported(`field change '${instruction.target}.${operation.field}' at line ${operation.line ?? instruction.line ?? '?'} is outside the direct numeric Wasm subset`);
        }
        if (operation.op === 'clear') {
          instructions.push(...f64Const(0), 0x24, ...u32(index));
          continue;
        }
        if (!['set', 'add', 'remove'].includes(operation.op)) {
          throw unsupported(`change operation '${operation.op}' at line ${operation.line ?? instruction.line ?? '?'} is not directly lowered yet`);
        }
        const expr = compileNumericExpression(operation.expr, ctx, operation.line ?? instruction.line);
        if (operation.op === 'set') {
          instructions.push(...expr, 0x24, ...u32(index));
        } else {
          instructions.push(0x23, ...u32(index)); // global.get current target
          instructions.push(...expr);
          instructions.push(operation.op === 'add' ? 0xa0 : 0xa1); // f64.add / f64.sub
          instructions.push(0x24, ...u32(index));
        }
      }
      return;
    }

    case 'SHOW':
      instructions.push(...compileNumericExpression(instruction.expr, ctx, instruction.line));
      instructions.push(0x10, ...u32(0)); // call imported patch.show_number
      return;

    case 'IF': {
      const condition = compileBooleanExpression(instruction.expr, ctx, instruction.line);
      const thenInstructions = [];
      const elseInstructions = [];
      lowerBlock(instruction.then ?? [], childContext(ctx, thenInstructions));
      lowerBlock(instruction.else ?? [], childContext(ctx, elseInstructions));

      instructions.push(...condition, 0x04, 0x40); // if, empty block type
      instructions.push(...thenInstructions);
      if (elseInstructions.length) instructions.push(0x05, ...elseInstructions); // else
      instructions.push(0x0b); // end if
      return;
    }

    case 'REPEAT': {
      const repeatCount = literalRepeatCount(instruction.expr, instruction.line);
      const remainingLocal = allocateI32Local(ctx);
      const countLocal = allocateI32Local(ctx);
      const bodyInstructions = [];
      const bodyLocals = new Map(ctx.locals);
      bodyLocals.set('count', { index: countLocal, kind: 'i32-number' });
      lowerBlock(instruction.body ?? [], childContext(ctx, bodyInstructions, bodyLocals));

      instructions.push(...i32Const(repeatCount), 0x21, ...u32(remainingLocal));
      instructions.push(...i32Const(1), 0x21, ...u32(countLocal));
      instructions.push(0x02, 0x40); // block
      instructions.push(0x03, 0x40); // loop
      instructions.push(0x20, ...u32(remainingLocal), 0x45, 0x0d, ...u32(1)); // br_if outer block
      instructions.push(...bodyInstructions);
      instructions.push(0x20, ...u32(remainingLocal), ...i32Const(1), 0x6b, 0x21, ...u32(remainingLocal));
      instructions.push(0x20, ...u32(countLocal), ...i32Const(1), 0x6a, 0x21, ...u32(countLocal));
      instructions.push(0x0c, ...u32(0)); // br loop
      instructions.push(0x0b, 0x0b); // end loop, end block
      return;
    }

    case 'DO': {
      const recipe = ctx.recipes.get(instruction.name);
      if (!recipe) throw unsupported(`call to unknown recipe '${instruction.name}' at line ${instruction.line ?? '?'}`);
      if ((instruction.args ?? []).length !== recipe.params.length) {
        throw unsupported(`recipe '${instruction.name}' expects ${recipe.params.length} argument(s), got ${(instruction.args ?? []).length} at line ${instruction.line ?? '?'}`);
      }
      if (ctx.scope === 'program' && ctx.defined.size !== ctx.globals.size) {
        throw unsupported(`all top-level numeric bindings must be created before calling recipe '${instruction.name}' directly`);
      }
      for (const arg of instruction.args ?? []) instructions.push(...compileNumericExpression(arg, ctx, instruction.line));
      instructions.push(0x10, ...u32(recipe.functionIndex));
      return;
    }

    case 'RETURN':
      throw unsupported(`return at line ${instruction.line ?? '?'} is not in the direct recipe subset yet`);

    default:
      throw unsupported(`${instruction.code} at line ${instruction.line ?? '?'} is not in the direct Wasm execution subset`);
  }
}

function emitParameterRangeGuards(recipe, ctx) {
  for (const [name, range] of Object.entries(recipe.paramRanges ?? {})) {
    const local = ctx.locals.get(name);
    if (!local || local.kind !== 'f64-number') throw unsupported(`range guard parameter '${name}' has no numeric Wasm parameter`);
    // if param < min: unreachable
    ctx.instructions.push(0x20, ...u32(local.index), ...f64Const(range.min), 0x63, 0x04, 0x40, 0x00, 0x0b);
    // if param > max: unreachable
    ctx.instructions.push(0x20, ...u32(local.index), ...f64Const(range.max), 0x64, 0x04, 0x40, 0x00, 0x0b);
  }
}

function allocateI32Local(ctx) {
  const index = ctx.allocator.nextLocal;
  ctx.allocator.nextLocal += 1;
  ctx.allocator.declaredLocals += 1;
  return index;
}

function literalRepeatCount(source, line) {
  const text = String(source ?? '').trim();
  if (!/^\d+$/.test(text)) {
    throw unsupported(`repeat count '${text || '?'}' at line ${line ?? '?'} must be a literal whole number in the direct subset`);
  }
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count < 0 || count > 100000) {
    throw unsupported(`repeat count at line ${line ?? '?'} must be from 0 to 100000`);
  }
  return count;
}

function requireGlobal(name, globals, line) {
  if (!globals.has(name)) throw unsupported(`numeric binding '${name}' at line ${line ?? '?'} has no direct Wasm global`);
  return globals.get(name);
}

function requireDefinedNumeric(name, globals, defined, line) {
  const index = requireGlobal(name, globals, line);
  if (!defined.has(name)) throw unsupported(`'${name}' is used before its create at line ${line ?? '?'}`);
  return index;
}

function compileNumericExpression(source, ctx, line) {
  const compiled = compileExpression(source, ctx, line);
  if (compiled.kind !== 'f64-number') {
    throw unsupported(`expression '${String(source).trim()}' at line ${line ?? '?'} is boolean where a number is required`);
  }
  return compiled.code;
}

function compileBooleanExpression(source, ctx, line) {
  const compiled = compileExpression(source, ctx, line);
  if (compiled.kind !== 'i32-bool') {
    throw unsupported(`condition '${String(source).trim()}' at line ${line ?? '?'} must be a boolean or comparison in the direct subset`);
  }
  return compiled.code;
}

function compileExpression(source, ctx, line) {
  if (source === null || source === undefined || !String(source).trim()) {
    throw unsupported(`missing expression at line ${line ?? '?'}`);
  }
  try {
    return new DirectExpressionCompiler(String(source), ctx).compile();
  } catch (err) {
    if (err instanceof DirectWasmUnsupportedError) {
      throw unsupported(`${stripDirectPrefix(err.message)}${line ? ` at line ${line}` : ''}`);
    }
    throw err;
  }
}

class DirectExpressionCompiler {
  constructor(source, ctx) {
    this.tokens = tokenizeDirect(source);
    this.i = 0;
    this.ctx = ctx;
  }

  peek(type, text) {
    const token = this.tokens[this.i];
    return token?.type === type && (text === undefined || token.text === text);
  }

  take(type, text) {
    const token = this.tokens[this.i];
    if (!this.peek(type, text)) throw unsupported(`expected '${text ?? type}', found '${token?.text ?? 'end of expression'}'`);
    this.i += 1;
    return token;
  }

  compile() {
    const value = this.or();
    if (!this.peek('eof')) throw unsupported(`unexpected '${this.tokens[this.i].text}' in expression`);
    return value;
  }

  or() {
    let left = this.and();
    while (this.peek('word', 'or')) {
      this.i += 1;
      const right = this.and();
      requireKind(left, 'i32-bool', 'or');
      requireKind(right, 'i32-bool', 'or');
      left = { kind: 'i32-bool', code: [...left.code, ...right.code, 0x72] }; // i32.or
    }
    return left;
  }

  and() {
    let left = this.equality();
    while (this.peek('word', 'and')) {
      this.i += 1;
      const right = this.equality();
      requireKind(left, 'i32-bool', 'and');
      requireKind(right, 'i32-bool', 'and');
      left = { kind: 'i32-bool', code: [...left.code, ...right.code, 0x71] }; // i32.and
    }
    return left;
  }

  equality() {
    let left = this.comparison();
    while (this.peek('==') || this.peek('!=')) {
      const op = this.tokens[this.i++].type;
      const right = this.comparison();
      if (left.kind !== right.kind) throw unsupported(`${op} requires two values of the same direct expression kind`);
      if (left.kind === 'f64-number') {
        left = { kind: 'i32-bool', code: [...left.code, ...right.code, op === '==' ? 0x61 : 0x62] }; // f64.eq/ne
      } else if (left.kind === 'i32-bool') {
        left = { kind: 'i32-bool', code: [...left.code, ...right.code, op === '==' ? 0x46 : 0x47] }; // i32.eq/ne
      } else {
        throw unsupported(`${op} is unsupported for ${left.kind}`);
      }
    }
    return left;
  }

  comparison() {
    let left = this.additive();
    while (this.peek('<') || this.peek('>') || this.peek('<=') || this.peek('>=')) {
      const op = this.tokens[this.i++].type;
      const right = this.additive();
      requireKind(left, 'f64-number', op);
      requireKind(right, 'f64-number', op);
      const opcode = { '<': 0x63, '>': 0x64, '<=': 0x65, '>=': 0x66 }[op];
      left = { kind: 'i32-bool', code: [...left.code, ...right.code, opcode] };
    }
    return left;
  }

  additive() {
    let left = this.multiplicative();
    while (this.peek('+') || this.peek('-')) {
      const op = this.tokens[this.i++].type;
      const right = this.multiplicative();
      requireKind(left, 'f64-number', op);
      requireKind(right, 'f64-number', op);
      left = { kind: 'f64-number', code: [...left.code, ...right.code, op === '+' ? 0xa0 : 0xa1] };
    }
    return left;
  }

  multiplicative() {
    let left = this.unary();
    while (this.peek('*') || this.peek('/') || this.peek('%')) {
      const op = this.tokens[this.i++].type;
      if (op === '%') throw unsupported("'%' is not in the direct Wasm numeric subset yet");
      const right = this.unary();
      requireKind(left, 'f64-number', op);
      requireKind(right, 'f64-number', op);
      left = { kind: 'f64-number', code: [...left.code, ...right.code, op === '*' ? 0xa2 : 0xa3] };
    }
    return left;
  }

  unary() {
    if (this.peek('-')) {
      this.i += 1;
      const value = this.unary();
      requireKind(value, 'f64-number', 'unary -');
      return { kind: 'f64-number', code: [...value.code, 0x9a] }; // f64.neg
    }
    if (this.peek('word', 'not')) {
      this.i += 1;
      const value = this.unary();
      requireKind(value, 'i32-bool', 'not');
      return { kind: 'i32-bool', code: [...value.code, 0x45] }; // i32.eqz
    }
    return this.primary();
  }

  primary() {
    if (this.peek('number')) return { kind: 'f64-number', code: f64Const(this.take('number').value) };

    if (this.peek('word', 'true')) {
      this.i += 1;
      return { kind: 'i32-bool', code: i32Const(1) };
    }
    if (this.peek('word', 'false')) {
      this.i += 1;
      return { kind: 'i32-bool', code: i32Const(0) };
    }

    if (this.peek('word')) {
      const name = this.take('word').text;
      const local = this.ctx.locals.get(name);
      if (local) {
        if (local.kind === 'f64-number') return { kind: 'f64-number', code: [0x20, ...u32(local.index)] };
        if (local.kind === 'i32-number') return { kind: 'f64-number', code: [0x20, ...u32(local.index), 0xb7] }; // f64.convert_i32_s
        throw unsupported(`unsupported local representation for '${name}'`);
      }
      if (!this.ctx.globals.has(name)) throw unsupported(`'${name}' is not a numeric persistent binding or recipe parameter`);
      if (!this.ctx.defined.has(name)) throw unsupported(`'${name}' is referenced before its create`);
      return { kind: 'f64-number', code: [0x23, ...u32(this.ctx.globals.get(name))] };
    }

    if (this.peek('(')) {
      this.i += 1;
      const value = this.or();
      this.take(')');
      return value;
    }

    throw unsupported(`unexpected '${this.tokens[this.i]?.text ?? 'end of expression'}' in expression`);
  }
}

function requireKind(value, expected, operator) {
  if (value.kind !== expected) throw unsupported(`operator '${operator}' requires ${expected === 'f64-number' ? 'numbers' : 'booleans'}`);
}

function tokenizeDirect(source) {
  const text = source.trim();
  const out = [];
  const token = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|\+|-|\*|\/|%|<|>|\(|\)))/gy;
  let pos = 0;
  while (pos < text.length) {
    token.lastIndex = pos;
    const match = token.exec(text);
    if (!match) throw unsupported(`cannot directly lower expression near '${text.slice(pos)}'`);
    pos = token.lastIndex;
    if (match[1] !== undefined) out.push({ type: 'number', value: Number(match[1]), text: match[1] });
    else if (match[2] !== undefined) out.push({ type: 'word', text: match[2] });
    else out.push({ type: match[3], text: match[3] });
  }
  out.push({ type: 'eof', text: 'end of expression' });
  return out;
}

function buildModule({ globalCount, runFunction, recipeFunctions, stateExports }) {
  const globals = Array.from({ length: globalCount }, () => globalF64(0));
  const types = [
    funcType([0x7c], []), // type 0: host show_number(f64)
    funcType([], []),     // type 1: run()
    ...recipeFunctions.map(recipe => funcType(Array(recipe.params.length).fill(0x7c), []))
  ];
  const functionTypeIndices = [
    u32(1),
    ...recipeFunctions.map(recipe => u32(recipe.typeIndex))
  ];
  const exports = [exportEntry('run', 0x00, 1)];
  for (const info of Object.values(stateExports)) exports.push(exportEntry(info.export, 0x03, info.globalIndex));
  const bodies = [
    functionBody(runFunction.instructions, runFunction.localCount),
    ...recipeFunctions.map(recipe => functionBody(recipe.instructions, recipe.localCount))
  ];

  return bytes(
    [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    section(1, vec(types)),
    section(2, vec([importFunction('patch', 'show_number', 0)])),
    section(3, vec(functionTypeIndices)),
    globals.length ? section(6, vec(globals)) : null,
    section(7, vec(exports)),
    section(10, vec(bodies))
  );
}

function stripDirectPrefix(message) {
  return String(message).replace(/^Direct Wasm:\s*/, '').replace(/\.$/, '');
}

function unsupported(message) {
  return new DirectWasmUnsupportedError(`Direct Wasm: ${message}.`);
}

function funcType(params, results) {
  return bytes([0x60], u32(params.length), params, u32(results.length), results);
}

function importFunction(moduleName, fieldName, typeIndex) {
  return bytes(nameBytes(moduleName), nameBytes(fieldName), [0x00], u32(typeIndex));
}

function globalF64(value) {
  return bytes([0x7c, 0x01], f64Const(value), [0x0b]);
}

function functionBody(instructions, localCount) {
  const locals = localCount > 0
    ? bytes(u32(1), u32(localCount), [0x7f]) // one local declaration group: N x i32
    : u32(0);
  const payload = bytes(locals, instructions, [0x0b]);
  return bytes(u32(payload.length), payload);
}

function f64Const(value) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, Number(value), true);
  return bytes([0x44], new Uint8Array(buffer));
}

function i32Const(value) {
  return bytes([0x41], s32(value));
}

function exportEntry(name, kind, index) {
  return bytes(nameBytes(name), [kind], u32(index));
}

function nameBytes(text) {
  const encoded = new TextEncoder().encode(text);
  return bytes(u32(encoded.length), encoded);
}

function section(id, payload) {
  return bytes([id], u32(payload.length), payload);
}

function vec(items) {
  return bytes(u32(items.length), ...items);
}

function u32(value) {
  const out = [];
  let n = Number(value) >>> 0;
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) byte |= 0x80;
    out.push(byte);
  } while (n !== 0);
  return out;
}

function s32(value) {
  const out = [];
  let n = Number(value) | 0;
  let more = true;
  while (more) {
    let byte = n & 0x7f;
    n >>= 7;
    const signBit = (byte & 0x40) !== 0;
    more = !((n === 0 && !signBit) || (n === -1 && signBit));
    if (more) byte |= 0x80;
    out.push(byte);
  }
  return out;
}

function bytes(...parts) {
  const flat = [];
  for (const part of parts) {
    if (part == null) continue;
    if (part instanceof Uint8Array) flat.push(...part);
    else if (Array.isArray(part)) flat.push(...part);
    else flat.push(part);
  }
  return Uint8Array.from(flat);
}
