import { compile } from './compiler.js';
import { compileToDirectWasm } from './wasm-direct.js';
import { buildStandaloneWindowWebApp } from './window-webapp.js';
import { enhanceStandaloneWindowWebApp } from './window-web-accessibility.js';
import { enhanceStandaloneWindowPaintBoxes } from './window-web-paintbox.js';
import { validateStudioResources } from './studio-resources.js';
import { PATCH_FORM_LAYOUT_VERSION, buildFormLayoutManifest } from './form-layout.js';
import { PATCH_WINDOW_LAYOUT_POLICY_VERSION, validateWindowLayoutPolicyManifest } from './window-layout-policy.js';

export const PATCH_STANDALONE_WEB_VERSION = '0.2';
const PICTURE_RESOURCE_PREFIX = 'patch-resource:';

export function buildStandaloneWebApp(source, options = {}) {
  const name = safeName(options.name ?? 'PatchApp');
  const entry = options.entry ?? 'main.patch';
  const requestedKind = options.kind ?? null;

  if (requestedKind === 'window') {
    const compiled = compile(source, { ...options, name, kind: 'window', entry });
    return enhanceStandaloneWindowPaintBoxes(enhanceStandaloneWindowWebApp(addSourceBackedWindowLayout(addStandaloneWindowPictures(addWindowListboxMultiselect(addReadOnlyWindowTables(buildStandaloneWindowWebApp(compiled, name))), options.resources))));
  }

  if (!requestedKind) {
    const inferred = compile(source, { ...options, name, entry });
    if (inferred.project.kind === 'window') {
      return enhanceStandaloneWindowPaintBoxes(enhanceStandaloneWindowWebApp(addSourceBackedWindowLayout(addStandaloneWindowPictures(addWindowListboxMultiselect(addReadOnlyWindowTables(buildStandaloneWindowWebApp(inferred, name))), options.resources))));
    }
  }

  return buildStandaloneConsoleWebApp(source, { ...options, name, kind: 'console', entry });
}

function addWindowListboxMultiselect(built) {
  if (!hasListBackedListbox(built.compiled?.ast ?? [])) return built;
  let html = built.html;

  const selectionNeedle = 'const tabSelections=new Map();';
  if (!html.includes(selectionNeedle)) throw new Error('Standalone Window ListBox selection hook is unavailable.');
  html = html.replace(selectionNeedle, `${selectionNeedle}\nconst listboxSelections=new Map();`);

  const validationNeedle = "if((type==='combo'||type==='listbox')&&typeof payload.value!=='string')throw new PatchAppError(\"The 'changed' action for \"+type+\" '\"+control+\"' needs a text event-local value.\");";
  const validationReplacement = "if(type==='combo'&&typeof payload.value!=='string')throw new PatchAppError(\"The 'changed' action for combo '\"+control+\"' needs a text event-local value.\");if(type==='listbox'){const current=state.get(control);if(Array.isArray(current)){if(!Array.isArray(payload.value)||!payload.value.every(item=>typeof item==='string'))throw new PatchAppError(\"The 'changed' action for listbox '\"+control+\"' needs a text-list event-local value because it is list state.\");}else if(typeof payload.value!=='string')throw new PatchAppError(\"The 'changed' action for listbox '\"+control+\"' needs a text event-local value.\");}";
  if (!html.includes(validationNeedle)) throw new Error('Standalone Window ListBox event validation hook is unavailable.');
  html = html.replace(validationNeedle, validationReplacement);

  const renderNeedle = "if(control.type==='combo'||control.type==='listbox'){const el=document.createElement('select');if(control.type==='listbox')el.size=Math.min(8,Math.max(2,(control.options??[]).length));for(const option of control.options??[]){const item=document.createElement('option');item.value=option;item.textContent=option;el.appendChild(item);}el.value=String(control.value??'');el.addEventListener('change',()=>safeTrigger(control.id,'changed',{value:el.value}));return el;}";
  const renderReplacement = "if(control.type==='combo'||control.type==='listbox'){const el=document.createElement('select');const multi=control.type==='listbox'&&Array.isArray(control.value);const key=windowId+':'+(control.id||controlIndex);let selected=[];if(control.type==='listbox'){el.size=Math.min(8,Math.max(2,(control.options??[]).length));if(multi){el.multiple=true;el.setAttribute('aria-multiselectable','true');selected=listboxSelections.has(key)?listboxSelections.get(key):[...control.value];if(!listboxSelections.has(key))listboxSelections.set(key,[...selected]);}}for(const option of control.options??[]){const item=document.createElement('option');item.value=option;item.textContent=option;if(multi)item.selected=selected.includes(option);el.appendChild(item);}if(!multi)el.value=String(control.value??'');el.addEventListener('change',()=>{const value=multi?[...el.selectedOptions].map(item=>item.value):el.value;if(multi)listboxSelections.set(key,[...value]);safeTrigger(control.id,'changed',{value});});return el;}";
  if (!html.includes(renderNeedle)) throw new Error('Standalone Window ListBox renderer hook is unavailable.');
  html = html.replace(renderNeedle, renderReplacement);

  return {
    ...built,
    html,
    metadata: { ...built.metadata, listboxMultiSelectStage: 1, listboxMultiSelectMode: 'list-state-text-list' }
  };
}

