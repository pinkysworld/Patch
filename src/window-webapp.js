import { validateWindowBuild, validateWindowRuntimeSupport } from './window-build.js';

export const PATCH_WINDOW_WEB_VERSION = '0.10';

const WINDOW_WEB_SUPPORTED = new Set([
  'create', 'createThing', 'window', 'uiControl', 'tabs', 'tabPage', 'menu', 'menuItem', 'menuSeparator',
  'event', 'dialog', 'confirmDialog', 'openFileDialog', 'saveFileDialog', 'openForm', 'closeForm', 'allow', 'show',
  'change', 'if', 'repeat', 'function', 'call', 'return', 'drawPaint'
]);

/** Build a single-file executable browser app from the parsed Patch AST. */
export function buildStandaloneWindowWebApp(compiled, name) {
  const windowCount = validateWindowBuild(compiled);
  const support = validateWindowRuntimeSupport(compiled, { allowTree: true, allowTreeNodeImages: true, allowTreeNodeHints: true, allowTreeNodeStates: true, allowSlider: true, allowProgressBar: true, allowScrollBar: true, allowAdvancedTableColumns: true, allowMemo: true, allowPaintBox: true, allowImageList: true, allowMenuDecorations: true });
  validateWindowWebSubset(compiled.ast);
  const programJson = scriptJson(compiled.ast);
  const appName = String(name || 'PatchApp');
  const numberEditCount = compiled?.windowNumberEdit?.controls?.length ?? 0;
  const datePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'date').length ?? 0;
  const timePickerCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'time').length ?? 0;
  const calendarCount = compiled?.windowInputPresentation?.controls?.filter(control => control.mode === 'calendar').length ?? 0;
  const linkLabelCount = compiled?.windowButtonPresentation?.controls?.filter(control => control.mode === 'link').length ?? 0;
  const metadata = {
    format: 'patch-standalone-window-web',
    version: PATCH_WINDOW_WEB_VERSION,
    irVersion: compiled.ir.version,
    projectKind: 'window',
    windows: windowCount,
    execution: 'generated-browser-window-runtime',
    ...(numberEditCount ? {
      numberEditStage: 1,
      numberEditVersion: '0.1',
      numberEditMode: 'source-backed-number-input',
      numberEditEventValue: 'text'
    } : {}),
    ...(datePickerCount ? {
      datePickerStage: 1,
      datePickerVersion: '0.4',
      datePickerMode: 'source-backed-date-input',
      datePickerEventValue: 'iso-date-text'
    } : {}),
    ...(timePickerCount ? {
      timePickerStage: 1,
      timePickerVersion: '0.4',
      timePickerMode: 'source-backed-time-input',
      timePickerEventValue: 'local-time-text'
    } : {}),
    ...(calendarCount ? {
      calendarStage: 1,
      calendarVersion: '0.4',
      calendarMode: 'source-backed-inline-month-grid',
      calendarEventValue: 'iso-date-text'
    } : {}),
    ...(linkLabelCount ? {
      linkLabelStage: 1,
      linkLabelVersion: '0.1',
      linkLabelMode: 'source-backed-button-presentation',
      linkLabelEvent: 'clicked'
    } : {}),
    ...(support.treeNodeHints ? {
      treeNodeHintStage: 2,
      treeNodeHintVersion: '0.1',
      treeNodeHintMode: 'source-backed-tooltip',
      treeNodeHintCount: support.treeNodeHints
    } : {}),
    ...(support.treeNodeStates ? {
      treeNodeStateStage: 3,
      treeNodeStateVersion: '0.1',
      treeNodeStateMode: 'source-backed-status-tone',
      treeNodeStateCount: support.treeNodeStates
    } : {}),
    ...(support.menuItems ? {
      menuStage: 1,
      menuVersion: '0.10',
      menuMode: 'source-backed-browser-menu',
      menuItems: support.menuItems,
      menuSeparators: support.menuSeparators,
      menuShortcuts: support.menuShortcuts,
      menuEnabledBindings: support.menuEnabledBindings,
      menuCheckedBindings: support.menuCheckedBindings
    } : {}),
    ...(support.resultDialogs ? {
      resultDialogStage: 1,
      resultDialogVersion: '0.10',
      resultDialogMode: 'browser-native-result-source',
      resultDialogs: support.resultDialogs
    } : {})
  };

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(appName)}</title>
<style>
:root{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark;background:#f3f4f6;color:#171717}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px;background:#f3f4f6}#app{max-width:760px;margin:0 auto;display:grid;gap:20px}.window,.console{overflow:hidden;border:1px solid #d4d4d8;border-radius:14px;background:#fff;box-shadow:0 20px 55px #0002;color:#18181b}.window header{padding:11px 15px;border-bottom:1px solid #e4e4e7;background:#f4f4f5;font-size:13px;font-weight:750;display:flex;align-items:center;gap:8px}.window .patch-window-icon{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}.body{min-height:220px;padding:28px;display:flex;flex-direction:column;align-items:flex-start;gap:16px}.text{margin:0;font-size:20px}.body button{border:0;border-radius:9px;background:#18181b;color:#fff;padding:10px 16px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px}.body .patch-button-image{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}.body .patch-linklabel{padding:2px 0;border-radius:0;background:transparent;color:#2563eb;text-decoration:underline;text-underline-offset:3px;box-shadow:none}.body .patch-linklabel:hover,.body .patch-linklabel:focus-visible{background:transparent;color:#1d4ed8}.body input,.body select{min-width:260px;border:1px solid #d4d4d8;border-radius:9px;padding:10px 12px;background:#fff;color:#18181b}.checkbox{display:flex;align-items:center;gap:9px;min-height:32px;cursor:pointer}.body .checkbox input{min-width:0;width:18px;height:18px;margin:0;padding:0;accent-color:#18181b}.patch-tabs{width:100%;min-height:180px;overflow:hidden;border:1px solid #d4d4d8;border-radius:10px;background:#fff}.patch-tabs-list{display:flex;align-items:center;gap:2px;padding:4px;border-bottom:1px solid #e4e4e7;background:#f4f4f5;overflow-x:auto}.body .patch-tab-button{min-height:30px;padding:5px 10px;background:transparent;color:#71717a;font-size:12px;white-space:nowrap}.body .patch-tab-button[aria-selected="true"]{background:#fff;color:#18181b;box-shadow:inset 0 0 0 1px #d4d4d8}.patch-tab-panel{min-height:138px;padding:16px;display:flex;flex-direction:column;align-items:flex-start;gap:12px;overflow:auto}.patch-tree{width:100%;margin:0;padding:10px 12px;list-style:none;border:1px solid #d4d4d8;border-radius:10px;background:#fff}.patch-tree ul{margin:3px 0 0 18px;padding:0;list-style:none}.patch-tree li{margin:2px 0}.patch-calendar{width:294px;border:1px solid #d4d4d8;border-radius:10px;background:#fff;padding:10px;color:#18181b}.patch-calendar-head{display:grid;grid-template-columns:36px 1fr 36px;align-items:center;gap:6px;margin-bottom:8px}.body .patch-calendar-nav{min-height:32px;padding:4px 8px}.patch-calendar-title{text-align:center;font-size:13px;font-weight:750}.patch-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.patch-calendar-weekday{text-align:center;font-size:10px;font-weight:750;color:#71717a;padding:3px 0}.body .patch-calendar-day{min-width:0;min-height:34px;padding:4px;border-radius:7px;background:transparent;color:#18181b;font-weight:600}.body .patch-calendar-day:hover,.body .patch-calendar-day:focus-visible{background:#f4f4f5}.body .patch-calendar-day[aria-pressed="true"]{background:#18181b;color:#fff}.body .patch-calendar-day:disabled{opacity:.22;cursor:default}.body .patch-tree-node{min-height:28px;padding:4px 8px;border-radius:7px;background:transparent;color:#18181b;font-weight:650;text-align:left}.body .patch-tree-node:hover,.body .patch-tree-node:focus-visible{background:#f4f4f5}.body .patch-tree-node:focus-visible{outline:2px solid #71717a;outline-offset:1px}.body .patch-tree-node-image{width:16px;height:16px;object-fit:contain;flex:0 0 auto;border:0}.body .patch-tree-node-state{display:inline-flex;align-items:center;margin-left:2px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:800;line-height:1.5;text-transform:uppercase;letter-spacing:.03em;background:#e4e4e7;color:#3f3f46}.body .patch-tree-node[data-patch-tree-state="muted"] .patch-tree-node-state{background:#e4e4e7;color:#52525b}.body .patch-tree-node[data-patch-tree-state="info"] .patch-tree-node-state{background:#dbeafe;color:#1d4ed8}.body .patch-tree-node[data-patch-tree-state="success"] .patch-tree-node-state{background:#dcfce7;color:#166534}.body .patch-tree-node[data-patch-tree-state="warning"] .patch-tree-node-state{background:#fef3c7;color:#92400e}.body .patch-tree-node[data-patch-tree-state="danger"] .patch-tree-node-state{background:#fee2e2;color:#991b1b}.patch-menu-bar{display:flex;align-items:center;gap:4px;padding:5px 10px;border-bottom:1px solid #e4e4e7;background:#fafafa;font-size:13px;position:relative;z-index:20}.patch-menu{position:relative}.patch-menu>summary{list-style:none;cursor:pointer;padding:6px 9px;border-radius:7px;font-weight:650;user-select:none}.patch-menu>summary::-webkit-details-marker{display:none}.patch-menu[open]>summary,.patch-menu>summary:hover,.patch-menu>summary:focus-visible{background:#e4e4e7;outline:none}.patch-menu-items{position:absolute;top:calc(100% + 4px);left:0;min-width:220px;padding:6px;border:1px solid #d4d4d8;border-radius:10px;background:#fff;box-shadow:0 12px 32px #0002;display:grid;gap:2px}.patch-menu-separator{height:1px;border:0;background:#e4e4e7;margin:5px 4px}.patch-menu-item{width:100%;border:0;border-radius:7px;padding:7px 9px;background:transparent;color:#18181b;display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:6px;text-align:left;cursor:pointer}.patch-menu-item:hover,.patch-menu-item:focus-visible{background:#f4f4f5;outline:none}.patch-menu-item:disabled{opacity:.45;cursor:not-allowed}.patch-menu-check{font-weight:900}.patch-menu-shortcut{font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717a}.console{padding:20px}#output{max-width:760px;margin:18px auto 0;padding:14px;border-radius:10px;background:#18181b;color:#fafafa;white-space:pre-wrap;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}#output:empty{display:none}.badge{max-width:760px;margin:14px auto 0;color:#71717a;font-size:11px}@media(prefers-color-scheme:dark){:root,body{background:#111318;color:#f4f4f5}.window,.console{background:#1b1d22;color:#f4f4f5;border-color:#34363e}.window header{background:#24262d;border-color:#34363e}.body input,.body select{background:#17191e;color:#f4f4f5;border-color:#41444e}.body button{background:#f4f4f5;color:#18181b}.body .patch-linklabel{background:transparent;color:#93c5fd}.body .patch-linklabel:hover,.body .patch-linklabel:focus-visible{color:#bfdbfe}.body .checkbox input{accent-color:#f4f4f5}.patch-tabs{background:#1b1d22;border-color:#41444e}.patch-tree{background:#1b1d22;border-color:#41444e}.patch-calendar{background:#1b1d22;border-color:#41444e;color:#f4f4f5}.body .patch-calendar-day{color:#f4f4f5}.body .patch-calendar-day:hover,.body .patch-calendar-day:focus-visible{background:#24262d}.body .patch-calendar-day[aria-pressed="true"]{background:#f4f4f5;color:#18181b}.patch-calendar-weekday{color:#a1a1aa}.body .patch-tree-node{color:#f4f4f5}.body .patch-tree-node:hover,.body .patch-tree-node:focus-visible{background:#24262d}.body .patch-tree-node[data-patch-tree-state="muted"] .patch-tree-node-state{background:#3f3f46;color:#e4e4e7}.body .patch-tree-node[data-patch-tree-state="info"] .patch-tree-node-state{background:#1e3a8a;color:#dbeafe}.body .patch-tree-node[data-patch-tree-state="success"] .patch-tree-node-state{background:#14532d;color:#dcfce7}.body .patch-tree-node[data-patch-tree-state="warning"] .patch-tree-node-state{background:#78350f;color:#fef3c7}.body .patch-tree-node[data-patch-tree-state="danger"] .patch-tree-node-state{background:#7f1d1d;color:#fee2e2}.patch-tabs-list{background:#24262d;border-color:#34363e}.patch-menu-bar{background:#202228;border-color:#34363e}.patch-menu[open]>summary,.patch-menu>summary:hover,.patch-menu>summary:focus-visible{background:#34363e}.patch-menu-items{background:#1b1d22;border-color:#41444e}.patch-menu-separator{background:#41444e}.patch-menu-item{color:#f4f4f5}.patch-menu-item:hover,.patch-menu-item:focus-visible{background:#2b2d34}.patch-menu-shortcut{color:#a1a1aa}.body .patch-tab-button{background:transparent;color:#a1a1aa}.body .patch-tab-button[aria-selected="true"]{background:#17191e;color:#f4f4f5;box-shadow:inset 0 0 0 1px #41444e}.badge{color:#a1a1aa}}
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
const calendarViews=new Map();
let namedFormCount=0;
let output=[];
const appEl=document.getElementById('app');
const outputEl=document.getElementById('output');

function clone(value){ return value===undefined?undefined:copyValue(value); }
function copyValue(value){
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(copyValue);
  const next=Object.getPrototypeOf(value)===Object.prototype?{}:Object.create(null);
  for(const key of Object.keys(value))next[key]=copyValue(value[key]);
  return next;
}
function emptyRecord(){ return Object.create(null); }
function withOwnField(current,field,next){
  const updated=emptyRecord();
  if(current&&typeof current==='object'&&!Array.isArray(current)) for(const key of Object.keys(current)) updated[key]=current[key];
  updated[field]=next; return updated;
}
function formatValue(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.join(', ');
  if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>k+'='+formatValue(v)).join(', ');
  return String(value);
}
function deepEqual(a,b){
  if(a===b)return true;
  if(typeof a==='number'&&typeof b==='number'&&Number.isNaN(a)&&Number.isNaN(b))return true;
  if(Array.isArray(a)||Array.isArray(b)){
    if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
    for(let i=0;i<a.length;i++)if(!deepEqual(a[i],b[i]))return false;
    return true;
  }
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  const aKeys=Object.keys(a).sort();
  const bKeys=Object.keys(b).sort();
  if(aKeys.length!==bKeys.length)return false;
  for(let i=0;i<aKeys.length;i++){
    const key=aKeys[i];
    if(key!==bKeys[i]||!Object.prototype.hasOwnProperty.call(b,key)||!deepEqual(a[key],b[key]))return false;
  }
  return true;
}

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
function lookupPath(env,path){const parts=Array.isArray(path)?path:String(path).split('.');const root=parts[0];const stateView=env.state??state;let value;if(env.locals&&Object.prototype.hasOwnProperty.call(env.locals,root))value=env.locals[root];else if(stateView.has(root))value=stateView.get(root);else throw new PatchAppError("I cannot find '"+root+"'. Create it first.");for(const part of parts.slice(1)){if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,part))throw new PatchAppError("I cannot find '"+parts.join('.')+"'.");value=value[part];}return value;}
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
function clearValue(value){if(Array.isArray(value))return[];if(typeof value==='string')return'';if(typeof value==='number')return 0;if(typeof value==='boolean')return false;if(value&&typeof value==='object')return Object.create(null);return null;}
function setField(current,field,value){return field?withOwnField(current,field,value):value;}
function currentAt(current,field){return field?current[field]:current;}
function registerWindow(node){if(node.id){if(formVisibility.has(node.id))throw new PatchAppError("Form '"+node.id+"' is declared more than once.");formVisibility.set(node.id,namedFormCount===0);namedFormCount++;}windows.push(node);}
function setFormVisible(form,visible){if(!formVisibility.has(form))throw new PatchAppError("I cannot find a Form called '"+form+"'.");formVisibility.set(form,Boolean(visible));}

