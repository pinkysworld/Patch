#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compile } from '../src/compiler.js';
import { validateWindowRuntimeSupport } from '../src/window-build.js';

const ELECTRON_VERSION = '43.2.0';
const PACKAGER_VERSION = '20.0.4';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2];
const appName = safeName(process.argv[3] ?? 'PatchWindowApp');
const outDir = path.resolve(process.argv[4] ?? 'dist');

if (!sourcePath) {
  console.error('Use: node scripts/build-native-window.js program.patch AppName dist');
  process.exit(2);
}

const source = fs.readFileSync(path.resolve(sourcePath), 'utf8');
const compiled = compile(source, { name: appName, kind: 'window', entry: path.basename(sourcePath) });
validateWindowRuntimeSupport(compiled);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-window-app-'));

try {
  writeProject(temp, source, appName);
  fs.mkdirSync(outDir, { recursive: true });
  const platform = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = platform === 'darwin' ? 'universal' : process.arch === 'arm64' ? 'arm64' : 'x64';
  const result = spawnSync('npx', [
    '--yes', `@electron/packager@${PACKAGER_VERSION}`, temp, appName,
    `--platform=${platform}`, `--arch=${arch}`, `--electron-version=${ELECTRON_VERSION}`,
    `--out=${outDir}`, '--overwrite', '--prune=true', '--asar'
  ], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Electron Packager exited with status ${result.status}.`);
  console.log(`Built Patch window application for ${platform}/${arch} in ${outDir}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function writeProject(dir, sourceText, name) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: safePackageName(name),
    productName: name,
    version: '0.1.0',
    type: 'module',
    main: 'main.cjs'
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'main.cjs'), mainProcessSource(name));
  fs.writeFileSync(path.join(dir, 'player.html'), playerHtml(name));
  fs.writeFileSync(path.join(dir, 'player.js'), playerJs());
  fs.writeFileSync(path.join(dir, 'program.js'), `export const PATCH_SOURCE = ${JSON.stringify(sourceText)};\nexport const PATCH_APP_NAME = ${JSON.stringify(name)};\n`);
  fs.cpSync(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true });
}

function mainProcessSource(name) {
  return `const { app, BrowserWindow } = require('electron');\nconst path = require('node:path');\n\nif (process.argv.includes('--patch-smoke')) {\n  app.whenReady().then(() => app.quit());\n} else {\n  app.whenReady().then(() => {\n    const win = new BrowserWindow({\n      width: 900, height: 640, minWidth: 480, minHeight: 360,\n      title: ${JSON.stringify(name)},\n      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }\n    });\n    win.loadFile(path.join(__dirname, 'player.html'));\n  });\n  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });\n}\n`;
}

function playerHtml(name) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(name)}</title><style>${playerCss()}</style></head><body><main id="app"><p class="empty">Starting Patch…</p></main><pre id="output" hidden></pre><script type="module" src="./player.js"></script></body></html>`;
}

function playerJs() {
  return `import { PatchInterpreter } from './src/interpreter.js';\nimport { PATCH_SOURCE } from './program.js';\nconst appEl=document.querySelector('#app'); const output=document.querySelector('#output'); let runtime;\ntry { runtime=new PatchInterpreter(); const result=runtime.run(PATCH_SOURCE); render(result.ui); showOutput(result.output); } catch(error){ fail(error); }\nfunction render(windows){ appEl.innerHTML=''; if(!windows?.length){ appEl.innerHTML='<section class="console"><h1>Patch</h1><p>No window is defined in this project.</p></section>'; return; } for(const model of windows){ const shell=document.createElement('section'); shell.className='window'; const title=document.createElement('header'); title.textContent=model.title; const body=document.createElement('div'); body.className='body'; for(const control of model.controls){ if(control.type==='text'){const el=document.createElement('p'); el.className='text'; el.textContent=control.text; body.append(el);} else if(control.type==='button'){const el=document.createElement('button'); el.textContent=control.text; el.addEventListener('click',()=>trigger(control.id,'clicked')); body.append(el);} else if(control.type==='input'){const el=document.createElement('input'); el.value=control.value??''; el.placeholder=control.id??''; body.append(el);} } shell.append(title,body); appEl.append(shell); } }\nfunction trigger(control,event){ try { const result=runtime.trigger(control,event); render(result.ui); showOutput(result.output); } catch(error){ fail(error); } }\nfunction showOutput(lines){ if(lines?.length){ output.hidden=false; output.textContent=lines.join('\\n'); } }\nfunction fail(error){ appEl.innerHTML='<section class="console"><h1>Patch stopped</h1><p></p></section>'; appEl.querySelector('p').textContent=error?.message??String(error); }\n`;
}

function playerCss() {
  return `:root{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark;background:#f3f4f6;color:#171717}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px;background:#f3f4f6}#app{max-width:760px;margin:0 auto}.window,.console{overflow:hidden;border:1px solid #d4d4d8;border-radius:14px;background:#fff;box-shadow:0 20px 55px #0002;color:#18181b}.window header{padding:11px 15px;border-bottom:1px solid #e4e4e7;background:#f4f4f5;font-size:13px;font-weight:750}.body{min-height:260px;padding:28px;display:flex;flex-direction:column;align-items:flex-start;gap:16px}.text{margin:0;font-size:20px}.body button{border:0;border-radius:9px;background:#18181b;color:#fff;padding:10px 16px;font-weight:700;cursor:pointer}.body input{min-width:260px;border:1px solid #d4d4d8;border-radius:9px;padding:10px 12px;background:#fff;color:#18181b}.console{padding:28px}.console h1{margin-top:0}pre{max-width:760px;margin:18px auto 0;padding:14px;border-radius:10px;background:#18181b;color:#fafafa;white-space:pre-wrap}@media(prefers-color-scheme:dark){:root,body{background:#111318;color:#f4f4f5}.window,.console{background:#1b1d22;color:#f4f4f5;border-color:#34363e}.window header{background:#24262d;border-color:#34363e}.body input{background:#17191e;color:#f4f4f5;border-color:#41444e}.body button{background:#f4f4f5;color:#18181b}}`;
}

function safeName(name) { const cleaned=String(name).trim().replace(/[^A-Za-z0-9 _.-]/g,'').replace(/\s+/g,' ').slice(0,80); return cleaned||'PatchWindowApp'; }
function safePackageName(name) { return safeName(name).toLowerCase().replace(/[^a-z0-9._-]/g,'-').replace(/-+/g,'-')||'patch-window-app'; }
function escapeHtml(text) { return String(text).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
