import fs from 'node:fs';

const path = 'scripts/_scrollbar-stage1.mjs';
let source = fs.readFileSync(path, 'utf8');

const oldProgress = "control.mode === 'progress'), true);";
const newProgress = "control.mode === 'progress' && control.id === 'completion'), true);";
if (!source.includes(oldProgress)) throw new Error('ScrollBar Showcase compiled-manifest harness anchor is missing.');
source = source.replaceAll(oldProgress, newProgress);

const oldWebHtml = "assert.match(built.html, /patch-progressbar/);";
const newWebHtml = "assert.match(built.html, /data-patch-window-progressbar/);";
if (!source.includes(oldWebHtml)) throw new Error('ScrollBar Showcase web-html harness anchor is missing.');
source = source.replaceAll(oldWebHtml, newWebHtml);

const oldLayout = 'slider 0..100 as scroll_position step 5 at 18, 314 size 312, 28';
const newLayout = 'slider 0..100 as scroll_position step 5 at 18, 368 size 312, 28';
if (!source.includes(oldLayout)) throw new Error('ScrollBar Showcase layout harness anchor is missing.');
source = source.replaceAll(oldLayout, newLayout);

fs.writeFileSync(path, source);
console.log('ScrollBar helper anchors and Showcase layout updated.');