function dialogText(expr,locals={}){try{return String(evaluateLoose(expr,locals));}catch{return String(expr??'');}}
function dispatchDialogResult(id,event,payload={}){queueMicrotask(()=>safeSynthetic(id,event,payload));}
function runInfoDialog(node,locals){const title=dialogText(node.titleExpr,locals);const message=dialogText(node.messageExpr,locals);if(typeof globalThis.alert==='function')globalThis.alert(title+'\n\n'+message);}
function runConfirmDialog(node,locals){const title=dialogText(node.titleExpr,locals);const message=dialogText(node.messageExpr,locals);const accepted=typeof globalThis.confirm==='function'?globalThis.confirm(title+'\n\n'+message):false;dispatchDialogResult(node.id,accepted?'confirmed':'cancelled');}
function runOpenFileDialog(node,locals){const title=dialogText(node.titleExpr,locals);if(typeof document==='undefined'){dispatchDialogResult(node.id,'cancelled');return;}const input=document.createElement('input');input.type='file';input.hidden=true;input.setAttribute('aria-label',title||'Open file');let settled=false;const finish=(event,payload={})=>{if(settled)return;settled=true;input.remove();dispatchDialogResult(node.id,event,payload);};input.addEventListener('change',()=>{const file=input.files?.[0];if(file)finish('chosen',{value:String(file.webkitRelativePath||file.name)});else finish('cancelled');},{once:true});input.addEventListener('cancel',()=>finish('cancelled'),{once:true});document.body.appendChild(input);input.click();}
function runSaveFileDialog(node,locals){const title=dialogText(node.titleExpr,locals);if(typeof globalThis.showSaveFilePicker==='function'){Promise.resolve(globalThis.showSaveFilePicker({suggestedName:'patch-output.patch'})).then(handle=>dispatchDialogResult(node.id,'chosen',{value:String(handle?.name||'patch-output.patch')})).catch(error=>{if(error?.name==='AbortError')dispatchDialogResult(node.id,'cancelled');else fail(error);});return;}const chosen=typeof globalThis.prompt==='function'?globalThis.prompt(title||'Save file','patch-output.patch'):null;dispatchDialogResult(node.id,chosen===null?'cancelled':'chosen',chosen===null?{}:{value:String(chosen)});}

