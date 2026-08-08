#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceWeb = path.join(root, 'web');
const sourceSrc = path.join(root, 'src');
const out = path.join(root, '_site');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const name of ['index.html', 'style.css', 'manifest.webmanifest', 'icon.svg']) {
  fs.copyFileSync(path.join(sourceWeb, name), path.join(out, name));
}

for (const name of ['playground.js', 'native-build.js', 'sw.js']) {
  const content = fs.readFileSync(path.join(sourceWeb, name), 'utf8')
    .replaceAll("'../src/", "'./src/")
    .replaceAll('"../src/', '"./src/');
  fs.writeFileSync(path.join(out, name), content);
}

fs.cpSync(sourceSrc, path.join(out, 'src'), { recursive: true });

console.log('built _site/ for Patch Studio');
