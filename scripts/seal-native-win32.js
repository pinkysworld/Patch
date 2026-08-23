#!/usr/bin/env node
/**
 * HISTORICAL sealer — payload v7 or v8 only.
 * Ready/offline Window packages use payload v12 or v13 via src/sealed-native-package.js.
 */
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
const appName = process.argv[5] ?? path.basename(outputPath ?? 'PatchApp.exe', '.exe');

if (!sourcePath || !runtimePath || !outputPath) {
  console.error('Use: node scripts/seal-native-win32.js program.patch runtime.exe output.exe [AppName]');
  process.exit(2);
}

const rawPayloadVersion = process.env.PATCH_SEALED_GUI_VERSION;
const payloadVersion = Number(rawPayloadVersion);
if (rawPayloadVersion == null || rawPayloadVersion === '' || (payloadVersion !== 7 && payloadVersion !== 8)) {
  console.error('scripts/seal-native-win32.js is the historical payload-v7/v8 sealer, not the Ready runtime.');
  console.error('Set PATCH_SEALED_GUI_VERSION=7 or 8. Ready/offline Window packages use payload v12 or v13 via src/sealed-native-package.js.');
  process.exit(2);
}

const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = compile(source, { name: appName, kind: 'window', entry: path.basename(sourcePath) });
const gui = payloadVersion >= 10
  ? buildNativeGuiIRV11(compiled)
  : payloadVersion >= 9 ? buildNativeGuiIRV08(compiled) : buildNativeGuiIR(compiled);
const runtime = new Uint8Array(fs.readFileSync(runtimePath));
const sealed = payloadVersion >= 11
  ? sealNativeGuiRuntimeV11(runtime, gui, { platform: 'windows' })
  : sealNativeGuiRuntime(runtime, gui, { version: payloadVersion });
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, sealed);
console.log(`Sealed native Patch Win32 GUI: ${outputPath}`);
console.log(`Runtime bytes: ${runtime.length}; sealed bytes: ${sealed.length}; Native GUI IR ${gui.version}; payload v${payloadVersion}`);
