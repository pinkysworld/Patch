import fs from 'node:fs';

const path = 'scripts/build-site.js';
const source = fs.readFileSync(path, 'utf8');
const before = "'form-layout.js','window-layout-policy.js','panel-scroll.js','panel-split.js','input-presentation.js','window-input-presentation.js','studio-project.js'";
const after = "'form-layout.js','window-layout-policy.js','panel-scroll.js','panel-split.js','input-presentation.js','window-input-presentation.js','button-presentation.js','studio-project.js'";
if (!source.includes(before)) throw new Error('Missing build-site source-module anchor for LinkLabel.');
fs.writeFileSync(path, source.replace(before, after));
console.log('LinkLabel browser source module added to site packaging.');
