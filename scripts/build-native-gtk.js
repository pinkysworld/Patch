#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR, flattenNativeGuiControls } from '../src/native-gui-ir.js';
import { emitGtkGuiCpp, PATCH_GTK_GUI_BACKEND_VERSION } from '../src/gtk-gui-v07.js';

const sourcePath = process.argv[2];
const appName = safeName(process.argv[3] ?? 'PatchNativeGtk');
const outDir = path.resolve(process.argv[4] ?? 'dist');
const emitOnly = process.argv.includes('--emit-only');
const smoke = process.argv.includes('--smoke');

if (!sourcePath) {
  console.error('Use: node scripts/build-native-gtk.js program.patch AppName dist [--emit-only] [--smoke]');
  process.exit(2);
}

const absoluteSource = path.resolve(sourcePath);
const source = fs.readFileSync(absoluteSource, 'utf8');
const compiled = compile(source, { name: appName, kind: 'window', entry: path.basename(sourcePath) });
const gui = buildNativeGuiIR(compiled);
const cpp = emitGtkGuiCpp(gui);

fs.mkdirSync(outDir, { recursive: true });
const sourceOut = path.join(outDir, `${appName}.gtk.cpp`);
const executablePath = path.join(outDir, appName);
const metadataPath = path.join(outDir, `${appName}.gtk-build.json`);
fs.writeFileSync(sourceOut, cpp);
fs.writeFileSync(metadataPath, JSON.stringify({
  format: 'patch-native-gtk-build',
  version: '0.1',
  backendVersion: PATCH_GTK_GUI_BACKEND_VERSION,
  appName,
  nativeGuiIrVersion: gui.version,
  changeIrVersion: compiled.ir?.version ?? null,
  forms: gui.forms.length,
  controls: flattenNativeGuiControls(gui).length,
  events: gui.events.length,
  sourceSha256: createHash('sha256').update(source, 'utf8').digest('hex'),
  shell: 'native-gtk3',
  toolkit: 'GTK3',
  electron: false
}, null, 2));

if (emitOnly) {
  console.log(`Emitted native GTK C++ source: ${sourceOut}`);
  process.exit(0);
}
if (process.platform !== 'linux') {
  console.error('Direct GTK linking currently runs on Linux. Use --emit-only to inspect generated C++ elsewhere.');
  process.exit(3);
}

const cflags = pkgConfig(['--cflags', 'gtk+-3.0']);
const libs = pkgConfig(['--libs', 'gtk+-3.0']);
const compiler = findCompiler();
const build = spawnSync(compiler, ['-std=c++17', '-O2', '-s', ...cflags, sourceOut, '-o', executablePath, ...libs], { stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) throw new Error(`GTK native build exited with status ${build.status}.`);
if (!fs.existsSync(executablePath)) throw new Error('C++ compiler completed without producing the native GTK executable.');
fs.chmodSync(executablePath, 0o755);

console.log(`Built native Patch GTK GUI: ${executablePath}`);
console.log(`Native GUI IR ${gui.version}, Change IR ${compiled.ir?.version ?? '?'}, source sha256 ${createHash('sha256').update(source, 'utf8').digest('hex')}`);

if (smoke) {
  const useXvfb = !process.env.DISPLAY && commandExists('xvfb-run');
  const command = useXvfb ? 'xvfb-run' : executablePath;
  const args = useXvfb ? ['-a', executablePath, '--patch-smoke'] : ['--patch-smoke'];
  const run = spawnSync(command, args, { stdio: 'inherit', timeout: 30000, env: process.env });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`Native Patch GTK GUI smoke exited with status ${run.status}.`);
  console.log('Native Patch GTK GUI smoke passed.');
}

function pkgConfig(args) {
  const result = spawnSync('pkg-config', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pkg-config ${args.join(' ')} failed. Install GTK3 development files (for example libgtk-3-dev).`);
  return result.stdout.trim().split(/\s+/).filter(Boolean);
}
function findCompiler() {
  for (const command of ['g++', 'clang++']) if (commandExists(command)) return command;
  throw new Error('A C++17 compiler (g++ or clang++) is required for native GTK builds.');
}
function commandExists(command) {
  const result = spawnSync('sh', ['-c', `command -v ${shellQuote(command)} >/dev/null 2>&1`]);
  return result.status === 0;
}
function shellQuote(value) { return `'${String(value).replace(/'/g, `'"'"'`)}'`; }
function safeName(name) {
  const cleaned = String(name).trim().replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 64);
  return cleaned || 'PatchNativeGtk';
}
