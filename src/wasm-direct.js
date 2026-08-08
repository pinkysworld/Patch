import { compile } from './compiler.js';

export const PATCH_DIRECT_WASM_VERSION = '0.1-core';

export class DirectWasmUnsupportedError extends Error {}

/**
 * Compile a deliberately small numeric console subset of Patch directly to
 * executable WebAssembly instructions. Unlike the bootstrap backend, the
 * resulting module executes the lowered Patch operations itself.
 *
 * Supported in this first slice:
 *   - create number
 *   - change number: set/add/remove/clear
 *   - show numeric expressions
 *   - numeric expressions with literals, earlier numeric bindings, + - * /
 *   - allow declarations (compile-time only, therefore no runtime code)
 */
export function compileToDirectWasm(source, options = {}) {
  const compiled = compile(source, options);
  if (compiled.project.kind !== 'console') {
    throw unsupported('direct Wasm beta supports console projects only');
  }

  const numericNames = collectNumericBindings(compiled.ir.instructions);
  const globals = new Map(numericNames.map((name, index) => [name, index]));
  const defined = new Set();
  const instructions = [];

  for (const instruction of compiled.ir.instructions) {
    lowerInstruction(instruction, { globals, defined, instructions });
  }

  const stateExports = Object.fromEntries(numericNames.map((name, index) => [name, {
    export: `patch_state_${name}`,
    globalIndex: index
  }]));

  const module = buildModule(numericNames.length, instructions, stateExports);
  const metadata = {
    format: 'patch-wasm-direct',
    version: PATCH_DIRECT_WASM_VERSION,
    project: compiled.project,
    irVersion: compiled.ir.version,
    numericModel: 'wasm-f64 / JavaScript Number subset',
    hostAbi: { module: 'patch', showNumber: 'show_number(f64) -> void' },
    stateExports,
    supported: [
      'create number',
      'change number set/add/remove/clear',
      'show numeric expression',
      'numeric literals and earlier bindings',
      'numeric + - * /',
      'compile-time allow declarations'
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

function lowerInstruction(instruction, ctx) {
  const { globals, defined, instructions } = ctx;
  switch (instruction.code) {
    case 'ALLOW_CHANGES':
      return;
    case 'CREATE': {
      if (instruction.valueType !== 'number') {
        throw unsupported(`only numeric create is directly lowered, got ${instruction.valueType}`);
      }
      const index = requireGlobal(instruction.name, globals, instruction.line);
      instructions.push(...compileNumericExpression(instruction.expr, globals, defined, instruction.line));
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
        const expr = compileNumericExpression(operation.expr, globals, defined, operation.line ?? instruction.line);
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
      instructions.push(...compileNumericExpression(instruction.expr, globals, defined, instruction.line));
      instructions.push(0x10, ...u32(0)); // call imported patch.show_number
      return;
    default:
      throw unsupported(`${instruction.code} at line ${instruction.line ?? '?'} is not in the first direct Wasm execution subset`);
  }
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

function compileNumericExpression(source, globals, defined, line) {
  if (source === null || source === undefined || !String(source).trim()) {
    throw unsupported(`missing numeric expression at line ${line ?? '?'}`);
  }
  try {
    const parser = new NumericExpressionCompiler(String(source), globals, defined);
    return parser.compile();
  } catch (err) {
    if (err instanceof DirectWasmUnsupportedError) {
      throw unsupported(`${err.message}${line ? ` at line ${line}` : ''}`);
    }
    throw err;
  }
}

class NumericExpressionCompiler {
  constructor(source, globals, defined) {
    this.tokens = tokenizeNumeric(source);
    this.i = 0;
    this.globals = globals;
    this.defined = defined;
  }
  peek(type) { return this.tokens[this.i]?.type === type; }
  take(type) {
    const token = this.tokens[this.i];
    if (!token || token.type !== type) throw unsupported(`expected '${type}', found '${token?.text ?? 'end of expression'}'`);
    this.i += 1;
    return token;
  }
  compile() {
    const code = this.additive();
    if (!this.peek('eof')) throw unsupported(`unexpected '${this.tokens[this.i].text}' in numeric expression`);
    return code;
  }
  additive() {
    let code = this.multiplicative();
    while (this.peek('+') || this.peek('-')) {
      const op = this.tokens[this.i++].type;
      const right = this.multiplicative();
      code = [...code, ...right, op === '+' ? 0xa0 : 0xa1];
    }
    return code;
  }
  multiplicative() {
    let code = this.unary();
    while (this.peek('*') || this.peek('/') || this.peek('%')) {
      const op = this.tokens[this.i++].type;
      if (op === '%') throw unsupported("'%' is not in the direct Wasm numeric subset yet");
      const right = this.unary();
      code = [...code, ...right, op === '*' ? 0xa2 : 0xa3];
    }
    return code;
  }
  unary() {
    if (this.peek('-')) {
      this.i += 1;
      return [...this.unary(), 0x9a]; // f64.neg
    }
    return this.primary();
  }
  primary() {
    if (this.peek('number')) return f64Const(this.take('number').value);
    if (this.peek('word')) {
      const name = this.take('word').text;
      if (!this.globals.has(name)) throw unsupported(`'${name}' is not a numeric persistent binding`);
      if (!this.defined.has(name)) throw unsupported(`'${name}' is referenced before its create`);
      return [0x23, ...u32(this.globals.get(name))];
    }
    if (this.peek('(')) {
      this.i += 1;
      const code = this.additive();
      this.take(')');
      return code;
    }
    throw unsupported(`unexpected '${this.tokens[this.i]?.text ?? 'end of expression'}' in numeric expression`);
  }
}

function tokenizeNumeric(source) {
  const text = source.trim();
  const out = [];
  const token = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\+|-|\*|\/|%|\(|\)))/gy;
  let pos = 0;
  while (pos < text.length) {
    token.lastIndex = pos;
    const match = token.exec(text);
    if (!match) throw unsupported(`cannot directly lower numeric expression near '${text.slice(pos)}'`);
    pos = token.lastIndex;
    if (match[1] !== undefined) out.push({ type: 'number', value: Number(match[1]), text: match[1] });
    else if (match[2] !== undefined) out.push({ type: 'word', text: match[2] });
    else out.push({ type: match[3], text: match[3] });
  }
  out.push({ type: 'eof', text: 'end of expression' });
  return out;
}

function buildModule(globalCount, runInstructions, stateExports) {
  const globals = Array.from({ length: globalCount }, () => globalF64(0));
  const exports = [exportEntry('run', 0x00, 1)]; // function 0 is imported show_number
  for (const info of Object.values(stateExports)) exports.push(exportEntry(info.export, 0x03, info.globalIndex));

  return bytes(
    [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    section(1, vec([
      funcType([0x7c], []), // (f64) -> void host output
      funcType([], [])      // () -> void Patch run
    ])),
    section(2, vec([importFunction('patch', 'show_number', 0)])),
    section(3, vec([u32(1)])),
    globals.length ? section(6, vec(globals)) : null,
    section(7, vec(exports)),
    section(10, vec([functionBody(runInstructions)]))
  );
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

function functionBody(instructions) {
  const payload = bytes([0x00], instructions, [0x0b]); // zero local groups + code + end
  return bytes(u32(payload.length), payload);
}

function f64Const(value) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, Number(value), true);
  return bytes([0x44], new Uint8Array(buffer));
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
