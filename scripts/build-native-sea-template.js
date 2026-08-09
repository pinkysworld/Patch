#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const name = safeName(option('--name') ?? 'PatchConsoleRuntime');
const outBase = option('--out') ?? path.join('dist', name);
const rawOut = option('--raw-out');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-sea-template-'));

try {
  const runnerPath = path.join(temp, 'runner.cjs');
  const configPath = path.join(temp, 'sea-config.json');
  const rawOutput = process.platform === 'win32'
    ? ensureExtension(path.resolve(outBase), '.exe')
    : process.platform === 'darwin'
      ? path.join(temp, name)
      : path.resolve(outBase);

  fs.mkdirSync(path.dirname(rawOutput), { recursive: true });
  fs.writeFileSync(runnerPath, seaRunner(), 'utf8');
  fs.writeFileSync(configPath, JSON.stringify({
    main: runnerPath,
    output: rawOutput,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false
  }, null, 2));

  const sea = spawnSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  if (sea.error) fail(`Could not start Node SEA builder: ${sea.error.message}`);
  if (sea.status !== 0 || !fs.existsSync(rawOutput)) fail('Node SEA template build failed. Node 26+ with --build-sea support is required.');

  if (rawOut) {
    const rawTemplate = path.resolve(rawOut);
    fs.mkdirSync(path.dirname(rawTemplate), { recursive: true });
    fs.copyFileSync(rawOutput, rawTemplate);
    if (process.platform !== 'win32') fs.chmodSync(rawTemplate, 0o755);
    console.log(`Wrote unsigned generic Patch Console runtime ${rawTemplate}`);
  }

  if (process.platform === 'darwin') {
    runOptional('codesign', ['--force', '--sign', '-', rawOutput]);
    const appPath = ensureExtension(path.resolve(outBase), '.app');
    writeMacApp(rawOutput, appPath, name);
    runOptional('codesign', ['--force', '--deep', '--sign', '-', appPath]);
    console.log(`Built generic Patch console runtime ${appPath}`);
    process.exit(0);
  }

  if (process.platform !== 'win32') fs.chmodSync(rawOutput, 0o755);
  console.log(`Built generic Patch console runtime ${rawOutput}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function seaRunner() {
  return `const fs=require('node:fs');\nconst path=require('node:path');\nconst {spawnSync}=require('node:child_process');\nconst MAX_META=64*1024;\nconst MAX_WASM=64*1024*1024;\nconst CRC=makeCrcTable();\nconst embedded=readEmbeddedPayload();\nlet meta,WASM;\nif(embedded){meta=embedded.meta;WASM=embedded.wasm;}else{({meta,wasm:WASM}=readLegacyPayload());}\nconst APP_NAME=String(meta.name||'Patch App');\nconst lines=[];\n(async()=>{const imports={patch:{show_number(value){const line=formatNumber(value);lines.push(line);console.log(line);},change_number(_targetId,_before,_after){}}};const result=await WebAssembly.instantiate(WASM,imports);const instance=result.instance??result;instance.exports.run();if(!process.env.PATCH_NATIVE_HEADLESS&&lines.length)present(lines.join('\\n'));})().catch(error=>{console.error('Patch app stopped: '+(error?.stack||error?.message||String(error)));process.exitCode=1;});\nfunction readEmbeddedPayload(){const footerSize=28;const magic=Buffer.from('PCHSEA01');let fd;try{fd=fs.openSync(process.execPath,'r');const size=fs.fstatSync(fd).size;if(size<footerSize)return null;const footer=Buffer.alloc(footerSize);readExact(fd,footer,size-footerSize);if(!footer.subarray(0,8).equals(magic))return null;const version=footer.readUInt32LE(8);if(version!==1)throw new Error('Unsupported sealed Patch payload version '+version+'.');const metaLength=footer.readUInt32LE(12);const wasmLength=footer.readUInt32LE(16);validateLengths(metaLength,wasmLength);const payloadOffset=size-footerSize-metaLength-wasmLength;if(payloadOffset<0)throw new Error('Sealed Patch payload lengths are invalid.');const metaBytes=Buffer.alloc(metaLength);const wasm=Buffer.alloc(wasmLength);readExact(fd,metaBytes,payloadOffset);readExact(fd,wasm,payloadOffset+metaLength);if(crc32(metaBytes)!==footer.readUInt32LE(20))throw new Error('Sealed Patch metadata CRC mismatch.');if(crc32(wasm)!==footer.readUInt32LE(24))throw new Error('Sealed Patch Wasm CRC mismatch.');let meta;try{meta=JSON.parse(metaBytes.toString('utf8'));}catch{throw new Error('Sealed Patch metadata is not valid JSON.');}validateEmbeddedMeta(meta);validateWasm(wasm);return{meta,wasm};}finally{if(fd!==undefined)fs.closeSync(fd);}}\nfunction readLegacyPayload(){const payloadDir=process.platform==='darwin'?path.resolve(path.dirname(process.execPath),'..','..','..'):path.dirname(process.execPath);const wasmPath=path.join(payloadDir,'app.wasm');const metaPath=path.join(payloadDir,'patch-app.json');if(!fs.existsSync(wasmPath)||!fs.existsSync(metaPath))throw new Error('Patch app payload is missing. This runtime expects a sealed Studio payload or legacy app.wasm + patch-app.json sidecars.');const metaStat=fs.statSync(metaPath);const wasmStat=fs.statSync(wasmPath);if(metaStat.size<=0||metaStat.size>MAX_META)throw new Error('Legacy Patch metadata size is outside the supported safety limit.');if(wasmStat.size<8||wasmStat.size>MAX_WASM)throw new Error('Legacy Patch Wasm size is outside the supported safety limit.');let meta;try{meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));}catch{throw new Error('Legacy Patch metadata is not valid JSON.');}const wasm=fs.readFileSync(wasmPath);validateLegacyMeta(meta);validateWasm(wasm);return{meta,wasm};}\nfunction validateLengths(metaLength,wasmLength){if(metaLength<=0||metaLength>MAX_META)throw new Error('Sealed Patch metadata length is outside the supported safety limit.');if(wasmLength<8||wasmLength>MAX_WASM)throw new Error('Sealed Patch Wasm length is outside the supported safety limit.');}\nfunction validateEmbeddedMeta(meta){if(!meta||typeof meta!=='object'||meta.format!=='patch-sealed-console-payload'||meta.version!=='0.2'||meta.kind!=='console'||typeof meta.name!=='string'||!meta.name.trim())throw new Error('Sealed Patch metadata schema is unsupported.');}\nfunction validateLegacyMeta(meta){if(!meta||typeof meta!=='object'||meta.format!=='patch-prebuilt-native-payload'||!['0.1','0.2'].includes(meta.version)||meta.kind!=='console'||typeof meta.name!=='string'||!meta.name.trim())throw new Error('Legacy Patch Console metadata schema is unsupported.');}\nfunction validateWasm(wasm){const expected=[0,97,115,109,1,0,0,0];if(!wasm||wasm.length<8)throw new Error('Patch payload is not a complete WebAssembly module.');for(let i=0;i<expected.length;i++){if(wasm[i]!==expected[i])throw new Error('Patch payload has an invalid WebAssembly header.');}}\nfunction readExact(fd,buffer,position){let offset=0;while(offset<buffer.length){const count=fs.readSync(fd,buffer,offset,buffer.length-offset,position+offset);if(count<=0)throw new Error('Sealed Patch payload is truncated.');offset+=count;}}\nfunction crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc=CRC[(crc^byte)&255]^(crc>>>8);}return(crc^0xffffffff)>>>0;}\nfunction formatNumber(value){return Number.isFinite(value)&&Number.isInteger(value)?String(value):String(value)}\nfunction present(text){if(process.platform==='darwin'){spawnSync('/usr/bin/osascript',['-e','on run argv','-e','display dialog (item 1 of argv) with title (item 2 of argv)','-e','end run',text,APP_NAME],{stdio:'ignore'});}else if(process.platform==='win32'){spawnSync('powershell',['-NoProfile','-Command','Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show($env:PATCH_OUTPUT,$env:PATCH_TITLE) | Out-Null'],{env:{...process.env,PATCH_OUTPUT:text,PATCH_TITLE:APP_NAME},stdio:'ignore'});}}\nfunction makeCrcTable(){const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table;}\n`;
}

function writeMacApp(binary, appPath, appName) {
  fs.rmSync(appPath, { recursive: true, force: true });
  const macos = path.join(appPath, 'Contents', 'MacOS');
  fs.mkdirSync(macos, { recursive: true });
  const executable = safeName(appName);
  const target = path.join(macos, executable);
  fs.copyFileSync(binary, target);
  fs.chmodSync(target, 0o755);
  fs.writeFileSync(path.join(appPath, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>CFBundleName</key><string>Patch Runtime</string>\n<key>CFBundleDisplayName</key><string>Patch Runtime</string>\n<key>CFBundleExecutable</key><string>${xml(executable)}</string>\n<key>CFBundleIdentifier</key><string>org.patchlang.console-runtime</string>\n<key>CFBundlePackageType</key><string>APPL</string>\n<key>CFBundleShortVersionString</key><string>0.2</string>\n<key>CFBundleVersion</key><string>2</string>\n</dict></plist>\n`, 'utf8');
}

function option(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
function safeName(value) { return String(value || 'PatchConsoleRuntime').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'PatchConsoleRuntime'; }
function ensureExtension(value, ext) { return value.toLowerCase().endsWith(ext.toLowerCase()) ? value : `${value}${ext}`; }
function xml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[c]); }
function runOptional(command, commandArgs) { const result = spawnSync(command, commandArgs, { stdio: 'inherit' }); if (result.error && result.error.code !== 'ENOENT') fail(`${command} failed: ${result.error.message}`); if (!result.error && result.status !== 0) fail(`${command} exited with status ${result.status}`); }
function fail(message) { console.error(`Patch runtime template packager: ${message}`); process.exit(2); }
