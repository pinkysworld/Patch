import { compile } from './compiler.js';
import { compileToDirectWasm } from './wasm-direct.js';
import { buildStandaloneWindowWebApp } from './window-webapp.js';
import { enhanceStandaloneWindowWebApp } from './window-web-accessibility.js';
import { PATCH_FORM_LAYOUT_VERSION, buildFormLayoutManifest } from './form-layout.js';
import { PATCH_WINDOW_LAYOUT_POLICY_VERSION, validateWindowLayoutPolicyManifest } from './window-layout-policy.js';

export const PATCH_STANDALONE_WEB_VERSION = '0.2';

export function buildStandaloneWebApp(source, options = {}) {
  const name = safeName(options.name ?? 'PatchApp');
  const entry = options.entry ?? 'main.patch';
  const requestedKind = options.kind ?? null;

  if (requestedKind === 'window') {
    const compiled = compile(source, { ...options, name, kind: 'window', entry });
    return enhanceStandaloneWindowWebApp(addSourceBackedWindowLayout(buildStandaloneWindowWebApp(compiled, name)));
  }

  if (!requestedKind) {
    const inferred = compile(source, { ...options, name, entry });
    if (inferred.project.kind === 'window') {
      return enhanceStandaloneWindowWebApp(addSourceBackedWindowLayout(buildStandaloneWindowWebApp(inferred, name)));
    }
  }

  return buildStandaloneConsoleWebApp(source, { ...options, name, kind: 'console', entry });
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
