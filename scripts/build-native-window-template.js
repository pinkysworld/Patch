#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ELECTRON_VERSION = '43.2.0';
const PACKAGER_VERSION = '20.0.4';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appName = 'PatchWindowRuntime';
const outDir = path.resolve(process.argv[2] ?? 'dist');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-window-template-'));

try {
  writeProject(temp);
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
  console.log(`Built generic Patch window runtime for ${platform}/${arch} in ${outDir}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function writeProject(dir) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'patch-window-runtime',
    productName: appName,
    version: '0.2.0',
    type: 'module',
    main: 'main.cjs'
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'main.cjs'), mainProcessSource());
  fs.writeFileSync(path.join(dir, 'preload.cjs'), preloadSource());
  fs.writeFileSync(path.join(dir, 'player.html'), playerHtml());
  fs.writeFileSync(path.join(dir, 'player.js'), playerJs());
  fs.cpSync(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true });
}

function mainProcessSource() {
  return `const { app, BrowserWindow, ipcMain } = require('electron');\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst MAX_PAYLOAD_BYTES=8*1024*1024;\nfunction payloadPath(){const exeDir=path.dirname(process.execPath);return process.platform==='darwin'?path.resolve(exeDir,'..','..','..','patch-app.json'):path.resolve(exeDir,'..','patch-app.json');}\nfunction readPayload(){const file=payloadPath();const stat=fs.statSync(file);if(stat.size<=0||stat.size>MAX_PAYLOAD_BYTES)throw new Error('Patch Window payload size is outside the supported safety limit.');let payload;try{payload=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new Error('Patch Window payload is not valid JSON.');}validatePayload(payload);return payload;}\nfunction validatePayload(payload){if(!payload||typeof payload!=='object')throw new Error('Patch Window payload must be an object.');if(payload.format!=='patch-prebuilt-native-payload')throw new Error('Patch Window payload format is unsupported.');if(payload.version!=='0.2')throw new Error('Patch Window payload version is unsupported.');if(payload.kind!=='window')throw new Error('Patch Window payload kind must be window.');if(typeof payload.name!=='string'||!payload.name.trim())throw new Error('Patch Window payload needs a project name.');if(typeof payload.source!=='string')throw new Error('Patch Window payload source is missing.');}\nfunction safePayload(){try{return readPayload();}catch(error){return{name:'Patch App',source:'',loadError:error?.message||String(error)};}}\nif (process.argv.includes('--patch-smoke')) {\n  app.whenReady().then(() => app.quit());\n} else if (process.argv.includes('--patch-payload-smoke')) {\n  app.whenReady().then(() => { readPayload(); app.quit(); }).catch(error => { console.error(error?.stack||error?.message||String(error)); process.exitCode=1; app.quit(); });\n} else {\n  app.whenReady().then(() => {\n    const payload=safePayload();\n    ipcMain.handle('patch:payload',()=>payload);\n    const win = new BrowserWindow({\n      width: 900, height: 640, minWidth: 480, minHeight: 360,\n      title: 'Patch App',\n      webPreferences: {\n        preload: path.join(__dirname, 'preload.cjs'),\n        contextIsolation: true, nodeIntegration: false, sandbox: true\n      }\n    });\n    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));\n    win.webContents.on('will-navigate',event=>event.preventDefault());\n    win.loadFile(path.join(__dirname, 'player.html'));\n  });\n  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });\n}\n`;
}

function preloadSource() {
  return `const { contextBridge, ipcRenderer } = require('electron');\ncontextBridge.exposeInMainWorld('patchApp',{load:()=>ipcRenderer.invoke('patch:payload')});\n`;
}

function playerHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Patch App</title><style>${playerCss()}</style></head><body><main id="app"><p class="empty">Starting Patch…</p></main><pre id="output" hidden></pre><script type="module" src="./player.js"></script></body></html>`;
}

