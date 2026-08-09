import { compile } from './compiler.js';
import { compileToDirectWasm } from './wasm-direct.js';
import { buildStandaloneWindowWebApp } from './window-webapp.js';

export const PATCH_STANDALONE_WEB_VERSION = '0.2';
export const PATCH_FORM_LAYOUT_VERSION = '0.1';

export function buildStandaloneWebApp(source, options = {}) {
  const name = safeName(options.name ?? 'PatchApp');
  const entry = options.entry ?? 'main.patch';
  const requestedKind = options.kind ?? null;

  if (requestedKind === 'window') {
    const compiled = compile(source, { ...options, name, kind: 'window', entry });
    return addSourceBackedWindowLayout(buildStandaloneWindowWebApp(compiled, name));
  }

  if (!requestedKind) {
    const inferred = compile(source, { ...options, name, entry });
    if (inferred.project.kind === 'window') return addSourceBackedWindowLayout(buildStandaloneWindowWebApp(inferred, name));
  }

  return buildStandaloneConsoleWebApp(source, { ...options, name, kind: 'console', entry });
}

function addSourceBackedWindowLayout(built) {
  const layout = windowLayoutManifest(built.compiled?.ast ?? []);
  if (!layout.windows.some(window => window.width || window.height || window.controls.some(Boolean))) return built;
  const manifest = JSON.stringify(layout).replace(/</g, '\\u003c');
  const runtime = `<script data-patch-form-layout>\nconst PATCH_FORM_LAYOUT=${manifest};\nfunction patchApplyFormLayout(){\n  const shells=[...document.querySelectorAll('#app .window')];\n  PATCH_FORM_LAYOUT.windows.forEach((form,index)=>{\n    const shell=shells[index]; if(!shell)return; const body=shell.querySelector('.body'); if(!body)return;\n    if(form.width){shell.style.width=form.width+'px';shell.style.maxWidth='100%';}\n    if(form.height)body.style.minHeight=form.height+'px';\n    if(!form.controls.some(Boolean))return;\n    body.style.position='relative';body.style.display='block';body.style.padding='0';body.style.overflow='hidden';\n    const elements=[...body.children];\n    form.controls.forEach((layout,controlIndex)=>{if(!layout)return;const el=elements[controlIndex];if(!el)return;el.style.position='absolute';el.style.left=layout.x+'px';el.style.top=layout.y+'px';if(layout.width!==null)el.style.width=layout.width+'px';if(layout.height!==null)el.style.height=layout.height+'px';el.style.maxWidth='none';el.style.margin='0';});\n  });\n}\nnew MutationObserver(patchApplyFormLayout).observe(document.getElementById('app'),{childList:true,subtree:true});\npatchApplyFormLayout();\n</script>`;
  return {
    ...built,
    html: built.html.replace('</body>', `${runtime}\n</body>`),
    metadata: { ...built.metadata, formLayoutVersion: PATCH_FORM_LAYOUT_VERSION }
  };
}

function windowLayoutManifest(ast) {
  return {
    format: 'patch-source-backed-form-layout',
    version: PATCH_FORM_LAYOUT_VERSION,
    windows: ast.filter(node => node.kind === 'window').map(node => ({
      width: node.width ?? null,
      height: node.height ?? null,
      controls: (node.body ?? []).filter(child => child.kind === 'uiControl').map(child => child.layout ?? null)
    }))
  };
}

function buildStandaloneConsoleWebApp(source, options) {
  const { name, entry } = options;
  const { module, metadata, compiled } = compileToDirectWasm(source, {
    name,
    kind: 'console',
    entry
  });
  const wasmBase64 = bytesToBase64(module);
  const meta = JSON.stringify({
    format: 'patch-standalone-web',
    version: PATCH_STANDALONE_WEB_VERSION,
    directWasmVersion: metadata.version,
    irVersion: metadata.irVersion,
    stateTargets: metadata.stateTargets,
    projectKind: 'console'
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(name)}</title>
<style>
:root{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111318;color:#f6f7f9}.app{width:min(720px,calc(100% - 32px));background:#1a1d24;border:1px solid #30343d;border-radius:16px;box-shadow:0 20px 60px #0007;overflow:hidden}.bar{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #30343d}.bar strong{font-size:15px}.bar span{font-size:12px;color:#9da5b4}.body{padding:20px}pre{margin:0;min-height:120px;white-space:pre-wrap;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace}button{margin-top:18px;border:0;border-radius:9px;padding:9px 14px;font-weight:700;cursor:pointer}small{display:block;margin-top:16px;color:#8992a3}</style>
</head>
<body>
<main class="app">
  <div class="bar"><strong>${escapeHtml(name)}</strong><span>Built with Patch</span></div>
  <div class="body"><pre id="output">Starting…</pre><button id="run">Run again</button><small>Standalone single-file Patch Console Web App</small></div>
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

  return { html, module, metadata, compiled, name };
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