function hasListBackedListbox(ast) {
  const listStates = new Set((ast ?? [])
    .filter(node => node.kind === 'create' && node.valueType === 'list')
    .map(node => node.name));
  if (!listStates.size) return false;
  const contains = nodes => {
    for (const node of nodes ?? []) {
      if (node.kind === 'uiControl' && node.control === 'listbox' && node.id && listStates.has(node.id)) return true;
      if (node.kind === 'tabs' && (node.body ?? []).some(page => contains(page.body))) return true;
      if (node.kind === 'window' && contains(node.body)) return true;
    }
    return false;
  };
  return contains(ast);
}

function addReadOnlyWindowTables(built) {
  const hasTable = (built.compiled?.ast ?? []).some(windowNode => windowNode.kind === 'window' && containsTable(windowNode.body));
  if (!hasTable) return built;
  let html = built.html;
  const modelNeedles = [
    "options:Array.isArray(node.options)?node.options.map(uiOption):[],nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],value:",
    "options:Array.isArray(node.options)?node.options.map(uiOption):[],value:"
  ];
  const modelNeedle = modelNeedles.find(needle => html.includes(needle));
  if (!modelNeedle) throw new Error('Standalone Window table model hook is unavailable.');
  const modelReplacement = modelNeedle.replace(
    'value:',
    "columns:Array.isArray(node.columns)?node.columns.map(uiOption):[],rows:Array.isArray(node.rows)?node.rows.map(row=>row.map(uiOption)):[],value:"
  );
  html = html.replace(modelNeedle, modelReplacement);

  const selectionNeedle = 'const tabSelections=new Map();';
  if (!html.includes(selectionNeedle)) throw new Error('Standalone Window table selection hook is unavailable.');
  html = html.replace(selectionNeedle, `${selectionNeedle}\nconst tableSelections=new Map();`);

  const renderNeedle = "if(control.type==='tabs')return renderTabs(control,windowId,controlIndex);return null;}";
  const renderReplacement = "if(control.type==='table')return renderTable(control);if(control.type==='tabs')return renderTabs(control,windowId,controlIndex);return null;}";
  if (!html.includes(renderNeedle)) throw new Error('Standalone Window table renderer hook is unavailable.');
  html = html.replace(renderNeedle, renderReplacement);

  const tabsNeedle = 'function renderTabs(control,windowId,controlIndex){';
  const tableRenderer = "function renderTable(control){const wrap=document.createElement('div');wrap.className='patch-table-wrap';const table=document.createElement('table');table.className='patch-table';const head=document.createElement('thead');const headRow=document.createElement('tr');for(const column of control.columns??[]){const th=document.createElement('th');th.scope='col';th.textContent=column;headRow.appendChild(th);}head.appendChild(headRow);const body=document.createElement('tbody');const key=control.id||'';const selected=tableSelections.get(key)??-1;for(let rowIndex=0;rowIndex<(control.rows??[]).length;rowIndex+=1){const row=control.rows[rowIndex];const tr=document.createElement('tr');tr.tabIndex=0;tr.setAttribute('aria-selected',rowIndex===selected?'true':'false');if(rowIndex===selected)tr.className='patch-table-selected';const selectRow=()=>{tableSelections.set(key,rowIndex);const hasHandler=events.some(handler=>handler.control===control.id&&handler.event==='changed');if(hasHandler)safeTrigger(control.id,'changed',{value:[...row]});else render();};tr.addEventListener('click',selectRow);tr.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRow();}});for(let index=0;index<(control.columns??[]).length;index+=1){const td=document.createElement('td');td.textContent=row[index]??'';tr.appendChild(td);}body.appendChild(tr);}table.append(head,body);wrap.appendChild(table);return wrap;}\n";
  if (!html.includes(tabsNeedle)) throw new Error('Standalone Window table insertion hook is unavailable.');
  html = html.replace(tabsNeedle, tableRenderer + tabsNeedle);

  const cssNeedle = '.checkbox{display:flex;';
  const cssReplacement = '.patch-table-wrap{width:100%;height:100%;overflow:auto;border:1px solid #d4d4d8;border-radius:9px;background:#fff}.patch-table{width:100%;border-collapse:collapse;font-size:13px}.patch-table th,.patch-table td{border-bottom:1px solid #e4e4e7;border-right:1px solid #e4e4e7;padding:7px 9px;text-align:left;vertical-align:top;white-space:nowrap}.patch-table th:last-child,.patch-table td:last-child{border-right:0}.patch-table th{position:sticky;top:0;background:#f4f4f5;font-weight:750}.patch-table tbody tr{cursor:pointer}.patch-table tbody tr:focus-visible{outline:3px solid #2563eb;outline-offset:-3px}.patch-table tr.patch-table-selected td{background:#dbeafe}.patch-table tr:last-child td{border-bottom:0}.checkbox{display:flex;';
  if (!html.includes(cssNeedle)) throw new Error('Standalone Window table stylesheet hook is unavailable.');
  html = html.replace(cssNeedle, cssReplacement);
  html = html.replace('.patch-tabs{background:#1b1d22;', '.patch-table-wrap{background:#1b1d22;border-color:#41444e}.patch-table th,.patch-table td{border-color:#34363e}.patch-table th{background:#24262d}.patch-table tr.patch-table-selected td{background:#1e3a5f}.patch-tabs{background:#1b1d22;');

  return {
    ...built,
    html,
    metadata: { ...built.metadata, tableStage: 2, tableMode: 'transient-row-selection' }
  };
}

