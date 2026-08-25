#!/usr/bin/env node
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const requireAll = (label, text, markers) => {
  for (const marker of markers) if (!text.includes(marker)) throw new Error(`${label} is missing beta36 marker: ${marker}`);
};
const rejectAll = (label, text, markers) => {
  for (const marker of markers) if (text.includes(marker)) throw new Error(`${label} contains beta35/current-contract drift: ${marker}`);
};

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '0.2.0-beta.36') throw new Error(`beta36 site gate got ${pkg.version}`);

const index = read('_site/index.html');
const downloads = read('_site/downloads.html');
const multi = read('_site/designer-multiselect.js');
const workspace = read('_site/designer-workspace.js');
const events = read('_site/designer-event-inspector.js');
const toolbox = read('_site/designer-toolbox.js');
const current = read('_site/src/native-current-contract.js');
const workshop = read('_site/beta35-studio.js');
const sw = read('_site/sw.js');

requireAll('beta36 Studio', index, [
  'data-patch-version="0.2.0-beta.36"','0.2 beta.36+','Native GUI IR 1.4','payload v14','runtime v1.5',
  'value="workshopDesk">Workshop desk</option>','viewBox="0 0 22 22"','shape-rendering="crispEdges"'
]);
rejectAll('beta36 Studio', index, ['data-patch-version="0.2.0-beta.35"','Ready IR 1.3 / v1.4']);

requireAll('beta36 Workshop Desk loader', workshop, [
  'const WORKSHOP_DESK_SAMPLE = `','window "Workshop Desk" as main','window "Workshop settings" as settings',
  'window "Job details" as details',"sample.value === 'workshopDesk'","loadButton.textContent = 'Load example'",
  'queueMicrotask(loadSelectedSample)'
]);
rejectAll('beta36 Workshop Desk loader', workshop, ['window "Harbor Desk"']);

requireAll('beta36 RAD arrange surface', multi, [
  'patchAlignRight','patchAlignBottom','patchSameWidth','patchSameHeight','patchDistributeHorizontal','patchDistributeVertical'
]);
requireAll('beta36 RAD Object Inspector', workspace, ['Object Inspector','designer-event-inspector.js','designer-focus-order.js','designer-toolbox.js']);
requireAll('beta36 RAD event inspector', events, ['Properties','Events','Create handler','Open handler']);
requireAll('beta36 RAD component palette', toolbox, ['Component Palette','designerComponentSearch','Ctrl/Cmd+Shift+A']);

requireAll('beta36 current native facade', current, [
  "native-gui-1.4/payload-14/runtime-1.5","PATCH_CURRENT_NATIVE_RUNTIME_VERSION = '1.5'",
  'native-win32-runtime-v1.5','native-macos-runtime-v1.5','native-linux-runtime-v1.5'
]);

requireAll('beta36 downloads', downloads, [
  'offline-compiler-v0.2','Native GUI IR <strong>1.4</strong>','payload <strong>v14</strong>','runtime <strong>v1.5</strong>'
]);
rejectAll('beta36 downloads', downloads, ['offline-compiler-v0.1','native-win32-runtime-v1.4']);
requireAll('beta36 worker', sw, ["const PATCH_RELEASE = '0.2.0-beta.36'"]);

console.log('beta.36 Studio surface gate passed.');
