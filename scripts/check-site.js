#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  '_site/index.html',
  '_site/style.css',
  '_site/playground.js',
  '_site/sw.js',
  '_site/manifest.webmanifest',
  '_site/src/interpreter.js',
  '_site/src/parser.js',
  '_site/src/expression.js',
  '_site/src/change.js',
  '_site/src/compiler.js',
  '_site/src/bundle.js'
];

for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`Missing generated site file: ${rel}`);
}

const html = fs.readFileSync(path.join(root, '_site/index.html'), 'utf8');
for (const needle of ['./style.css', './manifest.webmanifest', './playground.js']) {
  if (!html.includes(needle)) throw new Error(`Generated index is missing ${needle}`);
}
for (const id of ['code', 'run', 'build', 'output', 'ir', 'app', 'projectName', 'projectKind']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Patch Studio is missing required element #${id}`);
}

const playground = fs.readFileSync(path.join(root, '_site/playground.js'), 'utf8');
if (playground.includes("'../src/")) throw new Error('Generated playground still points outside the deployed site.');
for (const mod of ['./src/interpreter.js', './src/compiler.js', './src/bundle.js']) {
  if (!playground.includes(mod)) throw new Error(`Generated playground does not import ${mod}`);
}

const sw = fs.readFileSync(path.join(root, '_site/sw.js'), 'utf8');
if (sw.includes("'../src/")) throw new Error('Generated service worker still points outside the deployed site.');

const manifest = JSON.parse(fs.readFileSync(path.join(root, '_site/manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Patch Studio') throw new Error('PWA manifest name mismatch.');
if (manifest.display !== 'standalone') throw new Error('Patch Studio must remain installable as a standalone PWA.');

console.log('ok generated Patch Studio site');
