export class ExpressionError extends Error {}

const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|\+|-|\*|\/|%|<|>|\(|\)|\[|\]|,|\.))/gy;

function tokenize(source) {
  const tokens = [];
  let pos = 0;
  while (pos < source.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(source);
    if (!m) throw new ExpressionError(`I do not understand this expression near: ${source.slice(pos)}`);
    pos = TOKEN.lastIndex;
    if (m[1] !== undefined) tokens.push({ type: 'number', value: Number(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'string', value: JSON.parse(m[2][0] === "'" ? `"${m[2].slice(1,-1).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"` : m[2]) });
    else if (m[3] !== undefined) tokens.push({ type: 'word', value: m[3] });
    else tokens.push({ type: m[4], value: m[4] });
  }
  tokens.push({ type: 'eof', value: null });
  return tokens;
}

export function lookupPath(env, path) {
  const parts = Array.isArray(path) ? path : String(path).split('.');
  const root = parts[0];
  let value;
  if (env.locals && Object.prototype.hasOwnProperty.call(env.locals, root)) value = env.locals[root];
  else if (env.state && env.state.has(root)) value = env.state.get(root);
  else throw new ExpressionError(`I cannot find '${root}'. Create it first.`);
  for (const part of parts.slice(1)) {
    if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) throw new ExpressionError(`I cannot find '${parts.join('.')}'.`);
    value = value[part];
  }
  return value;
}

class Parser {
  constructor(tokens, env) { this.tokens = tokens; this.i = 0; this.env = env; }
  peek(type, value) { const t = this.tokens[this.i]; return t.type === type && (value === undefined || t.value === value); }
  take(type, value) { const t = this.tokens[this.i]; if (!this.peek(type, value)) throw new ExpressionError(`Expected ${value ?? type}.`); this.i += 1; return t; }
  parse() { const v = this.or(); if (!this.peek('eof')) throw new ExpressionError(`Unexpected '${this.tokens[this.i].value}'.`); return v; }
  or() { let v = this.and(); while (this.peek('word','or')) { this.i++; const r=this.and(); v=Boolean(v)||Boolean(r); } return v; }
  and() { let v = this.equality(); while (this.peek('word','and')) { this.i++; const r=this.equality(); v=Boolean(v)&&Boolean(r); } return v; }
  equality() { let v=this.comparison(); while(this.peek('==')||this.peek('!=')){const op=this.tokens[this.i++].type;const r=this.comparison();v=op==='=='?deepEqual(v,r):!deepEqual(v,r);} return v; }
  comparison() { let v=this.term(); while(['<','>','<=','>='].some(x=>this.peek(x))){const op=this.tokens[this.i++].type;const r=this.term();if(op==='<')v=v<r;else if(op==='>')v=v>r;else if(op==='<=')v=v<=r;else v=v>=r;} return v; }
  term() { let v=this.factor(); while(this.peek('+')||this.peek('-')){const op=this.tokens[this.i++].type;const r=this.factor();v=op==='+'?v+r:v-r;} return v; }
  factor() { let v=this.unary(); while(this.peek('*')||this.peek('/')||this.peek('%')){const op=this.tokens[this.i++].type;const r=this.unary();if(op==='*')v*=r;else if(op==='/')v/=r;else v%=r;} return v; }
  unary() { if(this.peek('-')){this.i++;return -Number(this.unary());} if(this.peek('word','not')){this.i++;return !Boolean(this.unary());} return this.primary(); }
  primary() {
    if(this.peek('number')) return this.tokens[this.i++].value;
    if(this.peek('string')) return this.tokens[this.i++].value;
    if(this.peek('word','true')){this.i++;return true;} if(this.peek('word','false')){this.i++;return false;}
    if(this.peek('word')){const parts=[this.tokens[this.i++].value];while(this.peek('.')){this.i++;parts.push(this.take('word').value);}return lookupPath(this.env,parts);}
    if(this.peek('(')){this.i++;const v=this.or();this.take(')');return v;}
    if(this.peek('[')){this.i++;const out=[];if(!this.peek(']')){while(true){out.push(this.or());if(this.peek(',')){this.i++;continue;}break;}}this.take(']');return out;}
    throw new ExpressionError(`Unexpected '${this.tokens[this.i].value ?? 'end of expression'}'.`);
  }
}

export function evaluateExpression(source, env) { return new Parser(tokenize(source.trim()), env).parse(); }
export function evaluateLoose(source, env) {
  const s=source.trim();
  try { return evaluateExpression(s, env); }
  catch(err){ if(err instanceof ExpressionError && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(s)) return s; throw err; }
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) if (!deepEqual(a[index], b[index])) return false;
    return true;
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let index = 0; index < aKeys.length; index += 1) {
    const key = aKeys[index];
    if (key !== bKeys[index] || !Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key])) return false;
  }
  return true;
}
