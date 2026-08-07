import { parse, PatchSyntaxError } from './parser.js';
import { evaluateExpression, evaluateLoose, ExpressionError } from './expression.js';
import { clone, formatValue, applySemanticOperations } from './change.js';

export class PatchRuntimeError extends Error {
  constructor(message, line = null) { super(line ? `line ${line}: ${message}` : message); this.line = line; }
}
class ReturnSignal { constructor(value) { this.value = value; } }

export class PatchInterpreter {
  constructor() { this.reset(); }
  reset() {
    this.state=new Map(); this.types=new Map(); this.versions=new Map(); this.history=[]; this.redoStack=[];
    this.watchers=new Set(); this.functions=new Map(); this.output=[]; this.changeCounter=0;
  }
  run(source,{reset=true}={}) {
    if(reset)this.reset(); else this.output=[];
    try { const program=parse(source); this.executeBlock(program,{}); return this.result(); }
    catch(err){ if(err instanceof PatchSyntaxError||err instanceof PatchRuntimeError||err instanceof ExpressionError)throw err; throw new PatchRuntimeError(err.message); }
  }
  result(){ return {output:[...this.output],state:Object.fromEntries([...this.state].map(([k,v])=>[k,clone(v)])),history:clone(this.history)}; }
  env(locals={}){ return {state:this.state,locals}; }
  executeBlock(nodes,locals){ for(const node of nodes){const signal=this.execute(node,locals);if(signal instanceof ReturnSignal)return signal;} return null; }
  execute(node,locals){
    try {
      switch(node.kind){
        case 'create': return this.create(node,locals);
        case 'createThing': return this.createThing(node,locals);
        case 'show': this.output.push(formatValue(evaluateExpression(node.expr,this.env(locals)))); return;
        case 'watch': this.requireTarget(node.target,node.line); this.watchers.add(node.target); this.output.push(`watching ${node.target}`); return;
        case 'history': return this.showHistory(node.target,node.line);
        case 'change': return this.applyChange(node,locals,false);
        case 'undo': return this.undo(node.name,node.line);
        case 'redo': return this.redo(node.line);
        case 'preview': return this.preview(node.body,locals);
        case 'if': return this.executeBlock(Boolean(evaluateExpression(node.expr,this.env(locals)))?node.thenBody:node.elseBody,locals);
        case 'repeat': {
          const count=Number(evaluateExpression(node.expr,this.env(locals)));
          if(!Number.isInteger(count)||count<0||count>100000)throw new PatchRuntimeError('repeat needs a whole number from 0 to 100000.',node.line);
          for(let i=0;i<count;i++){const signal=this.executeBlock(node.body,{...locals,count:i+1});if(signal instanceof ReturnSignal)return signal;} return;
        }
        case 'function': this.functions.set(node.name,node); return;
        case 'call': return this.call(node,locals);
        case 'return': return new ReturnSignal(node.expr?evaluateExpression(node.expr,this.env(locals)):null);
        case 'field': throw new PatchRuntimeError('Field declarations only belong inside create thing.',node.line);
        case 'changeOp': throw new PatchRuntimeError('Change operations only belong inside change.',node.line);
        default: throw new PatchRuntimeError(`Unknown instruction ${node.kind}.`,node.line);
      }
    } catch(err){ if(err instanceof PatchRuntimeError)throw err; if(err instanceof ExpressionError)throw new PatchRuntimeError(err.message,node.line); throw err; }
  }
  create(node,locals){
    if(this.state.has(node.name))throw new PatchRuntimeError(`'${node.name}' already exists. Use change to modify it.`,node.line);
    let value=node.valueType==='list'?this.parseList(node.expr,locals):evaluateExpression(node.expr,this.env(locals));
    if(node.valueType==='number'&&typeof value!=='number')throw new PatchRuntimeError(`${node.name} must start as a number.`,node.line);
    if(node.valueType==='text'&&typeof value!=='string')throw new PatchRuntimeError(`${node.name} must start as text in quotes.`,node.line);
    if(node.valueType==='boolean'&&typeof value!=='boolean')throw new PatchRuntimeError(`${node.name} must start as true or false.`,node.line);
    this.state.set(node.name,clone(value));this.types.set(node.name,node.valueType);this.versions.set(node.name,0);
  }
  createThing(node,locals){
    if(this.state.has(node.name))throw new PatchRuntimeError(`'${node.name}' already exists.`,node.line);
    const value={}; for(const field of node.fields)value[field.name]=evaluateLoose(field.expr,this.env(locals));
    this.state.set(node.name,value);this.types.set(node.name,'thing');this.versions.set(node.name,0);
  }
  parseList(expr,locals){ const text=expr.trim(); if(text.startsWith('['))return evaluateExpression(text,this.env(locals)); return splitComma(text).map(part=>evaluateLoose(part,this.env(locals))); }
  requireTarget(name,line){ if(!this.state.has(name))throw new PatchRuntimeError(`I cannot change '${name}' because it does not exist.`,line); }
  applyChange(node,locals,previewOnly){
    this.requireTarget(node.target,node.line); const before=clone(this.state.get(node.target)); let current=clone(before); const operations=[]; const inverseOperations=[];
    for(const op of node.ops){
      const field=op.field;
      if(field&&(current===null||typeof current!=='object'||Array.isArray(current)))throw new PatchRuntimeError(`'${node.target}' has no fields. Remove 'to ${field}' / 'from ${field}'.`,op.line);
      if(field&&!(field in current))throw new PatchRuntimeError(`'${node.target}' has no field called '${field}'.`,op.line);
      const old=field?current[field]:current; let semantic; let inverse;
      if(op.op==='set'){
        const value=evaluateLoose(op.expr,this.envWithTarget(locals,node.target,current)); semantic={op:'set',field,value:clone(value)}; inverse={op:'set',field,value:clone(old)};
      } else if(op.op==='add'){
        const value=evaluateLoose(op.expr,this.envWithTarget(locals,node.target,current));
        if(typeof old==='number'&&typeof value==='number'){semantic={op:'addNumber',field,value};inverse={op:'addNumber',field,value:-value};}
        else if(Array.isArray(old)){semantic={op:'append',field,value:clone(value)};inverse={op:'removeAt',field,index:old.length};}
        else if(typeof old==='string'){semantic={op:'appendText',field,value:String(value)};inverse={op:'set',field,value:old};}
        else throw new PatchRuntimeError('add works with numbers, lists, or text.',op.line);
      } else if(op.op==='remove'){
        const value=evaluateLoose(op.expr,this.envWithTarget(locals,node.target,current));
        if(typeof old==='number'&&typeof value==='number'){semantic={op:'removeNumber',field,value};inverse={op:'addNumber',field,value};}
        else if(Array.isArray(old)){const index=old.findIndex(x=>JSON.stringify(x)===JSON.stringify(value));if(index<0)throw new PatchRuntimeError(`Cannot remove ${formatValue(value)} because it is not in the list.`,op.line);semantic={op:'removeAt',field,index};inverse={op:'insertAt',field,index,value:clone(old[index])};}
        else throw new PatchRuntimeError('remove works with numbers or lists.',op.line);
      } else if(op.op==='clear'){ semantic={op:'clear',field}; inverse={op:'set',field,value:clone(old)}; }
      current=applySemanticOperations(current,[semantic]);operations.push(semantic);inverseOperations.unshift(inverse);
    }
    const baseVersion=this.versions.get(node.target)??0;
    const change={id:`c${++this.changeCounter}`,name:node.name,target:node.target,baseVersion,newVersion:baseVersion+1,operations,inverseOperations,before,after:clone(current)};
    if(previewOnly)return change; this.commit(change);
  }
  envWithTarget(locals,target,current){const temp=new Map(this.state);temp.set(target,current);return{state:temp,locals};}
  commit(change,{fromRedo=false}={}){
    this.state.set(change.target,clone(change.after));this.versions.set(change.target,change.newVersion);this.history.push(clone(change));if(!fromRedo)this.redoStack=[];
    if(this.watchers.has(change.target))this.output.push(`watch ${change.target}: ${formatValue(change.before)} -> ${formatValue(change.after)}`);
  }
  undo(name,line){
    if(!this.history.length)throw new PatchRuntimeError('There is nothing to undo.',line);
    const last=this.history[this.history.length-1]; if(name&&last.name!==name)throw new PatchRuntimeError(`Only the latest change can be undone safely. The latest change is ${last.name??last.id}.`,line);
    this.history.pop();this.state.set(last.target,applySemanticOperations(this.state.get(last.target),last.inverseOperations));this.versions.set(last.target,last.baseVersion);this.redoStack.push(last);
    if(this.watchers.has(last.target))this.output.push(`watch ${last.target}: undo -> ${formatValue(this.state.get(last.target))}`);
  }
  redo(line){
    if(!this.redoStack.length)throw new PatchRuntimeError('There is nothing to redo.',line);
    const change=this.redoStack.pop();const currentVersion=this.versions.get(change.target);if(currentVersion!==change.baseVersion)throw new PatchRuntimeError('That change can no longer be redone because the target changed.',line);this.commit(change,{fromRedo:true});
  }
  preview(body,locals){
    const snapshot={state:cloneMap(this.state),types:new Map(this.types),versions:new Map(this.versions),history:clone(this.history),redo:clone(this.redoStack),watchers:new Set(this.watchers),outputLength:this.output.length,counter:this.changeCounter};
    const beforeState=Object.fromEntries([...this.state].map(([k,v])=>[k,clone(v)]));this.executeBlock(body,locals);const afterState=Object.fromEntries([...this.state].map(([k,v])=>[k,clone(v)]));
    const previewOutput=this.output.splice(snapshot.outputLength);this.state=snapshot.state;this.types=snapshot.types;this.versions=snapshot.versions;this.history=snapshot.history;this.redoStack=snapshot.redo;this.watchers=snapshot.watchers;this.changeCounter=snapshot.counter;
    const diffs=[];for(const key of new Set([...Object.keys(beforeState),...Object.keys(afterState)]))if(JSON.stringify(beforeState[key])!==JSON.stringify(afterState[key]))diffs.push(`${key}: ${formatValue(beforeState[key])} -> ${formatValue(afterState[key])}`);
    this.output.push(diffs.length?`preview ${diffs.join(' | ')}`:'preview no changes');this.output.push(...previewOutput.map(x=>`preview output: ${x}`));
  }
  showHistory(target,line){this.requireTarget(target,line);const entries=this.history.filter(h=>h.target===target);if(!entries.length){this.output.push(`${target} has not changed yet`);return;}for(const h of entries)this.output.push(`${h.id}${h.name?` (${h.name})`:''}: ${formatValue(h.before)} -> ${formatValue(h.after)}`);}
  call(node,locals){
    const fn=this.functions.get(node.name);if(!fn)throw new PatchRuntimeError(`I cannot find a recipe called '${node.name}'.`,node.line);if(fn.params.length!==node.args.length)throw new PatchRuntimeError(`${node.name} needs ${fn.params.length} value(s).`,node.line);
    const args=node.args.map(a=>evaluateLoose(a,this.env(locals)));const childLocals={...locals};fn.params.forEach((p,idx)=>{childLocals[p]=args[idx];});const signal=this.executeBlock(fn.body,childLocals);return signal instanceof ReturnSignal?signal.value:null;
  }
}
function cloneMap(map){return new Map([...map].map(([k,v])=>[k,clone(v)]));}
function splitComma(text){const out=[];let cur='';let quote=null;let depth=0;for(const ch of text){if(quote){cur+=ch;if(ch===quote)quote=null;continue;}if(ch==='"'||ch==="'"){quote=ch;cur+=ch;continue;}if(ch==='['||ch==='(')depth++;if(ch===']'||ch===')')depth--;if(ch===','&&depth===0){if(cur.trim())out.push(cur.trim());cur='';continue;}cur+=ch;}if(cur.trim())out.push(cur.trim());return out;}
