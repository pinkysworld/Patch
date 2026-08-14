#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR, flattenNativeGuiControls } from '../src/native-gui-ir.js';
import { buildNativeGuiIRV08, flattenNativeGuiControlsV08 } from '../src/native-gui-ir-v08.js';
import { emitAppKitGuiObjCpp, PATCH_APPKIT_GUI_BACKEND_VERSION } from '../src/appkit-gui-v08.js';
import { emitAppKitGuiObjCppV09, PATCH_APPKIT_GUI_BACKEND_V09_VERSION } from '../src/appkit-gui-v09.js';

const sourcePath = process.argv[2];
const appName = safeName(process.argv[3] ?? 'PatchNativeMac');
const outDir = path.resolve(process.argv[4] ?? 'dist');
const emitOnly = process.argv.includes('--emit-only');
const smoke = process.argv.includes('--smoke');
const tableV09 = process.argv.includes('--table-v09');

if (!sourcePath) {
  console.error('Use: node scripts/build-native-appkit.js program.patch AppName dist [--emit-only] [--smoke] [--table-v09]');
  process.exit(2);
}

const absoluteSource = path.resolve(sourcePath);
const source = fs.readFileSync(absoluteSource, 'utf8');
const compiled = compile(source, { name: appName, kind: 'window', entry: path.basename(sourcePath) });
const gui = tableV09 ? buildNativeGuiIRV08(compiled) : buildNativeGuiIR(compiled);
const objCpp = tableV09 ? emitAppKitGuiObjCppV09(gui) : emitAppKitGuiObjCpp(gui);
const backendVersion = tableV09 ? PATCH_APPKIT_GUI_BACKEND_V09_VERSION : PATCH_APPKIT_GUI_BACKEND_VERSION;
const controlCount = tableV09 ? flattenNativeGuiControlsV08(gui).length : flattenNativeGuiControls(gui).length;

fs.mkdirSync(outDir, { recursive: true });
const sourceOut = path.join(outDir, `${appName}.appkit.mm`);
const metadataPath = path.join(outDir, `${appName}.appkit-build.json`);
const appPath = path.join(outDir, `${appName}.app`);
const contentsPath = path.join(appPath, 'Contents');
const macOSPath = path.join(contentsPath, 'MacOS');
const executablePath = path.join(macOSPath, appName);
const plistPath = path.join(contentsPath, 'Info.plist');

fs.writeFileSync(sourceOut, objCpp);
fs.writeFileSync(metadataPath, JSON.stringify({
  format: 'patch-native-appkit-build',
  version: '0.1',
  backendVersion,
  appName,
  nativeGuiIrVersion: gui.version,
  changeIrVersion: compiled.ir?.version ?? null,
  forms: gui.forms.length,
  controls: controlCount,
  events: gui.events.length,
  sourceSha256: createHash('sha256').update(source, 'utf8').digest('hex'),
  shell: 'native-appkit',
  electron: false,
  framework: 'AppKit',
  tableV09
}, null, 2));

if (emitOnly) {
  console.log(`Emitted native AppKit Objective-C++ source: ${sourceOut}`);
  process.exit(0);
}
if (process.platform !== 'darwin') {
  console.error('Direct AppKit linking currently runs on macOS. Use --emit-only to inspect generated Objective-C++ elsewhere.');
  process.exit(3);
}

fs.rmSync(appPath, { recursive: true, force: true });
fs.mkdirSync(macOSPath, { recursive: true });
fs.writeFileSync(plistPath, buildInfoPlist(appName));

const clang = spawnSync('xcrun', [
  '--sdk', 'macosx', 'clang++',
  '-std=c++17', '-O2', '-fobjc-arc',
  '-framework', 'Cocoa',
  '-Wl,-dead_strip',
  sourceOut,
  '-o', executablePath
], { stdio: 'inherit' });

if (clang.error) throw clang.error;
if (clang.status !== 0) throw new Error(`AppKit native build exited with status ${clang.status}.`);
if (!fs.existsSync(executablePath)) throw new Error('clang++ completed without producing the native AppKit executable.');
fs.chmodSync(executablePath, 0o755);

console.log(`Built native Patch AppKit GUI: ${appPath}`);
console.log(`Native GUI IR ${gui.version}, backend ${backendVersion}, Change IR ${compiled.ir?.version ?? '?'}, source sha256 ${createHash('sha256').update(source, 'utf8').digest('hex')}`);

if (smoke) {
  const run = spawnSync(executablePath, ['--patch-smoke'], {
    stdio: 'inherit',
    timeout: 30000,
    env: { ...process.env, NSUnbufferedIO: 'YES' }
  });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`Native Patch AppKit GUI smoke exited with status ${run.status}.`);
  console.log('Native Patch AppKit GUI smoke passed.');
}

function buildInfoPlist(name) {
  const escaped = xmlEscape(name);
  const identifier = `org.patchlang.${name.toLowerCase().replace(/[^a-z0-9.-]/g, '-')}`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>CFBundleDevelopmentRegion</key><string>en</string>\n  <key>CFBundleExecutable</key><string>${escaped}</string>\n  <key>CFBundleIdentifier</key><string>${xmlEscape(identifier)}</string>\n  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>\n  <key>CFBundleName</key><string>${escaped}</string>\n  <key>CFBundlePackageType</key><string>APPL</string>\n  <key>CFBundleShortVersionString</key><string>0.1</string>\n  <key>CFBundleVersion</key><string>1</string>\n  <key>LSMinimumSystemVersion</key><string>11.0</string>\n  <key>NSHighResolutionCapable</key><true/>\n</dict>\n</plist>\n`;
}

function safeName(name) {
  const cleaned = String(name).trim().replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 64);
  return cleaned || 'PatchNativeMac';
}
function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
