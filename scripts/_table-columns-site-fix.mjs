import fs from 'node:fs';

const file = 'scripts/build-site.js';
let source = fs.readFileSync(file, 'utf8');
const before = "'panel-scroll.js','panel-split.js','input-presentation.js','window-input-presentation.js','button-presentation.js'";
const after = "'panel-scroll.js','panel-split.js','input-presentation.js','window-input-presentation.js','table-column-presentation.js','button-presentation.js'";
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected one SITE_SRC_FILES insertion anchor, found ${count}`);
source = source.replace(before, after);
fs.writeFileSync(file, source);
console.log('Table column presentation added to public browser source closure.');
