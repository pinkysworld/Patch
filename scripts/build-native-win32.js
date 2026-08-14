#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR, flattenNativeGuiControls } from '../src/native-gui-ir.js';
import { buildNativeGuiIRV08, flattenNativeGuiControlsV08 } from '../src/native-gui-ir-v08.js';
import { emitWin32GuiCpp, PATCH_WIN32_GUI_BACKEND_VERSION } from '../src/win32-gui-v08.js';
import { emitWin32GuiCppV09, PATCH_WIN32_GUI_BACKEND_V09_VERSION } from '../src/win32-gui-v09.js';

const sourcePath = process.argv[2];
const appName = safeName(process.argv[3] ?? 'PatchNativeWindow');
const outDir = path.resolve(process.argv[4] ?? 'dist');
const emitOnly = process.argv.includes('--emit-only');
const smoke = process.argv.includes('--smoke');
const tableV09 = process.argv.includes('--table-v09');

if (!sourcePath) {
  console.error('Use: node scripts/build-native-win32.js program.patch AppName dist [--emit-only] [--smoke] [--table-v09]');
  process.exit(2);
}

const absoluteSource = path.resolve(sourcePath);
const source = fs.readFileSync(absoluteSource, 'utf8');
const compiled = compile(source, { name: appName, kind: 'window', entry: path.basename(sourcePath) });
const gui = tableV09 ? buildNativeGuiIRV08(compiled) : buildNativeGuiIR(compiled);
const cpp = normalizeGeneratedCpp(tableV09 ? emitWin32GuiCppV09(gui) : emitWin32GuiCpp(gui));
const backendVersion = tableV09 ? PATCH_WIN32_GUI_BACKEND_V09_VERSION : PATCH_WIN32_GUI_BACKEND_VERSION;
const controlCount = tableV09 ? flattenNativeGuiControlsV08(gui).length : flattenNativeGuiControls(gui).length;
fs.mkdirSync(outDir, { recursive: true });
const cppPath = path.join(outDir, `${appName}.win32.cpp`);
const exePath = path.join(outDir, `${appName}.exe`);
const metadataPath = path.join(outDir, `${appName}.win32-build.json`);
fs.writeFileSync(cppPath, cpp);
fs.writeFileSync(metadataPath, JSON.stringify({
  format: 'patch-native-win32-build',
  version: '0.1',
  backendVersion,
  appName,
  nativeGuiIrVersion: gui.version,
  changeIrVersion: compiled.ir?.version ?? null,
  forms: gui.forms.length,
  controls: controlCount,
  events: gui.events.length,
  sourceSha256: createHash('sha256').update(source, 'utf8').digest('hex'),
  shell: 'native-win32',
  electron: false,
  crt: 'static',
  tableV09
}, null, 2));

if (emitOnly) {
  console.log(`Emitted native Win32 C++ source: ${cppPath}`);
  process.exit(0);
}
if (process.platform !== 'win32') {
  console.error('Direct Win32 linking currently runs on Windows. Use --emit-only to inspect generated C++ elsewhere.');
  process.exit(3);
}

const compiler = resolveMsvc();
const objectPath = path.join(outDir, `${appName}.obj`);
const clArgs = [
  '/nologo', '/EHsc', '/std:c++17', '/O2', '/MT', '/utf-8',
  `/Fo${objectPath}`, cppPath,
  'user32.lib', 'gdi32.lib', 'comctl32.lib', 'comdlg32.lib',
  '/link', '/SUBSYSTEM:WINDOWS', `/OUT:${exePath}`
];
const result = compiler.kind === 'direct'
  ? spawnSync(compiler.command, clArgs, { stdio: 'inherit', windowsHide: true })
  : runThroughVsDevCmd(compiler.vsDevCmd, clArgs);

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`MSVC native Win32 build exited with status ${result.status}.`);
if (!fs.existsSync(exePath)) throw new Error('MSVC completed without producing the native Win32 executable.');

console.log(`Built native Patch Win32 GUI: ${exePath}`);
console.log(`Native GUI IR ${gui.version}, backend ${backendVersion}, Change IR ${compiled.ir?.version ?? '?'}, source sha256 ${createHash('sha256').update(source, 'utf8').digest('hex')}`);

if (smoke) {
  const run = spawnSync(exePath, ['--patch-smoke'], { stdio: 'inherit', windowsHide: false, timeout: 30000 });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`Native Patch Win32 GUI smoke exited with status ${run.status}.`);
  console.log('Native Patch Win32 GUI smoke passed.');
}

function normalizeGeneratedCpp(text) {
  return String(text).replaceAll('\0', '\\0');
}

function runThroughVsDevCmd(vsDevCmd, args) {
  const scriptPath = path.join(outDir, `${appName}.msvc-build.cmd`);
  const script = [
    '@echo off',
    `call "${vsDevCmd.replace(/"/g, '""')}" -arch=x64 -host_arch=x64`,
    'if errorlevel 1 exit /b %errorlevel%',
    `cl.exe ${args.map(batchQuote).join(' ')}`,
    'exit /b %errorlevel%',
    ''
  ].join('\r\n');
  fs.writeFileSync(scriptPath, script, 'utf8');
  try {
    return spawnSync('cmd.exe', ['/d', '/c', scriptPath], { stdio: 'inherit', windowsHide: true });
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

function resolveMsvc() {
  const direct = spawnSync('where.exe', ['cl.exe'], { encoding: 'utf8', windowsHide: true });
  if (direct.status === 0 && direct.stdout?.trim()) return { kind: 'direct', command: 'cl.exe' };
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
  ];
  const vswhere = candidates.find(file => fs.existsSync(file));
  if (!vswhere) throw new Error('Microsoft C++ Build Tools were not found. Install Visual Studio Build Tools with Desktop development with C++.');
  const query = spawnSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8', windowsHide: true });
  if (query.status !== 0 || !query.stdout?.trim()) throw new Error('Visual Studio C++ Build Tools installation could not be located.');
  const installation = query.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  const vsDevCmd = path.join(installation, 'Common7', 'Tools', 'VsDevCmd.bat');
  if (!fs.existsSync(vsDevCmd)) throw new Error(`MSVC environment script was not found at ${vsDevCmd}.`);
  return { kind: 'vsdevcmd', vsDevCmd };
}

function safeName(name) {
  const cleaned = String(name).trim().replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 64);
  return cleaned || 'PatchNativeWindow';
}
function batchQuote(value) { return `"${String(value).replace(/"/g, '""')}"`; }
