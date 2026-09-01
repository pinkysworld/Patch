#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildStudioProjectBundle, serializeStudioProjectBundle } from '../src/studio-project.js';

const args = process.argv.slice(2);
const out = path.resolve(option('--out') ?? 'dist-smoke/WindowIconsPromotion.patchproject');
const buildTarget = option('--target') ?? 'native-linux';
const source = fs.readFileSync(new URL('../examples/window-icons-native.patch', import.meta.url), 'utf8');

const APP_PNG_BASE64 = createSolidPng(256, 256, [32, 144, 240, 255]).toString('base64');
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

function createSolidPng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const row = Buffer.alloc(1 + width * 4);
  row[0] = 0;
  for (let x = 0; x < width; x += 1) {
    row.set(rgba, 1 + x * 4);
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