function executeBlock(nodes,locals={}){for(const node of nodes??[]){const signal=execute(node,locals);if(signal instanceof ReturnSignal)return signal;}return null;}
function execute(node,locals){
  switch(node.kind){
    case 'create':{if(state.has(node.name))throw new PatchAppError("'"+node.name+"' already exists. Use change to modify it.");let value=node.valueType==='list'?(String(node.expr).trim().startsWith('[')?evaluateExpression(node.expr,locals):splitComma(node.expr).map(x=>evaluateLoose(x,locals))):evaluateExpression(node.expr,locals);if(node.valueType==='number'&&typeof value!=='number')throw new PatchAppError(node.name+' must start as a number.');if(node.valueType==='text'&&typeof value!=='string')throw new PatchAppError(node.name+' must start as text in quotes.');if(node.valueType==='boolean'&&typeof value!=='boolean')throw new PatchAppError(node.name+' must start as true or false.');state.set(node.name,clone(value));return;}
    case 'createThing':{if(state.has(node.name))throw new PatchAppError("'"+node.name+"' already exists. Use change to modify it.");const value=Object.create(null);for(const field of node.fields)value[field.name]=evaluateLoose(field.expr,locals);state.set(node.name,value);return;}
    case 'window':registerWindow(node);return;
    case 'event':events.push(node);return;
    case 'dialog':runInfoDialog(node,locals);return;
    case 'confirmDialog':runConfirmDialog(node,locals);return;
    case 'openFileDialog':runOpenFileDialog(node,locals);return;
    case 'saveFileDialog':runSaveFileDialog(node,locals);return;
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
function applyChange(node,locals){if(!state.has(node.target))throw new PatchAppError("I cannot change '"+node.target+"' because it does not exist.");let current=clone(state.get(node.target));for(const op of node.ops){const field=op.field;if(field&&(current===null||typeof current!=='object'||Array.isArray(current)))throw new PatchAppError("'"+node.target+"' has no fields. Remove 'to "+field+"' / 'from "+field+"'.");if(field&&!Object.prototype.hasOwnProperty.call(current,field))throw new PatchAppError("'"+node.target+"' has no field called '"+field+"'.");const old=currentAt(current,field);const stateView=new Map(state);stateView.set(node.target,current);let next;if(op.op==='set')next=evaluateLoose(op.expr,locals,stateView);else if(op.op==='add'){const value=evaluateLoose(op.expr,locals,stateView);if(typeof old==='number'&&typeof value==='number')next=old+value;else if(Array.isArray(old))next=[...old,clone(value)];else if(typeof old==='string')next=old+String(value);else throw new PatchAppError('add works with numbers, lists, or text.');}else if(op.op==='remove'){const value=evaluateLoose(op.expr,locals,stateView);if(typeof old==='number'&&typeof value==='number')next=old-value;else if(Array.isArray(old)){const index=old.findIndex(x=>deepEqual(x,value));if(index<0)throw new PatchAppError('Cannot remove '+formatValue(value)+' because it is not in the list.');next=[...old];next.splice(index,1);}else throw new PatchAppError('remove works with numbers or lists.');}else if(op.op==='clear')next=clearValue(old);else throw new PatchAppError('Unknown change operation '+op.op+'.');current=setField(current,field,next);}state.set(node.target,current);}
function callRecipe(node,locals){const fn=functions.get(node.name);if(!fn)throw new PatchAppError("I cannot find a recipe called '"+node.name+"'.");if(fn.params.length!==node.args.length)throw new PatchAppError(node.name+' needs '+fn.params.length+' value(s).');const args=node.args.map(a=>evaluateLoose(a,locals));fn.params.forEach((p,index)=>{const range=fn.paramRanges?.[p];if(range){const value=args[index];if(typeof value!=='number'||value<range.min||value>range.max)throw new PatchAppError(node.name+" expects '"+p+"' to be a number from "+range.min+' to '+range.max+', but got '+formatValue(value)+'.');}});const child={...locals};fn.params.forEach((p,index)=>child[p]=args[index]);const signal=executeBlock(fn.body,child);return signal instanceof ReturnSignal?signal.value:null;}
function uiText(expr){let value;try{value=evaluateLoose(expr,{});}catch{value=expr;}return String(value).replace(/\{([A-Za-z_]\w*)\}/g,(_,name)=>state.has(name)?formatValue(state.get(name)):'{'+name+'}');}
function uiOption(expr){let value;try{value=evaluateLoose(expr,{});}catch{value=expr;}return String(value);}
function uiTreeNodes(nodes){return uiTreeNodesWithImages(nodes,new Map());}
function uiTreeNodesWithImages(nodes,lists=new Map()){return(nodes??[]).map(node=>{const list=node.imageListId?lists.get(node.imageListId):null;const image=node.imageListId&&node.imageItem?(list?.items??[]).find(item=>item.name===node.imageItem):null;const children=uiTreeNodesWithImages(node.children,lists);const text=uiText(node.labelExpr);const item={text,children};if(node.hint)item.hint=String(node.hint);if(node.state)item.state=String(node.state);if(image){item.imageListId=node.imageListId;item.imageItem=node.imageItem;item.imageSource=uiText(image.sourceExpr);item.imageWidth=Number(list?.logicalWidth)||16;item.imageHeight=Number(list?.logicalHeight)||16;}return item;});}
function imageListsFrom(nodes){const lists=new Map();for(const node of nodes??[]){if(node.kind==='uiControl'&&node.control==='imagelist'&&node.id)lists.set(node.id,node);}return lists;}
function patchButtonImageSource(node,lists){if(!node.imageListId||!node.imageItem)return '';const list=lists.get(node.imageListId);const item=(list?.items??[]).find(image=>image.name===node.imageItem);return item?uiText(item.sourceExpr):'';}
function patchButtonImageSize(node,lists){const list=node.imageListId?lists.get(node.imageListId):null;return {width:Number(list?.logicalWidth)||16,height:Number(list?.logicalHeight)||16};}
function buildUIItems(nodes,lists=new Map()){const items=[];for(const node of nodes??[]){if(node.kind==='uiControl')items.push({type:node.control,id:node.id,text:node.textExpr?uiText(node.textExpr):'',options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodesWithImages(node.treeNodes,lists):[],value:node.id&&state.has(node.id)?clone(state.get(node.id)):'',buttonPresentation:node.control==='button'?(node.buttonPresentation||'plain'):null,inputPresentation:node.control==='input'?(node.inputPresentation||'plain'):null,numberEdit:node.control==='input'&&node.numberEdit===true,imageListId:node.control==='button'?(node.imageListId||null):null,imageItem:node.control==='button'?(node.imageItem||null):null,imageSource:node.control==='button'?patchButtonImageSource(node,lists):'',imageWidth:node.control==='button'?patchButtonImageSize(node,lists).width:0,imageHeight:node.control==='button'?patchButtonImageSize(node,lists).height:0});else if(node.kind==='tabs')items.push({type:'tabs',id:node.id,pages:(node.body??[]).map(page=>({title:uiText(page.titleExpr),controls:buildUIItems(page.body,lists)}))});}return items;}
function buildMenus(nodes){const menus=[];for(const node of nodes??[]){if(node.kind!=='menu')continue;menus.push({title:uiText(node.titleExpr),items:(node.body??[]).map(item=>item.kind==='menuSeparator'?{type:'separator'}:{type:'item',id:item.id,text:uiText(item.textExpr),enabled:item.enabledState?state.get(item.enabledState)===true:true,checked:item.checkedState?state.get(item.checkedState)===true:false,shortcut:item.shortcutExpr?uiText(item.shortcutExpr):''})});}return menus;}
function buildUI(){return windows.map((windowNode,index)=>({id:windowNode.id||('window'+(index+1)),visible:windowNode.id?formVisibility.get(windowNode.id)!==false:true,title:uiText(windowNode.titleExpr),icon:windowNode.iconExpr?uiText(windowNode.iconExpr):'',menus:buildMenus(windowNode.body),controls:buildUIItems(windowNode.body,imageListsFrom(windowNode.body))}));}
function findControl(nodes,id){for(const node of nodes??[]){if(node.kind==='uiControl'&&node.id===id)return node;if(node.kind==='tabs'){for(const page of node.body??[]){const nested=findControl(page.body,id);if(nested)return nested;}}}return null;}
function controlType(id){for(const windowNode of windows){const control=findControl(windowNode.body,id);if(control)return control.control;}return null;}
function eventLocals(control,event,payload={}){if(event==='changed'){if(!Object.prototype.hasOwnProperty.call(payload,'value'))throw new PatchAppError("The 'changed' action for '"+control+"' needs an event-local value.");const type=controlType(control);if(type==='checkbox'&&typeof payload.value!=='boolean')throw new PatchAppError("The 'changed' action for checkbox '"+control+"' needs a Boolean event-local value.");if((type==='combo'||type==='listbox')&&typeof payload.value!=='string')throw new PatchAppError("The 'changed' action for "+type+" '"+control+"' needs a text event-local value.");if(type==='tree'&&(!Array.isArray(payload.value)||!payload.value.length||!payload.value.every(item=>typeof item==='string')))throw new PatchAppError("The 'changed' action for tree '"+control+"' needs a non-empty text-list event-local value containing the selected node path.");return {value:clone(payload.value)};}if(event==='chosen'){if(typeof payload.value!=='string')throw new PatchAppError("The 'chosen' action for '"+control+"' needs a text event-local value.");return {value:String(payload.value)};}return {};}
function dispatchHandlers(control,event='clicked',payload={},required=true){output=[];const matches=events.filter(x=>x.control===control&&x.event===event);if(!matches.length){if(required)throw new PatchAppError("There is no '"+event+"' action for '"+control+"'.");render();showOutput();return;}const locals=eventLocals(control,event,payload);for(const handler of matches)executeBlock(handler.body,{...locals});render();showOutput();}
function trigger(control,event='clicked',payload={}){dispatchHandlers(control,event,payload,true);}
function safeSynthetic(control,event,payload={}){try{dispatchHandlers(control,event,payload,false);}catch(error){fail(error);}}
function calendarIso(year,month,day){return String(year).padStart(4,'0')+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
function calendarSeed(value){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value??''));if(m)return {year:Number(m[1]),month:Number(m[2])-1,day:Number(m[3])};const now=new Date();return {year:now.getFullYear(),month:now.getMonth(),day:now.getDate()};}
function renderCalendar(control){const root=document.createElement('div');root.className='patch-calendar';root.dataset.patchInputPresentation='calendar';root.setAttribute('role','group');root.setAttribute('aria-label',String(control.id||'Calendar')+' calendar');const selected=calendarSeed(control.value);const key=String(control.id||'calendar');const view=calendarViews.get(key)??{year:selected.year,month:selected.month};calendarViews.set(key,view);const head=document.createElement('div');head.className='patch-calendar-head';const prev=document.createElement('button');prev.type='button';prev.className='patch-calendar-nav';prev.textContent='‹';prev.setAttribute('aria-label','Previous month');patchMark(prev,{patchControlId:control.id||key,patchFocusKey:(control.id||key)+':prev'});prev.addEventListener('click',()=>{const d=new Date(view.year,view.month-1,1);calendarViews.set(key,{year:d.getFullYear(),month:d.getMonth()});render();});const title=document.createElement('div');title.className='patch-calendar-title';title.textContent=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(view.year,view.month,1));const next=document.createElement('button');next.type='button';next.className='patch-calendar-nav';next.textContent='›';next.setAttribute('aria-label','Next month');patchMark(next,{patchControlId:control.id||key,patchFocusKey:(control.id||key)+':next'});next.addEventListener('click',()=>{const d=new Date(view.year,view.month+1,1);calendarViews.set(key,{year:d.getFullYear(),month:d.getMonth()});render();});head.append(prev,title,next);const grid=document.createElement('div');grid.className='patch-calendar-grid';grid.setAttribute('role','grid');for(const label of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']){const weekday=document.createElement('div');weekday.className='patch-calendar-weekday';weekday.textContent=label;weekday.setAttribute('role','columnheader');grid.appendChild(weekday);}const first=new Date(view.year,view.month,1);const offset=(first.getDay()+6)%7;const days=new Date(view.year,view.month+1,0).getDate();for(let i=0;i<offset;i++){const blank=document.createElement('button');blank.type='button';blank.className='patch-calendar-day';blank.disabled=true;blank.tabIndex=-1;grid.appendChild(blank);}for(let day=1;day<=days;day++){const iso=calendarIso(view.year,view.month,day);const button=document.createElement('button');button.type='button';button.className='patch-calendar-day';button.textContent=String(day);button.setAttribute('role','gridcell');button.setAttribute('aria-label',iso);button.setAttribute('aria-pressed',String(String(control.value??'')===iso));patchMark(button,{patchControlId:control.id||key,patchFocusKey:(control.id||key)+':day:'+iso});button.addEventListener('click',()=>safeTrigger(control.id,'changed',{value:iso}));grid.appendChild(button);}root.append(head,grid);return root;}
function renderControl(control,windowId,controlIndex){return patchMountControl(patchRenderControlElement(control,windowId,controlIndex),control);}function patchRenderControlElement(control,windowId,controlIndex){if(control.type==='text'){const el=document.createElement('p');el.className='text';el.textContent=control.text;return el;}if(control.type==='button'){const el=document.createElement('button');el.type='button';el.className=control.buttonPresentation==='link'?'patch-button patch-linklabel':'patch-button';if(control.buttonPresentation==='link')el.dataset.patchButtonPresentation='link';if(control.imageSource){const img=document.createElement('img');img.className='patch-button-image';img.alt='';img.width=control.imageWidth||16;img.height=control.imageHeight||16;img.src=typeof patchPictureSource==='function'?patchPictureSource(control.imageSource):control.imageSource;el.appendChild(img);}el.append(control.text);el.addEventListener('click',()=>safeTrigger(control.id,'clicked'));return el;}if(control.type==='input'){if(control.inputPresentation==='calendar')return renderCalendar(control);const el=document.createElement('input');if(control.numberEdit){el.type='number';el.step='any';el.inputMode='decimal';el.dataset.patchInputPresentation='number';el.setAttribute('aria-label',String(control.id||'Number')+' number input');}else if(control.inputPresentation==='date'){el.type='date';el.dataset.patchInputPresentation='date';el.setAttribute('aria-label',String(control.id||'Date')+' date input');}else if(control.inputPresentation==='time'){el.type='time';el.dataset.patchInputPresentation='time';el.setAttribute('aria-label',String(control.id||'Time')+' time input');}el.value=control.value??'';el.placeholder=control.text||control.id||'';el.addEventListener('input',()=>safeTrigger(control.id,'changed',{value:el.value}));return el;}if(control.type==='checkbox'){const label=document.createElement('label');label.className='checkbox';const el=document.createElement('input');el.type='checkbox';el.checked=control.value===true;const text=document.createElement('span');text.textContent=control.text;el.addEventListener('change',()=>safeTrigger(control.id,'changed',{value:el.checked}));label.append(el,text);return label;}if(control.type==='combo'||control.type==='listbox'){const el=document.createElement('select');if(control.type==='listbox')el.size=Math.min(8,Math.max(2,(control.options??[]).length));for(const option of control.options??[]){const item=document.createElement('option');item.value=option;item.textContent=option;el.appendChild(item);}el.value=String(control.value??'');el.addEventListener('change',()=>safeTrigger(control.id,'changed',{value:el.value}));return el;}if(control.type==='tree')return renderTree(control);if(control.type==='tabs')return renderTabs(control,windowId,controlIndex);return null;}
function renderTree(control){const root=document.createElement('ul');root.className='patch-tree';root.setAttribute('role','tree');const renderNodes=(nodes,path=[])=>{const fragment=document.createDocumentFragment();for(const node of nodes??[]){const item=document.createElement('li');item.setAttribute('role','treeitem');const selectedPath=[...path,node.text];const button=document.createElement('button');button.type='button';button.className='patch-tree-node';if(node.hint){button.title=node.hint;button.dataset.patchTreeHint='true';}if(node.state){button.dataset.patchTreeState=node.state;button.setAttribute('aria-description','Node state: '+node.state);}if(node.imageSource){const img=document.createElement('img');img.className='patch-tree-node-image';img.alt='';img.width=node.imageWidth||16;img.height=node.imageHeight||16;img.src=typeof patchPictureSource==='function'?patchPictureSource(node.imageSource):node.imageSource;button.appendChild(img);}button.append(node.text);if(node.state){const stateBadge=document.createElement('span');stateBadge.className='patch-tree-node-state';stateBadge.setAttribute('aria-hidden','true');stateBadge.textContent=node.state;button.appendChild(stateBadge);}button.setAttribute('aria-label',selectedPath.join(' / '));patchMark(button,{patchControlId:control.id||'tree',patchFocusKey:(control.id||'tree')+':node:'+selectedPath.join('/')});button.addEventListener('click',()=>safeTrigger(control.id,'changed',{value:selectedPath}));item.appendChild(button);if(node.children?.length){const group=document.createElement('ul');group.setAttribute('role','group');group.appendChild(renderNodes(node.children,selectedPath));item.appendChild(group);}fragment.appendChild(item);}return fragment;};root.appendChild(renderNodes(control.nodes));return root;}
function renderTabs(control,windowId,controlIndex){const root=document.createElement('div');root.className='patch-tabs';root.dataset.tabsId=control.id||'';const pages=control.pages??[];const key=windowId+':'+(control.id||controlIndex);let selected=tabSelections.get(key)??0;if(!Number.isInteger(selected)||selected<0||selected>=pages.length)selected=0;tabSelections.set(key,selected);const list=document.createElement('div');list.className='patch-tabs-list';list.setAttribute('role','tablist');patchMark(list,{patchScrollId:(control.id||key)+':tabs'});pages.forEach((page,index)=>{const button=document.createElement('button');button.type='button';button.className='patch-tab-button';button.textContent=page.title;button.setAttribute('role','tab');button.setAttribute('aria-selected',index===selected?'true':'false');patchMark(button,{patchControlId:control.id||key,patchFocusKey:(control.id||key)+':tab:'+index});button.addEventListener('click',()=>{tabSelections.set(key,index);render();});list.appendChild(button);});const panel=document.createElement('div');panel.className='patch-tab-panel';panel.setAttribute('role','tabpanel');patchMark(panel,{patchScrollId:(control.id||key)+':panel'});for(const nested of pages[selected]?.controls??[]){const el=renderControl(nested,windowId,0);if(el)panel.appendChild(el);}root.append(list,panel);return root;}
function patchMark(el,attrs){if(!el?.dataset||!attrs)return el;for(const key of Object.keys(attrs)){const value=attrs[key];if(value===undefined||value===null||value==='')continue;if(!el.dataset[key])el.dataset[key]=String(value);}return el;}
function patchMountControl(el,control){if(!el)return el;const id=String(control?.id||'');const tag=String(el.tagName||'').toUpperCase();const focus=id&&(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||tag==='BUTTON')?id:'';return patchMark(el,{patchControlId:id,patchScrollId:id,patchFocusKey:focus});}
function patchFind(datasetKey,value){if(!value||typeof appEl.querySelectorAll!=='function')return null;const attr='data-'+String(datasetKey).replace(/[A-Z]/g,ch=>'-'+ch.toLowerCase());try{for(const el of appEl.querySelectorAll('['+attr+']')){if((el.dataset&&el.dataset[datasetKey]===value)||el.getAttribute?.(attr)===value)return el;}}catch{}return null;}
function patchCaret(el){if(!el)return null;const tag=String(el.tagName||'').toUpperCase();if(tag!=='TEXTAREA'&&tag!=='INPUT')return null;const type=String(el.type||'text').toLowerCase();if(tag==='INPUT'&&type!=='text'&&type!=='search'&&type!=='url'&&type!=='tel'&&type!=='password'&&type!=='')return null;try{if(typeof el.selectionStart!=='number')return null;return {start:el.selectionStart,end:typeof el.selectionEnd==='number'?el.selectionEnd:el.selectionStart};}catch{return null;}}
function capturePatchView(){const view={focusId:'',focusKey:'',selectionStart:null,selectionEnd:null,scrolls:[],pageTop:null,pageLeft:null};try{const active=document.activeElement;const focusEl=active&&typeof appEl.contains==='function'&&appEl.contains(active)?active:null;const host=focusEl&&typeof focusEl.closest==='function'?focusEl.closest('[data-patch-control-id]'):null;view.focusId=host?.dataset?.patchControlId||'';view.focusKey=focusEl?.dataset?.patchFocusKey||'';const caret=patchCaret(focusEl);if(caret){view.selectionStart=caret.start;view.selectionEnd=caret.end;}if(typeof appEl.querySelectorAll==='function'){for(const el of appEl.querySelectorAll('[data-patch-scroll-id]')){const id=el?.dataset?.patchScrollId||'';if(id)view.scrolls.push({id,top:Number(el.scrollTop)||0,left:Number(el.scrollLeft)||0});}}const page=document.scrollingElement||document.documentElement;if(page){view.pageTop=Number(page.scrollTop)||0;view.pageLeft=Number(page.scrollLeft)||0;}}catch{}return view;}
function restorePatchView(view){if(!view)return;const applyScroll=()=>{for(const item of view.scrolls){const el=patchFind('patchScrollId',item.id);if(!el)continue;el.scrollTop=item.top;el.scrollLeft=item.left;}if(typeof view.pageTop==='number'){const page=document.scrollingElement||document.documentElement;if(page){page.scrollTop=view.pageTop;page.scrollLeft=view.pageLeft||0;}}};try{applyScroll();let target=view.focusKey?patchFind('patchFocusKey',view.focusKey):null;if(!target&&view.focusId){const host=patchFind('patchControlId',view.focusId);if(host){const tag=String(host.tagName||'').toUpperCase();if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||tag==='BUTTON')target=host;else if(typeof host.querySelector==='function')target=host.querySelector('input,textarea,select,button')||host;else target=host;}}if(target&&typeof target.focus==='function'){try{target.focus({preventScroll:true});}catch{try{target.focus();}catch{}}}if(target&&view.selectionStart!==null&&typeof target.setSelectionRange==='function'){const length=String(target.value??'').length;const start=Math.min(view.selectionStart,length);const end=Math.min(view.selectionEnd??start,length);try{target.setSelectionRange(start,end);}catch{}}applyScroll();}catch{}}
function renderMenuBar(menus){if(!menus?.length)return null;const bar=document.createElement('nav');bar.className='patch-menu-bar';bar.setAttribute('aria-label','Application menu');for(const menu of menus){const details=document.createElement('details');details.className='patch-menu';const summary=document.createElement('summary');summary.textContent=menu.title;const items=document.createElement('div');items.className='patch-menu-items';items.setAttribute('role','menu');for(const entry of menu.items??[]){if(entry.type==='separator'){const separator=document.createElement('hr');separator.className='patch-menu-separator';separator.setAttribute('role','separator');items.appendChild(separator);continue;}const button=document.createElement('button');button.type='button';button.className='patch-menu-item';button.disabled=entry.enabled===false;button.setAttribute('role',entry.checked?'menuitemcheckbox':'menuitem');if(entry.checked)button.setAttribute('aria-checked','true');const check=document.createElement('span');check.className='patch-menu-check';check.textContent=entry.checked?'✓':'';const label=document.createElement('span');label.textContent=entry.text;const shortcut=document.createElement('kbd');shortcut.className='patch-menu-shortcut';shortcut.textContent=entry.shortcut||'';button.append(check,label,shortcut);button.addEventListener('click',()=>{details.removeAttribute('open');safeTrigger(entry.id,'clicked');});items.appendChild(button);}details.append(summary,items);bar.appendChild(details);}return bar;}
function render(){const view=capturePatchView();const models=buildUI();appEl.innerHTML='';if(!models.length){appEl.innerHTML='<section class="console"><strong>No Patch window is defined.</strong></section>';return;}for(const model of models){const shell=document.createElement('section');shell.className='window';shell.hidden=model.visible===false;const title=document.createElement('header');if(model.icon){const img=document.createElement('img');img.className='patch-window-icon';img.alt='';img.width=16;img.height=16;img.src=typeof patchPictureSource==='function'?patchPictureSource(model.icon):model.icon;title.appendChild(img);}title.append(model.title);const menuBar=renderMenuBar(model.menus);const body=document.createElement('div');body.className='body';patchMark(body,{patchScrollId:model.id+':body'});model.controls.forEach((control,index)=>{const el=renderControl(control,model.id,index);if(el)body.appendChild(el);});shell.appendChild(title);if(menuBar)shell.appendChild(menuBar);shell.appendChild(body);appEl.append(shell);}restorePatchView(view);}
function showOutput(){outputEl.textContent=output.join('\n');}
function fail(error){appEl.innerHTML='<section class="console"><strong>Patch stopped</strong><p></p></section>';appEl.querySelector('p').textContent=error?.message??String(error);}
function safeTrigger(control,event,payload={}){try{trigger(control,event,payload);}catch(error){fail(error);}}
function shortcutMatches(event,shortcut){const parts=String(shortcut||'').split('+').map(part=>part.trim()).filter(Boolean);if(!parts.length)return false;const key=parts.pop();const modifiers=new Set(parts.map(part=>part.toLowerCase()));const apple=typeof navigator!=='undefined'&&/Mac|iPhone|iPad/i.test(String(navigator.platform||''));const wantsPrimary=modifiers.has('primary');const wantsCtrl=modifiers.has('ctrl')||(wantsPrimary&&!apple);const wantsMeta=modifiers.has('meta')||(wantsPrimary&&apple);const wantsAlt=modifiers.has('alt')||modifiers.has('option');const wantsShift=modifiers.has('shift');if(Boolean(event.ctrlKey)!==wantsCtrl||Boolean(event.metaKey)!==wantsMeta||Boolean(event.altKey)!==wantsAlt||Boolean(event.shiftKey)!==wantsShift)return false;return String(event.key||'').toLowerCase()===String(key).toLowerCase();}
function dispatchMenuShortcut(event){if(event.defaultPrevented)return;for(const model of buildUI()){if(model.visible===false)continue;for(const menu of model.menus??[]){for(const item of menu.items??[]){if(item.type!=='item'||item.enabled===false||!item.shortcut)continue;if(!shortcutMatches(event,item.shortcut))continue;event.preventDefault();safeTrigger(item.id,'clicked');return;}}}}
document.addEventListener('keydown',dispatchMenuShortcut);
try{executeBlock(PROGRAM,{});render();showOutput();}catch(error){fail(error);}
`;
}