function containsTable(nodes) {
  for (const node of nodes ?? []) {
    if (node.kind === 'uiControl' && node.control === 'table') return true;
    if (node.kind === 'tabs' && (node.body ?? []).some(page => containsTable(page.body))) return true;
  }
  return false;
}

function addStandaloneWindowPictures(built, resources = []) {
  if (!hasPicture(built?.compiled?.ast ?? [])) return built;
  const normalized = validateStudioResources(resources);
  validateStaticPictureReferences(built.compiled.ast, normalized);
  const table = Object.fromEntries(normalized.map(resource => [resource.id, { mediaType: resource.mediaType, data: resource.data }]));
  const resourceJson = JSON.stringify(table).replace(/</g, '\\u003c');
  let html = String(built.html ?? '');

  const modelNeedle = "nodes:node.control==='tree'?uiTreeNodes(node.treeNodes):[],";
  if (!html.includes(modelNeedle)) throw new Error('Standalone Window Picture model hook is unavailable.');
  html = html.replace(modelNeedle, `${modelNeedle}source:node.control==='picture'&&node.sourceExpr?uiText(node.sourceExpr):'',`);

  const outputNeedle = "const outputEl=document.getElementById('output');";
  if (!html.includes(outputNeedle)) throw new Error('Standalone Window Picture resource hook is unavailable.');
  html = html.replace(outputNeedle, `${outputNeedle}\nconst PATCH_IMAGE_RESOURCES=Object.freeze(${resourceJson});\nfunction patchPictureSource(source){const value=String(source??'');if(!value.startsWith('${PICTURE_RESOURCE_PREFIX}'))return value;const id=value.slice(${PICTURE_RESOURCE_PREFIX.length});const resource=PATCH_IMAGE_RESOURCES[id];if(!resource)throw new PatchAppError("Picture resource '"+id+"' is not embedded in this app.");return 'data:'+resource.mediaType+';base64,'+resource.data;}`);

  const renderNeedle = "if(control.type==='tree')return renderTree(control);";
  if (!html.includes(renderNeedle)) throw new Error('Standalone Window Picture renderer hook is unavailable.');
  const pictureRenderer = "if(control.type==='picture'){const el=document.createElement('img');el.className='patch-picture';el.src=patchPictureSource(control.source);el.alt=control.text||'';const clickable=Boolean(control.id)&&events.some(handler=>handler.control===control.id&&handler.event==='clicked');if(clickable){el.tabIndex=0;el.setAttribute('role','button');const activate=()=>safeTrigger(control.id,'clicked');el.addEventListener('click',activate);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});}return el;}";
  html = html.replace(renderNeedle, pictureRenderer + renderNeedle);

  const cssNeedle = '.console{padding:20px}';
  if (!html.includes(cssNeedle)) throw new Error('Standalone Window Picture stylesheet hook is unavailable.');
  html = html.replace(cssNeedle, ".patch-picture{display:block;max-width:100%;max-height:100%;object-fit:contain;border:0;background:transparent}.patch-picture[role='button']{cursor:pointer}.patch-picture[role='button']:focus-visible{outline:3px solid #2563eb;outline-offset:2px}.console{padding:20px}");

  return {
    ...built,
    html,
    metadata: {
      ...built.metadata,
      pictureStage: 1,
      pictureResourceModel: normalized.length ? 'embedded-project-resources' : 'quoted-source',
      pictureResourceCount: normalized.length
    }
  };
}

