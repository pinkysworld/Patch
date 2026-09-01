#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildStudioProjectBundle, serializeStudioProjectBundle } from '../src/studio-project.js';

const args = process.argv.slice(2);
const out = path.resolve(option('--out') ?? 'dist-smoke/WindowIconsPromotion.patchproject');
const buildTarget = option('--target') ?? 'native-linux';
const source = fs.readFileSync(new URL('../examples/window-icons-native.patch', import.meta.url), 'utf8');

const APP_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACYUlEQVR42u3UMQEAAAQAQdFEE00zCmjghivww0dWD/BTiAAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABiAAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABiAAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABCAEGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAYABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAGAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQCXBYuiJXIdd4yTAAAAAElFTkSuQmCC';
const SMALL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNkYGD4z0ABYKJE86gBowaMGjCYDAAATUABH+w/WFYAAAAASUVORK5CYII=';

const resources = [
  {
    id: 'app.icon',
    path: 'resources/app.png',
    mediaType: 'image/png',
    size: 666,
    sha256: '60c0cc51fa71bb5db318ec3b0952dd3f7c7930f86236db51ef795ae48665d22e',
    data: APP_PNG_BASE64
  },
  {
    id: 'about.icon',
    path: 'resources/about.png',
    mediaType: 'image/png',
    size: 86,
    sha256: '789cc3d7c8416b40a4f20155ece071c362f85d610e71b32b328bfc12b4cf2ead',
    data: SMALL_PNG_BASE64
  },
  {
    id: 'icons.open',
    path: 'resources/open.png',
    mediaType: 'image/png',
    size: 86,
    sha256: '789cc3d7c8416b40a4f20155ece071c362f85d610e71b32b328bfc12b4cf2ead',
    data: SMALL_PNG_BASE64
  }
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

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
