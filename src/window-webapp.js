import { validateWindowBuild, validateWindowRuntimeSupport } from './window-build.js';

export const PATCH_WINDOW_WEB_VERSION = '0.8';

const WINDOW_WEB_SUPPORTED = new Set([
  'create', 'createThing', 'window', 'uiControl', 'tabs', 'tabPage', 'event', 'openForm', 'closeForm', 'allow', 'show',
  'change', 'if', 'repeat', 'function', 'call', 'return'
]);

/** Build a single-file executable browser app from the parsed Patch AST. */
export function buildStandaloneWindowWebApp(compiled, name) {
  const windowCount = validateWindowBuild(compiled);
  validateWindowRuntimeSupport(compiled);
  validateWindowWebSubset(compiled.ast);
  const programJson = scriptJson(compiled.ast);
  const appName = String(name || 'PatchApp');
  const metadata = {
    format: 'patch-standalone-window-web',
    version: PATCH_WINDOW_WEB_VERSION,
    irVersion: compiled.ir.version,
    projectKind: 'window',
    windows: windowCount,
    execution: 'generated-browser-window-runtime'
  };

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(appName)}</title>
<style>
:root{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark;background:#f3f4f6;color:#171717}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px;background:#f3f4f6}#app{max-width:760px;margin:0 auto;display:grid;gap:20px}.window,.console{overflow:hidden;border:1px solid #d4d4d8;border-radius:14px;background:#fff;box-shadow:0 20px 55px #0002;color:#18181b}.window header{padding:11px 15px;border-bottom:1px solid #e4e4e7;background:#f4f4f5;font-size:13px;font-weight:750}.body{min-height:220px;padding:28px;display:flex;flex-direction:column;align-items:flex-start;gap:16px}.text{margin:0;font-size:20px}.body button{border:0;border-radius:9px;background:#18181b;color:#fff;padding:10px 16px;font-weight:700;cursor:pointer}.body input,.body select{min-width:260px;border:1px solid #d4d4d8;border-radius:9px;padding:10px 12px;background:#fff;color:#18181b}.checkbox{display:flex;align-items:center;gap:9px;min-height:32px;cursor:pointer}.body .checkbox input{min-width:0;width:18px;height:18px;margin:0;padding:0;accent-color:#18181b}.patch-tabs{width:100%;min-height:180px;overflow:hidden;border:1px solid #d4d4d8;border-radius:10px;background:#fff}.patch-tabs-list{display:flex;align-items:center;gap:2px;padding:4px;border-bottom:1px solid #e4e4e7;background:#f4f4f5;overflow-x:auto}.body .patch-tab-button{min-height:30px;padding:5px 10px;background:transparent;color:#71717a;font-size:12px;white-space:nowrap}.body .patch-tab-button[aria-selected="true"]{background:#fff;color:#18181b;box-shadow:inset 0 0 0 1px #d4d4d8}.patch-tab-panel{min-height:138px;padding:16px;display:flex;flex-direction:column;align-items:flex-start;gap:12px;overflow:auto}.console{padding:20px}#output{max-width:760px;margin:18px auto 0;padding:14px;border-radius:10px;background:#18181b;color:#fafafa;white-space:pre-wrap;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}#output:empty{display:none}.badge{max-width:760px;margin:14px auto 0;color:#71717a;font-size:11px}@media(prefers-color-scheme:dark){:root,body{background:#111318;color:#f4f4f5}.window,.console{background:#1b1d22;color:#f4f4f5;border-color:#34363e}.window header{background:#24262d;border-color:#34363e}.body input,.body select{background:#17191e;color:#f4f4f5;border-color:#41444e}.body button{background:#f4f4f5;color:#18181b}.body .checkbox input{accent-color:#f4f4f5}.patch-tabs{background:#1b1d22;border-color:#41444e}.patch-tabs-list{background:#24262d;border-color:#34363e}.body .patch-tab-button{background:transparent;color:#a1a1aa}.body .patch-tab-button[aria-selected="true"]{background:#17191e;color:#f4f4f5;box-shadow:inset 0 0 0 1px #41444e}.badge{color:#a1a1aa}}
</style>
</head>
<body>
<main id="app"><section class="console"><strong>Starting Patch…</strong></section></main>
<pre id="output"></pre>
<div class="badge">Standalone single-file Patch Window Web App · beta runtime ${PATCH_WINDOW_WEB_VERSION}</div>
<script>
const PROGRAM=${programJson};
${windowRuntimeSource()}
</script>
</body>
</html>`;

  return { html, module: null, metadata, compiled, name: appName };
}

export function validateWindowWebSubset(ast) {
  const unsupported = [];
  walk(ast, node => {
    if (!WINDOW_WEB_SUPPORTED.has(node.kind)) unsupported.push(`line ${node.line ?? '?'}: ${node.kind}`);
  });
  if (unsupported.length) {
    throw new Error(`Standalone Window Web App does not yet support: ${unsupported.join(', ')}. Use the Studio Run preview or a Windows/macOS/Linux Window build for those features.`);
  }
}

function walk(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    if (node.body) walk(node.body, visit);
    if (node.thenBody) walk(node.thenBody, visit);
    if (node.elseBody) walk(node.elseBody, visit);
  }
}

function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

function windowRuntimeSource() {
  return String.raw`
class PatchAppError extends Error {}
class ReturnSignal { constructor(value){ this.value=value; } }
const state=new Map();
const functions=new Map();
const windows=[];
const events=[];
const formVisibility=new Map();
const tabSelections=new Map();
let namedFormCount=0;
let output=[];
const appEl=document.getElementById('app');
const outputEl=document.getElementById('output');

function clone(value){ return value===undefined?undefined:structuredClone(value); }
function formatValue(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.join(', ');
  if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>k+'='+formatValue(v)).join(', ');
  return String(value);
}
function deepEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}