export function pictureResourceDataUri(source, resources = []) {
  const value = String(source ?? '');
  if (!value.startsWith(PICTURE_RESOURCE_PREFIX)) return value;
  const id = value.slice(PICTURE_RESOURCE_PREFIX.length);
  const resource = validateStudioResources(resources).find(item => item.id === id);
  if (!resource) throw new Error(`Picture resource '${id}' is not present in this project.`);
  return `data:${resource.mediaType};base64,${resource.data}`;
}

function validateStaticPictureReferences(ast, resources) {
  const ids = new Set(resources.map(resource => resource.id));
  walkPictureNodes(ast, node => {
    if (node.kind !== 'uiControl' || node.control !== 'picture') return;
    const source = quotedPictureValue(node.sourceExpr);
    if (!source?.startsWith(PICTURE_RESOURCE_PREFIX)) return;
    const id = source.slice(PICTURE_RESOURCE_PREFIX.length);
    if (!ids.has(id)) throw new Error(`line ${node.line ?? '?'}: Picture '${node.id ?? 'unnamed'}' references missing project resource '${id}'.`);
  });
}

function quotedPictureValue(expr) {
  const text = String(expr ?? '').trim();
  if (!(text.startsWith('"') && text.endsWith('"'))) return null;
  try {
    const value = JSON.parse(text);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function hasPicture(nodes) {
  let found = false;
  walkPictureNodes(nodes, node => {
    if (node.kind === 'uiControl' && node.control === 'picture') found = true;
  });
  return found;
}

function walkPictureNodes(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node);
    if (node.body) walkPictureNodes(node.body, visit);
    if (node.thenBody) walkPictureNodes(node.thenBody, visit);
    if (node.elseBody) walkPictureNodes(node.elseBody, visit);
  }
}