function playerJs() {
  return `import { PatchInterpreter } from './src/interpreter.js';\nimport { triggerWindowEvent } from './src/window-events.js';\nlet payload;\ntry{payload=await globalThis.patchApp?.load?.();}catch(error){payload={name:'Patch App',source:'',loadError:'Could not load Patch app payload. '+(error?.message||String(error))};}\npayload=payload??{name:'Patch App',source:'',loadError:'Patch app payload bridge is unavailable.'};\nconst PATCH_SOURCE=String(payload.source??'');\nconst PATCH_APP_NAME=String(payload.name??'Patch App');\ndocument.title=PATCH_APP_NAME;\nconst appEl=document.querySelector('#app'); const output=document.querySelector('#output'); let runtime;\nif(payload.loadError){ fail(new Error(payload.loadError)); } else { try { runtime=new PatchInterpreter(); const result=runtime.run(PATCH_SOURCE); render(result.ui); showOutput(result.output); } catch(error){ fail(error); } }\nfunction render(windows){ appEl.innerHTML=''; if(!windows?.length){ appEl.innerHTML='<section class="console"><h1>Patch</h1><p>No window is defined in this project.</p></section>'; return; } for(const model of windows){ const shell=document.createElement('section'); shell.className='window'; const title=document.createElement('header'); title.textContent=model.title||PATCH_APP_NAME; const body=document.createElement('div'); body.className='body'; for(const control of model.controls){ if(control.type==='text'){const el=document.createElement('p'); el.className='text'; el.textContent=control.text; body.append(el);} else if(control.type==='button'){const el=document.createElement('button'); el.textContent=control.text; el.addEventListener('click',()=>trigger(control.id,'clicked')); body.append(el);} else if(control.type==='input'){const el=document.createElement('input'); el.value=control.value??''; el.placeholder=control.id??''; el.addEventListener('input',()=>trigger(control.id,'changed',{value:el.value})); body.append(el);} } shell.append(title,body); appEl.append(shell); } }\nfunction trigger(control,event,eventPayload={}){ try { const result=triggerWindowEvent(runtime,control,event,eventPayload); render(result.ui); showOutput(result.output); } catch(error){ fail(error); } }\nfunction showOutput(lines){ if(lines?.length){ output.hidden=false; output.textContent=lines.join('\\n'); } }\nfunction fail(error){ appEl.innerHTML='<section class="console"><h1>Patch stopped</h1><p></p></section>'; appEl.querySelector('p').textContent=error?.message??String(error); }\n`;
}

function playerCss() {
  return `:root{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark;background:#f3f4f6;color:#171717}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px;background:#f3f4f6}#app{max-width:760px;margin:0 auto}.window,.console{overflow:hidden;border:1px solid #d4d4d8;border-radius:14px;background:#fff;box-shadow:0 20px 55px #0002;color:#18181b}.window header{padding:11px 15px;border-bottom:1px solid #e4e4e7;background:#f4f4f5;font-size:13px;font-weight:750}.body{min-height:260px;padding:28px;display:flex;flex-direction:column;align-items:flex-start;gap:16px}.text{margin:0;font-size:20px}.body button{border:0;border-radius:9px;background:#18181b;color:#fff;padding:10px 16px;font-weight:700;cursor:pointer}.body input{min-width:260px;border:1px solid #d4d4d8;border-radius:9px;padding:10px 12px;background:#fff;color:#18181b}.console{padding:28px}.console h1{margin-top:0}pre{max-width:760px;margin:18px auto 0;padding:14px;border-radius:10px;background:#18181b;color:#fafafa;white-space:pre-wrap}@media(prefers-color-scheme:dark){:root,body{background:#111318;color:#f4f4f5}.window,.console{background:#1b1d22;color:#f4f4f5;border-color:#34363e}.window header{background:#24262d;border-color:#34363e}.body input{background:#17191e;color:#f4f4f5;border-color:#41444e}.body button{background:#f4f4f5;color:#18181b}}`;
}
