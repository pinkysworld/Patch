#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { sealNativeGuiRuntime } from '../src/sealed-native-gui.js';

const sourcePath = process.argv[2];
const runtimePath = process.argv[3];
const outputPath = process.argv[4];
const appName = process.argv[5] ?? path.basename(outputPath ?? 'PatchApp.exe', '.exe');
const payloadVersion = Number(process.env.PATCH_SEALED_GUI_VERSION ?? 7);

if (!sourcePath || !runtimePath || !outputPath) {
  console.error('Use: node scripts/seal-native-win32.js program.patch runtime.exe output.exe [AppName]');
  process.exit(2);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = compile(source, { name: appName, kind: 'window', entry: path.basename(sourcePath) });
const gui = buildNativeGuiIR(compiled);
const runtime = new Uint8Array(fs.readFileSync(runtimePath));
const sealed = sealNativeGuiRuntime(runtime, gui, { version: payloadVersion });
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, sealed);
console.log(`Sealed native Patch Win32 GUI: ${outputPath}`);
console.log(`Runtime bytes: ${runtime.length}; sealed bytes: ${sealed.length}; Native GUI IR ${gui.version}; payload v${payloadVersion}`);