function addSourceBackedWindowLayout(built) {
  const layout = buildFormLayoutManifest(built.compiled?.ast ?? []);
  const policy = validateWindowLayoutPolicyManifest(built.compiled?.windowLayoutPolicy ?? {
    format: 'patch-window-layout-policy', version: PATCH_WINDOW_LAYOUT_POLICY_VERSION, windows: []
  });
  if (!layout.windows.some(window => window.width || window.height || window.controls.some(Boolean))) return built;
  const manifest = JSON.stringify(layout).replace(/</g, '\\u003c');
  const policyManifest = JSON.stringify(policy).replace(/</g, '\\u003c');
  const runtime = `<script data-patch-form-layout>\nconst PATCH_FORM_LAYOUT=${manifest};\nconst PATCH_WINDOW_LAYOUT_POLICY=${policyManifest};\nconst PATCH_WINDOW_RUNTIME_SIZES=new Map();\nconst PATCH_WINDOW_RESIZE_OBSERVERS=new WeakMap();\nfunction patchRuntimePolicy(layout,policy,size){\n  const base={x:Number(layout?.x??0),y:Number(layout?.y??0),width:Math.max(16,Number(layout?.width??120)),height:Math.max(16,Number(layout?.height??36))};\n  const p=policy??{kind:'fixed'};const dw=size.width-size.baseWidth;const dh=size.height-size.baseHeight;\n  let x=base.x,y=base.y,width=base.width,height=base.height;\n  if(p.kind==='dock'){if(p.side==='fill')return{x:0,y:0,width:size.width,height:size.height};if(p.side==='top')return{x:0,y:0,width:size.width,height};if(p.side==='bottom')return{x:0,y:Math.max(0,size.height-height),width:size.width,height};if(p.side==='left')return{x:0,y:0,width,height:size.height};return{x:Math.max(0,size.width-width),y:0,width,height:size.height};}\n  if(p.kind==='anchor'){const edges=new Set(p.edges??[]);if(edges.has('left')&&edges.has('right'))width=Math.max(16,width+dw);else if(!edges.has('left')&&edges.has('right'))x=Math.max(0,x+dw);if(edges.has('top')&&edges.has('bottom'))height=Math.max(16,height+dh);else if(!edges.has('top')&&edges.has('bottom'))y=Math.max(0,y+dh);}\n  return{x:Math.round(x),y:Math.round(y),width:Math.round(width),height:Math.round(height)};\n}\nfunction patchApplyFormLayout(){\n  const shells=[...document.querySelectorAll('#app .window')];\n  PATCH_FORM_LAYOUT.windows.forEach((form,index)=>{\n    const shell=shells[index];if(!shell)return;const body=shell.querySelector('.body');if(!body)return;const policyForm=PATCH_WINDOW_LAYOUT_POLICY.windows[index]??{width:form.width??640,height:form.height??420,controls:[]};\n    const baseWidth=Number(form.width??policyForm.width??640);const baseHeight=Number(form.height??policyForm.height??420);const stored=PATCH_WINDOW_RUNTIME_SIZES.get(index);\n    shell.style.maxWidth='none';shell.style.resize='both';shell.style.overflow='auto';shell.style.minWidth='240px';\n    if(!shell.dataset.patchRuntimeLayoutReady){const chromeHeight=Math.max(0,body.offsetTop);const width=stored?.width??baseWidth;const height=stored?.height??baseHeight;shell.style.width=width+'px';shell.style.height=(height+chromeHeight)+'px';shell.dataset.patchRuntimeLayoutReady='1';}\n    const formWidth=Math.max(16,Math.round(shell.clientWidth));const formHeight=Math.max(16,Math.round(shell.clientHeight-Math.max(0,body.offsetTop)));body.style.height=formHeight+'px';body.style.minHeight='0';\n    PATCH_WINDOW_RUNTIME_SIZES.set(index,{width:formWidth,height:formHeight});\n    if(form.controls.some(Boolean)){body.style.position='relative';body.style.display='block';body.style.padding='0';body.style.overflow='hidden';const elements=[...body.children];form.controls.forEach((controlLayout,controlIndex)=>{if(!controlLayout)return;const el=elements[controlIndex];if(!el)return;const controlPolicy=policyForm.controls?.[controlIndex]?.policy??{kind:'fixed'};const next=patchRuntimePolicy(controlLayout,controlPolicy,{width:formWidth,height:formHeight,baseWidth,baseHeight});el.style.position='absolute';el.style.left=next.x+'px';el.style.top=next.y+'px';el.style.width=next.width+'px';el.style.height=next.height+'px';el.style.maxWidth='none';el.style.margin='0';});}\n    if(!PATCH_WINDOW_RESIZE_OBSERVERS.has(shell)&&typeof ResizeObserver==='function'){const observer=new ResizeObserver(()=>patchApplyFormLayout());observer.observe(shell);PATCH_WINDOW_RESIZE_OBSERVERS.set(shell,observer);}\n  });\n}\nnew MutationObserver(patchApplyFormLayout).observe(document.getElementById('app'),{childList:true,subtree:true});\npatchApplyFormLayout();\n</script>`;
  return {
    ...built,
    html: built.html.replace('</body>', `${runtime}\n</body>`),
    metadata: { ...built.metadata, formLayoutVersion: PATCH_FORM_LAYOUT_VERSION, windowLayoutPolicyVersion: PATCH_WINDOW_LAYOUT_POLICY_VERSION }
  };
}

