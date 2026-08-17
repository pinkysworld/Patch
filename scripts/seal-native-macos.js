#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIR } from '../src/native-gui-ir.js';
import { buildNativeGuiIRV08 } from '../src/native-gui-ir-v08.js';
import { buildNativeGuiIRV11 } from '../src/native-gui-ir-v11.js';
import { sealNativeGuiRuntime } from '../src/sealed-native-gui.js';
import { sealNativeGuiRuntimeV11 } from '../src/sealed-native-gui-v11.js';

const sourcePath = process.argv[2];
const runtimePath = process.argv[3];
const outputPath = process.argv[4];
const appName = process.argv[5] ?? path.basename(outputPath ?? 'PatchApp');
const payloadVersion = Number(process.env.PATCH_SEALED_GUI_VERSION ?? 7);

if (!sourcePath || !runtimePath || !outputPath) {
  console.error('Use: node scripts/seal-native-macos.js program.patch runtime-macho output [AppName]');
  process.exit(2);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = compile(source, { name: appName, kind: 'window', entry: path.basename(sourcePath) });
const gui = payloadVersion >= 10
  ? buildNativeGuiIRV11(compiled)
  : payloadVersion >= 9 ? buildNativeGuiIRV08(compiled) : buildNativeGuiIR(compiled);
const runtime = new Uint8Array(fs.readFileSync(runtimePath));
const sealed = payloadVersion >= 11
  ? sealNativeGuiRuntimeV11(runtime, gui, { platform: 'macos' })
  : sealNativeGuiRuntime(runtime, gui, { platform: 'macos', version: payloadVersion });
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, sealed, { mode: 0o755 });
fs.chmodSync(outputPath, 0o755);
console.log(`Sealed native Patch AppKit GUI: ${outputPath}`);
console.log(`Runtime bytes: ${runtime.length}; sealed bytes: ${sealed.length}; Native GUI IR ${gui.version}; payload v${payloadVersion}`);
