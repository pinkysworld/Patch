#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileToDirectWasm } from '../src/wasm-direct.js';

const args = process.argv.slice(2);
const sourcePath = args.shift();
if (!sourcePath) fail('Usage: node scripts/build-native-sea.js app.patch --name App --out dist/App');
const name = safeName(option('--name') ?? path.basename(sourcePath, path.extname(sourcePath)) ?? 'PatchApp');
const outBase = option('--out') ?? name;
const source = fs.readFileSync(sourcePath, 'utf8');
const built = compileToDirectWasm(source, { name, kind: 'console', entry: path.basename(sourcePath) });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-sea-'));

try {
  const runnerPath = path.join(temp, 'runner.cjs');
  const configPath = path.join(temp, 'sea-config.json');
  const rawOutput = process.platform === 'win32'
    ? ensureExtension(path.resolve(outBase), '.exe')
    : process.platform === 'darwin'
      ? path.join(temp, name)
      : path.resolve(outBase);

  fs.mkdirSync(path.dirname(rawOutput), { recursive: true });
  fs.writeFileSync(runnerPath, seaRunner(built.module, built.metadata, name), 'utf8');
  fs.writeFileSync(configPath, JSON.stringify({
    main: runnerPath,
    output: rawOutput,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false
  }, null, 2));

  const sea = spawnSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  if (sea.error) fail(`Could not start Node SEA builder: ${sea.error.message}`);
  if (sea.status !== 0 || !fs.existsSync(rawOutput)) {
    fail('Node SEA build failed. Patch Studio native cloud builds require a Node release with --build-sea support.');
  }

  if (process.platform === 'darwin') {
    runOptional('codesign', ['--force', '--sign', '-', rawOutput]);
    const appPath = ensureExtension(path.resolve(outBase), '.app');
    writeMacApp(rawOutput, appPath, name);
    runOptional('codesign', ['--force', '--deep', '--sign', '-', appPath]);
    console.log(`Built ${appPath}`);
    process.exit(0);
  }

  if (process.platform !== 'win32') fs.chmodSync(rawOutput, 0o755);
  console.log(`Built ${rawOutput}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function seaRunner(moduleBytes, metadata, appName) {
  const wasm = Buffer.from(moduleBytes).toString('base64');
  const stateTargets = JSON.stringify(metadata.stateTargets ?? []);
  return `const { spawnSync } = require('node:child_process');\nconst APP_NAME=${JSON.stringify(appName)};\nconst WASM=Buffer.from(${JSON.stringify(wasm)},'base64');\nconst STATE_TARGETS=${stateTargets};\nconst lines=[];\n(async()=>{\n  const imports={patch:{\n    show_number(value){const line=formatNumber(value); lines.push(line); console.log(line);},\n    change_number(_targetId,_before,_after){}\n  }};\n  const result=await WebAssembly.instantiate(WASM,imports);\n  const instance=result.instance??result;\n  instance.exports.run();\n  if(!process.env.PATCH_NATIVE_HEADLESS && lines.length) present(lines.join('\\n'));\n})().catch(error=>{console.error('Patch app stopped: '+(error?.stack||error?.message||String(error))); process.exitCode=1;});\nfunction formatNumber(value){return Number.isFinite(value)&&Number.isInteger(value)?String(value):String(value)}\nfunction present(text){\n  if(process.platform==='darwin'){spawnSync('/usr/bin/osascript',['-e','on run argv','-e','display dialog (item 1 of argv) with title (item 2 of argv)','-e','end run',text,APP_NAME],{stdio:'ignore'});}\n  else if(process.platform==='win32'){spawnSync('powershell',['-NoProfile','-Command','Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show($env:PATCH_OUTPUT,$env:PATCH_TITLE) | Out-Null'],{env:{...process.env,PATCH_OUTPUT:text,PATCH_TITLE:APP_NAME},stdio:'ignore'});}\n}\n`;
}

function writeMacApp(binary, appPath, appName) {
  fs.rmSync(appPath, { recursive: true, force: true });
  const macos = path.join(appPath, 'Contents', 'MacOS');
  fs.mkdirSync(macos, { recursive: true });
  const executable = safeName(appName);
  const target = path.join(macos, executable);
  fs.copyFileSync(binary, target);
  fs.chmodSync(target, 0o755);
  fs.writeFileSync(path.join(appPath, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>CFBundleName</key><string>${xml(appName)}</string>\n<key>CFBundleDisplayName</key><string>${xml(appName)}</string>\n<key>CFBundleExecutable</key><string>${xml(executable)}</string>\n<key>CFBundleIdentifier</key><string>org.patchlang.${bundlePart(appName)}</string>\n<key>CFBundlePackageType</key><string>APPL</string>\n<key>CFBundleShortVersionString</key><string>0.2</string>\n<key>CFBundleVersion</key><string>1</string>\n</dict></plist>\n`, 'utf8');
}

function option(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; }
function safeName(value) { return String(value || 'PatchApp').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'PatchApp'; }
function bundlePart(value) { return safeName(value).toLowerCase().replace(/_/g, '-'); }
function ensureExtension(value, ext) { return value.toLowerCase().endsWith(ext.toLowerCase()) ? value : `${value}${ext}`; }
function xml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[c]); }
function runOptional(command, commandArgs) { const result = spawnSync(command, commandArgs, { stdio: 'inherit' }); if (result.error && result.error.code !== 'ENOENT') fail(`${command} failed: ${result.error.message}`); if (!result.error && result.status !== 0) fail(`${command} exited with status ${result.status}`); }
function fail(message) { console.error(`Patch native packager: ${message}`); process.exit(2); }