const TOKEN=/\s*(?:(\d+(?:\.\d+)?)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|([A-Za-z_][A-Za-z0-9_]*)|(==|!=|<=|>=|\+|-|\*|\/|%|<|>|\(|\)|\[|\]|,|\.))/gy;
function tokenize(source){
  const tokens=[];let pos=0;
  while(pos<source.length){TOKEN.lastIndex=pos;const m=TOKEN.exec(source);if(!m)throw new PatchAppError('I do not understand this expression near: '+source.slice(pos));pos=TOKEN.lastIndex;
    if(m[1]!==undefined)tokens.push({type:'number',value:Number(m[1])});
    else if(m[2]!==undefined){const raw=m[2];const value=raw[0]==="'"?JSON.parse('"'+raw.slice(1,-1).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'):JSON.parse(raw);tokens.push({type:'string',value});}
    else if(m[3]!==undefined)tokens.push({type:'word',value:m[3]});
    else tokens.push({type:m[4],value:m[4]});
  }
  tokens.push({type:'eof',value:null});return tokens;
}
function lookupPath(env,path){const parts=Array.isArray(path)?path:String(path).split('.');const root=parts[0];const stateView=env.state??state;let value;if(env.locals&&Object.prototype.hasOwnProperty.call(env.locals,root))value=env.locals[root];else if(stateView.has(root))value=stateView.get(root);else throw new PatchAppError("I cannot find '"+root+"'. Create it first.");for(const part of parts.slice(1)){if(value===null||typeof value!=='object'||!(part in value))throw new PatchAppError("I cannot find '"+parts.join('.')+"'.");value=value[part];}return value;}
class ExprParser{
  constructor(tokens,env){this.tokens=tokens;this.i=0;this.env=env;}
  peek(type,value){const t=this.tokens[this.i];return t.type===type&&(value===undefined||t.value===value);}
  take(type,value){const t=this.tokens[this.i];if(!this.peek(type,value))throw new PatchAppError('Expected '+(value??type)+'.');this.i++;return t;}
  parse(){const v=this.or();if(!this.peek('eof'))throw new PatchAppError("Unexpected '"+this.tokens[this.i].value+"'.");return v;}
  or(){let v=this.and();while(this.peek('word','or')){this.i++;const r=this.and();v=Boolean(v)||Boolean(r);}return v;}
  and(){let v=this.equality();while(this.peek('word','and')){this.i++;const r=this.equality();v=Boolean(v)&&Boolean(r);}return v;}
  equality(){let v=this.comparison();while(this.peek('==')||this.peek('!=')){const op=this.tokens[this.i++].type;const r=this.comparison();v=op==='=='?deepEqual(v,r):!deepEqual(v,r);}return v;}
  comparison(){let v=this.term();while(['<','>','<=','>='].some(x=>this.peek(x))){const op=this.tokens[this.i++].type;const r=this.term();if(op==='<')v=v<r;else if(op==='>')v=v>r;else if(op==='<=')v=v<=r;else v=v>=r;}return v;}
  term(){let v=this.factor();while(this.peek('+')||this.peek('-')){const op=this.tokens[this.i++].type;const r=this.factor();v=op==='+'?v+r:v-r;}return v;}
  factor(){let v=this.unary();while(this.peek('*')||this.peek('/')||this.peek('%')){const op=this.tokens[this.i++].type;const r=this.unary();if(op==='*')v*=r;else if(op==='/')v/=r;else v%=r;}return v;}
  unary(){if(this.peek('-')){this.i++;return -Number(this.unary());}if(this.peek('word','not')){this.i++;return !Boolean(this.unary());}return this.primary();}
  primary(){if(this.peek('number'))return this.tokens[this.i++].value;if(this.peek('string'))return this.tokens[this.i++].value;if(this.peek('word','true')){this.i++;return true;}if(this.peek('word','false')){this.i++;return false;}if(this.peek('word')){const parts=[this.tokens[this.i++].value];while(this.peek('.')){this.i++;parts.push(this.take('word').value);}return lookupPath(this.env,parts);}if(this.peek('(')){this.i++;const v=this.or();this.take(')');return v;}if(this.peek('[')){this.i++;const out=[];if(!this.peek(']')){while(true){out.push(this.or());if(this.peek(',')){this.i++;continue;}break;}}this.take(']');return out;}throw new PatchAppError("Unexpected '"+(this.tokens[this.i].value??'end of expression')+"'.");}
}
function evaluateExpression(source,locals={},stateView=state){return new ExprParser(tokenize(String(source).trim()),{locals,state:stateView}).parse();}
function evaluateLoose(source,locals={},stateView=state){const s=String(source).trim();try{return evaluateExpression(s,locals,stateView);}catch(err){if(err instanceof PatchAppError&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(s))return s;throw err;}}
function splitComma(text){const out=[];let cur='';let quote=null;let depth=0;for(const ch of text){if(quote){cur+=ch;if(ch===quote)quote=null;continue;}if(ch==='"'||ch==="'"){quote=ch;cur+=ch;continue;}if(ch==='['||ch==='(')depth++;if(ch===']'||ch===')')depth--;if(ch===','&&depth===0){if(cur.trim())out.push(cur.trim());cur='';continue;}cur+=ch;}if(cur.trim())out.push(cur.trim());return out;}
function clearValue(value){if(Array.isArray(value))return[];if(typeof value==='string')return'';if(typeof value==='number')return 0;if(typeof value==='boolean')return false;if(value&&typeof value==='object')return{};return null;}
function setField(current,field,value){return field?{...current,[field]:value}:value;}
function currentAt(current,field){return field?current[field]:current;}
function registerWindow(node){if(node.id){if(formVisibility.has(node.id))throw new PatchAppError("Form '"+node.id+"' is declared more than once.");formVisibility.set(node.id,namedFormCount===0);namedFormCount++;}windows.push(node);}
function setFormVisible(form,visible){if(!formVisibility.has(form))throw new PatchAppError("I cannot find a Form called '"+form+"'.");formVisibility.set(form,Boolean(visible));}

function executeBlock(nodes,locals={}){for(const node of nodes??[]){const signal=execute(node,locals);if(signal instanceof ReturnSignal)return signal;}return null;}
function execute(node,locals){
  switch(node.kind){
    case 'create':{if(state.has(node.name))throw new PatchAppError("'"+node.name+"' already exists. Use change to modify it.");let value=node.valueType==='list'?(String(node.expr).trim().startsWith('[')?evaluateExpression(node.expr,locals):splitComma(node.expr).map(x=>evaluateLoose(x,locals))):evaluateExpression(node.expr,locals);if(node.valueType==='number'&&typeof value!=='number')throw new PatchAppError(node.name+' must start as a number.');if(node.valueType==='text'&&typeof value!=='string')throw new PatchAppError(node.name+' must start as text in quotes.');if(node.valueType==='boolean'&&typeof value!=='boolean')throw new PatchAppError(node.name+' must start as true or false.');state.set(node.name,clone(value));return;}
    case 'createThing':{if(state.has(node.name))throw new PatchAppError("'"+node.name+"' already exists. Use change to modify it.");const value={};for(const field of node.fields)value[field.name]=evaluateLoose(field.expr,locals);state.set(node.name,value);return;}
    case 'window':registerWindow(node);return;
    case 'event':events.push(node);return;
    case 'openForm':setFormVisible(node.form,true);return;
    case 'closeForm':setFormVisible(node.form,false);return;
    case 'allow':return;
    case 'show':output.push(formatValue(evaluateExpression(node.expr,locals)));return;
    case 'change':return applyChange(node,locals);
    case 'if':return executeBlock(Boolean(evaluateExpression(node.expr,locals))?node.thenBody:node.elseBody,locals);
    case 'repeat':{const count=Number(evaluateExpression(node.expr,locals));if(!Number.isInteger(count)||count<0||count>100000)throw new PatchAppError('repeat needs a whole number from 0 to 100000.');for(let i=0;i<count;i++){const signal=executeBlock(node.body,{...locals,count:i+1});if(signal instanceof ReturnSignal)return signal;}return;}
    case 'function':functions.set(node.name,node);return;
    case 'call':return callRecipe(node,locals);
    case 'return':return new ReturnSignal(node.expr?evaluateExpression(node.expr,locals):null);
    default:throw new PatchAppError('Standalone Window Web runtime cannot execute '+node.kind+'.');
  }
}
function applyChange(node,locals){if(!state.has(node.target))throw new PatchAppError("I cannot change '"+node.target+"' because it does not exist.");let current=clone(state.get(node.target));for(const op of node.ops){const field=op.field;if(field&&(current===null||typeof current!=='object'||Array.isArray(current)))throw new PatchAppError("'"+node.target+"' has no fields. Remove 'to "+field+"' / 'from "+field+"'.");if(field&&!(field in current))throw new PatchAppError("'"+node.target+"' has no field called '"+field+"'.");const old=currentAt(current,field);const stateView=new Map(state);stateView.set(node.target,current);let next;if(op.op==='set')next=evaluateLoose(op.expr,locals,stateView);else if(op.op==='add'){const value=evaluateLoose(op.expr,locals,stateView);if(typeof old==='number'&&typeof value==='number')next=old+value;else if(Array.isArray(old))next=[...old,clone(value)];else if(typeof old==='string')next=old+String(value);else throw new PatchAppError('add works with numbers, lists, or text.');}else if(op.op==='remove'){const value=evaluateLoose(op.expr,locals,stateView);if(typeof old==='number'&&typeof value==='number')next=old-value;else if(Array.isArray(old)){const index=old.findIndex(x=>deepEqual(x,value));if(index<0)throw new PatchAppError('Cannot remove '+formatValue(value)+' because it is not in the list.');next=[...old];next.splice(index,1);}else throw new PatchAppError('remove works with numbers or lists.');}else if(op.op==='clear')next=clearValue(old);else throw new PatchAppError('Unknown change operation '+op.op+'.');current=setField(current,field,next);}state.set(node.target,current);}
function callRecipe(node,locals){const fn=functions.get(node.name);if(!fn)throw new PatchAppError("I cannot find a recipe called '"+node.name+"'.");if(fn.params.length!==node.args.length)throw new PatchAppError(node.name+' needs '+fn.params.length+' value(s).');const args=node.args.map(a=>evaluateLoose(a,locals));fn.params.forEach((p,index)=>{const range=fn.paramRanges?.[p];if(range){const value=args[index];if(typeof value!=='number'||value<range.min||value>range.max)throw new PatchAppError(node.name+" expects '"+p+"' to be a number from "+range.min+' to '+range.max+', but got '+formatValue(value)+'.');}});const child={...locals};fn.params.forEach((p,index)=>child[p]=args[index]);const signal=executeBlock(fn.body,child);return signal instanceof ReturnSignal?signal.value:null;}
function uiText(expr){let value;try{value=evaluateLoose(expr,{});}catch{value=expr;}return String(value).replace(/\{([A-Za-z_]\w*)\}/g,(_,name)=>state.has(name)?formatValue(state.get(name)):'{'+name+'}');}
function uiOption(expr){let value;try{value=evaluateLoose(expr,{});}catch{value=expr;}return String(value);}
function buildUIItems(nodes){const items=[];for(const node of nodes??[]){if(node.kind==='uiControl')items.push({type:node.control,id:node.id,text:node.textExpr?uiText(node.textExpr):'',options:Array.isArray(node.options)?node.options.map(uiOption):[],value:node.id&&state.has(node.id)?clone(state.get(node.id)):''});else if(node.kind==='tabs')items.push({type:'tabs',id:node.id,pages:(node.body??[]).map(page=>({title:uiText(page.titleExpr),controls:buildUIItems(page.body)}))});}return items;}
function buildUI(){return windows.map((windowNode,index)=>({id:windowNode.id||('window'+(index+1)),visible:windowNode.id?formVisibility.get(windowNode.id)!==false:true,title:uiText(windowNode.titleExpr),controls:buildUIItems(windowNode.body)}));}
function findControl(nodes,id){for(const node of nodes??[]){if(node.kind==='uiControl'&&node.id===id)return node;if(node.kind==='tabs'){for(const page of node.body??[]){const nested=findControl(page.body,id);if(nested)return nested;}}}return null;}
function controlType(id){for(const windowNode of windows){const control=findControl(windowNode.body,id);if(control)return control.control;}return null;}
function trigger(control,event='clicked',payload={}){output=[];const matches=events.filter(x=>x.control===control&&x.event===event);if(!matches.length)throw new PatchAppError("There is no '"+event+"' action for '"+control+"'.");let locals={};if(event==='changed'){if(!Object.prototype.hasOwnProperty.call(payload,'value'))throw new PatchAppError("The 'changed' action for '"+control+"' needs an event-local value.");const type=controlType(control);if(type==='checkbox'&&typeof payload.value!=='boolean')throw new PatchAppError("The 'changed' action for checkbox '"+control+"' needs a Boolean event-local value.");if((type==='combo'||type==='listbox')&&typeof payload.value!=='string')throw new PatchAppError("The 'changed' action for "+type+" '"+control+"' needs a text event-local value.");locals={value:payload.value};}for(const handler of matches)executeBlock(handler.body,{...locals});render();showOutput();}
function renderControl(control,windowId,controlIndex){if(control.type==='text'){const el=document.createElement('p');el.className='text';el.textContent=control.text;return el;}if(control.type==='button'){const el=document.createElement('button');el.textContent=control.text;el.addEventListener('click',()=>safeTrigger(control.id,'clicked'));return el;}if(control.type==='input'){const el=document.createElement('input');el.value=control.value??'';el.placeholder=control.text||control.id||'';el.addEventListener('input',()=>safeTrigger(control.id,'changed',{value:el.value}));return el;}if(control.type==='checkbox'){const label=document.createElement('label');label.className='checkbox';const el=document.createElement('input');el.type='checkbox';el.checked=control.value===true;const text=document.createElement('span');text.textContent=control.text;el.addEventListener('change',()=>safeTrigger(control.id,'changed',{value:el.checked}));label.append(el,text);return label;}if(control.type==='combo'||control.type==='listbox'){const el=document.createElement('select');if(control.type==='listbox')el.size=Math.min(8,Math.max(2,(control.options??[]).length));for(const option of control.options??[]){const item=document.createElement('option');item.value=option;item.textContent=option;el.appendChild(item);}el.value=String(control.value??'');el.addEventListener('change',()=>safeTrigger(control.id,'changed',{value:el.value}));return el;}if(control.type==='tabs')return renderTabs(control,windowId,controlIndex);return null;}
function renderTabs(control,windowId,controlIndex){const root=document.createElement('div');root.className='patch-tabs';root.dataset.tabsId=control.id||'';const pages=control.pages??[];const key=windowId+':'+(control.id||controlIndex);let selected=tabSelections.get(key)??0;if(!Number.isInteger(selected)||selected<0||selected>=pages.length)selected=0;tabSelections.set(key,selected);const list=document.createElement('div');list.className='patch-tabs-list';list.setAttribute('role','tablist');pages.forEach((page,index)=>{const button=document.createElement('button');button.type='button';button.className='patch-tab-button';button.textContent=page.title;button.setAttribute('role','tab');button.setAttribute('aria-selected',index===selected?'true':'false');button.addEventListener('click',()=>{tabSelections.set(key,index);render();});list.appendChild(button);});const panel=document.createElement('div');panel.className='patch-tab-panel';panel.setAttribute('role','tabpanel');for(const nested of pages[selected]?.controls??[]){const el=renderControl(nested,windowId,0);if(el)panel.appendChild(el);}root.append(list,panel);return root;}
function render(){const models=buildUI();appEl.innerHTML='';if(!models.length){appEl.innerHTML='<section class="console"><strong>No Patch window is defined.</strong></section>';return;}for(const model of models){const shell=document.createElement('section');shell.className='window';shell.hidden=model.visible===false;const title=document.createElement('header');title.textContent=model.title;const body=document.createElement('div');body.className='body';model.controls.forEach((control,index)=>{const el=renderControl(control,model.id,index);if(el)body.appendChild(el);});shell.append(title,body);appEl.append(shell);}}
function showOutput(){outputEl.textContent=output.join('\n');}
function fail(error){appEl.innerHTML='<section class="console"><strong>Patch stopped</strong><p></p></section>';appEl.querySelector('p').textContent=error?.message??String(error);}
function safeTrigger(control,event,payload={}){try{trigger(control,event,payload);}catch(error){fail(error);}}
try{executeBlock(PROGRAM,{});render();showOutput();}catch(error){fail(error);}
`;
}