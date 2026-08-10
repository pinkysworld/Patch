#!/usr/bin/env node
import path from 'node:path';
import { buildNativeGuiForHost, nativeGuiHostPlan } from '../src/native-gui-host.js';

const sourcePath = process.argv[2];
const name = process.argv[3] ?? (sourcePath ? path.basename(sourcePath, path.extname(sourcePath)) : 'PatchApp');
const outDir = process.argv[4] ?? 'dist-native';
const emitOnly = process.argv.includes('--emit-only');
const smoke = process.argv.includes('--smoke');

if (!sourcePath) {
  console.error('Use: patch-app program.patch [AppName] [output-directory]');
  process.exit(2);
}

try {
  const plan = nativeGuiHostPlan();
  console.log(`Patch native GUI: ${plan.platform} -> ${plan.outputKind} (${plan.backend})`);
  const built = buildNativeGuiForHost(sourcePath, { name, outDir, emitOnly, smoke });
  console.log(`Native Patch GUI build complete: ${built.outputKind}`);
  console.log(`  output directory: ${built.outDir}`);
  console.log('  source syntax: unchanged Patch Forms');
  console.log('  Electron/Chromium: not used by this native backend');
} catch (error) {
  console.error(`Patch native GUI build stopped: ${error.message}`);
  process.exit(2);
}
