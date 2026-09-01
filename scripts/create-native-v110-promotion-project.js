#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildStudioProjectBundle, serializeStudioProjectBundle } from '../src/studio-project.js';

const args = process.argv.slice(2);
const out = path.resolve(option('--out') ?? 'dist-smoke/WindowIconsPromotion.patchproject');
const buildTarget = option('--target') ?? 'native-linux';
const source = fs.readFileSync(new URL('../examples/window-icons-native.patch', import.meta.url), 'utf8');

const APP_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACYUlEQVR42u3UMQEAAAQAQdFEE00zCmjghivww0dWD/BTiAAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABiAAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABiAAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABCAEGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAGAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQCXBYuiJXIdd4yTAAAAAElFTkSuQmCC';
const SMALL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';

const resources = [
  pngResource('app.icon', 'resources/app.png', APP_PNG_BASE64),
  pngResource('about.icon', 'resources/about.png', SMALL_PNG_BASE64),
  pngResource('icons.open', 'resources/open.png', SMALL_PNG_BASE64)
];

const bundle = buildStudioProjectBundle({
  name: 'WindowIconsPromotion',
  kind: 'window',
  entry: 'main.patch',
  files: [{ path: 'main.patch', content: source }],
  resources,
  buildTarget,
  nativeBuildMode: 'prebuilt'
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, serializeStudioProjectBundle(bundle), 'utf8');
console.log(`Wrote ${out}`);

function pngResource(id, resourcePath, data) {
  const bytes = Buffer.from(data, 'base64');
  return Object.freeze({
    id,
    path: resourcePath,
    mediaType: 'image/png',
    size: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    data
  });
}

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
