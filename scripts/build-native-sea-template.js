#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const name = safeName(option('--name') ?? 'PatchConsoleRuntime');
const outBase = option('--out') ?? path.join('dist', name);
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
  return `const fs=require('node:fs');\nconst path=require('node:path');\nconst {spawnSync}=require('node:child_process');\nconst payloadDir=process.platform==='darwin'?path.resolve(path.dirname(process.execPath),'..','..','..'):path.dirname(process.execPath);\nconst wasmPath=path.join(payloadDir,'app.wasm');\nconst metaPath=path.join(payloadDir,'patch-app.json');\nif(!fs.existsSync(wasmPath)||!fs.existsSync(metaPath)){console.error('Patch app payload is missing. Keep app.wasm and patch-app.json beside the runtime package.');process.exit(2);}\nconst meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));\nconst APP_NAME=String(meta.name||'Patch App');\nconst WASM=fs.readFileSync(wasmPath);\nconst lines=[];\n(async()=>{const imports={patch:{show_number(value){const line=formatNumber(value);lines.push(line);console.log(line);},change_number(_targetId,_before,_after){}}};const result=await WebAssembly.instantiate(WASM,imports);const instance=result.instance??result;instance.exports.run();if(!process.env.PATCH_NATIVE_HEADLESS&&lines.length)present(lines.join('\\n'));})().catch(error=>{console.error('Patch app stopped: '+(error?.stack||error?.message||String(error)));process.exitCode=1;});\nfunction formatNumber(value){return Number.isFinite(value)&&Number.isInteger(value)?String(value):String(value)}\nfunction present(text){if(process.platform==='darwin'){spawnSync('/usr/bin/osascript',['-e','on run argv','-e','display dialog (item 1 of argv) with title (item 2 of argv)','-e','end run',text,APP_NAME],{stdio:'ignore'});}else if(process.platform==='win32'){spawnSync('powershell',['-NoProfile','-Command','Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show($env:PATCH_OUTPUT,$env:PATCH_TITLE) | Out-Null'],{env:{...process.env,PATCH_OUTPUT:text,PATCH_TITLE:APP_NAME},stdio:'ignore'});}}\n`;
}

function writeMacApp(binary, appPath, appName) {
  fs.rmSync(appPath, { recursive: true, force: true });
  const macos = path.join(appPath, 'Contents', 'MacOS');
  fs.mkdirSync(macos, { recursive: true });
  const executable = safeName(appName);
  const target = path.join(macos, executable);
  fs.copyFileSync(binary, target);
  fs.chmodSync(target, 0o755);
  fs.writeFileSync(path.join(appPath, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>CFBundleName</key><string>Patch Runtime</string>\n<key>CFBundleDisplayName</key><string>Patch Runtime</string>\n<key>CFBundleExecutable</key><string>${xml(executable)}</string>\n<key>CFBundleIdentifier</key><string>org.patchlang.console-runtime</string>\n<key>CFBundlePackageType</key><string>APPL</string>\n<key>CFBundleShortVersionString</key><string>0.1</string>\n<key>CFBundleVersion</key><string>1</string>\n</dict></plist>\n`, 'utf8');
}

function option(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
function safeName(value) { return String(value || 'PatchConsoleRuntime').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'PatchConsoleRuntime'; }
function ensureExtension(value, ext) { return value.toLowerCase().endsWith(ext.toLowerCase()) ? value : `${value}${ext}`; }
function xml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[c]); }
function runOptional(command, commandArgs) { const result = spawnSync(command, commandArgs, { stdio: 'inherit' }); if (result.error && result.error.code !== 'ENOENT') fail(`${command} failed: ${result.error.message}`); if (!result.error && result.status !== 0) fail(`${command} exited with status ${result.status}`); }
function fail(message) { console.error(`Patch runtime template packager: ${message}`); process.exit(2); }