function buildStandaloneConsoleWebApp(source, options) {
  const { name, entry } = options;
  const { module, metadata: directWasmMetadata, compiled } = compileToDirectWasm(source, {
    name,
    kind: 'console',
    entry
  });
  const wasmBase64 = bytesToBase64(module);
  const metadata = {
    format: 'patch-standalone-web',
    version: PATCH_STANDALONE_WEB_VERSION,
    directWasmVersion: directWasmMetadata.version,
    irVersion: directWasmMetadata.irVersion,
    stateTargets: directWasmMetadata.stateTargets,
    projectKind: 'console',
    execution: 'embedded-direct-wasm'
  };
  const meta = JSON.stringify(metadata);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(name)}</title>
<style>
:root{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111318;color:#f6f7f9}.app{width:min(720px,calc(100% - 32px));background:#1a1d24;border:1px solid #30343d;border-radius:16px;box-shadow:0 20px 60px #0007;overflow:hidden}.bar{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #30343d}.bar strong{font-size:15px}.bar span{font-size:12px;color:#9da5b4}.body{padding:20px}pre{margin:0;min-height:120px;white-space:pre-wrap;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}button{margin-top:18px;border:0;border-radius:9px;padding:9px 14px;font-weight:700;cursor:pointer}button:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}small{display:block;margin-top:16px;color:#8992a3}@media(forced-colors:active){button:focus-visible{outline:3px solid Highlight}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}</style>
</head>
<body>
<main class="app">
  <div class="bar"><strong>${escapeHtml(name)}</strong><span>Built with Patch</span></div>
  <div class="body"><pre id="output" role="status" aria-live="polite" aria-atomic="true">Starting…</pre><button id="run">Run again</button><small>Standalone single-file Patch Console Web App</small></div>
</main>
<script>
const PATCH_META=${meta};
const WASM_BASE64=${JSON.stringify(wasmBase64)};
const output=document.getElementById('output');
async function run(){
  const lines=[]; const trace=[];
  output.textContent='';
  try{
    const raw=atob(WASM_BASE64); const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    const imports={patch:{
      show_number(value){lines.push(formatNumber(value));},
      change_number(targetId,before,after){trace.push({target:PATCH_META.stateTargets[targetId]??('#'+targetId),before:Number(before),after:Number(after)});}
    }};
    const result=await WebAssembly.instantiate(bytes,imports);
    const instance=result.instance??result;
    instance.exports.run();
    output.textContent=lines.length?lines.join('\n'):'(program finished with no console output)';
  }catch(error){output.textContent='Patch app stopped:\n'+(error?.message??String(error));}
}
function formatNumber(value){return Number.isFinite(value)&&Number.isInteger(value)?String(value):String(value)}
document.getElementById('run').addEventListener('click',run); run();
</script>
</body>
</html>`;

  return { html, module, metadata, directWasmMetadata, compiled, name };
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  if (typeof btoa === 'function') return btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(binary, 'binary').toString('base64');
  throw new Error('No base64 encoder is available in this environment.');
}

function safeName(name) { return String(name || 'PatchApp').replace(/[^A-Za-z0-9 _.-]/g, '').trim() || 'PatchApp'; }
function escapeHtml(text) { return String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]); }