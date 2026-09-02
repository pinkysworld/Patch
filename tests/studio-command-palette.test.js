import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildStudioQuickOpenItems, rankStudioQuickOpenItems } from '../web/studio-quick-open.js';

const html = fs.readFileSync('web/index.html', 'utf8');
const palette = fs.readFileSync('web/studio-command-palette.js', 'utf8');
const quickOpen = fs.readFileSync('web/studio-quick-open.js', 'utf8');
const paletteCss = fs.readFileSync('web/studio-command-palette.css', 'utf8');
const refreshCss = fs.readFileSync('web/site-refresh.css', 'utf8');
const pagesCss = fs.readFileSync('web/site-pages.css', 'utf8');
const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
const sw = fs.readFileSync('web/sw.js', 'utf8');

test('Studio command palette is syntax-valid, discoverable and keyboard-first', () => {
  execFileSync(process.execPath, ['--check', 'web/studio-command-palette.js'], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', 'web/studio-quick-open.js'], { stdio: 'pipe' });
  assert.match(html, /id="openCommandPalette"/);
  assert.match(html, /id="statusCommands"/);
  assert.match(html, /id="commandPalette"/);
  assert.match(html, /id="commandPaletteInput"/);
  assert.match(html, /\.\/studio-command-palette\.css/);
  assert.match(html, /\.\/studio-command-palette\.js/);
  assert.doesNotMatch(html, /document\.querySelector\('#statusCommands'\).*addEventListener/);
  assert.match(palette, /statusTrigger\?\.addEventListener\('click', openPalette\)/);
  assert.match(palette, /event\.key\.toLowerCase\(\) !== 'k'/);
  assert.match(palette, /ArrowDown/);
  assert.match(palette, /ArrowUp/);
  assert.match(palette, /event\.key === 'Enter'/);
  assert.match(palette, /event\.key === 'Escape'/);
});

test('command palette restores focus and exposes the active listbox option', () => {
  assert.match(palette, /let returnFocus = null/);
  assert.match(palette, /input\.setAttribute\('aria-controls', list\.id\)/);
  assert.match(palette, /input\.setAttribute\('aria-autocomplete', 'list'\)/);
  assert.match(palette, /dialog\.addEventListener\('cancel', event =>/);
  assert.match(palette, /restorePaletteFocus\(\)/);
  assert.match(palette, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(palette, /button\.id = `commandPaletteOption-\$\{index\}`/);
  assert.match(palette, /input\.setAttribute\('aria-activedescendant', activeOptionId\)/);
  assert.match(palette, /input\.removeAttribute\('aria-activedescendant'\)/);
});

test('command palette delegates to existing Studio actions without hidden persistent state', () => {
  for (const marker of [
    "'Run project'", "document.querySelector('#run')?.click()",
    "'Build selected target'", "document.querySelector('#build')?.click()",
    "'Focus source editor'", "focus('#code')",
    "'Open Designer'", "click('#tabDesigner')",
    "'Open Recovery'", "click('#recoverProject')",
    "navigate('./docs.html')", "navigate('./downloads.html')", "navigate('./help.html')"
  ]) assert.ok(palette.includes(marker), marker);
  assert.doesNotMatch(palette, /command\('paper'|navigate\('\.\/paper\.html'\)|Open Paper|working research manuscript/);
  assert.doesNotMatch(palette, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(quickOpen, /localStorage|sessionStorage|indexedDB/);
});

test('command palette v2 derives file and symbol results from the existing project and outline models', () => {
  assert.match(palette, /buildStudioQuickOpenItems/);
  assert.match(palette, /rankStudioQuickOpenItems/);
  assert.match(palette, /getStudioProjectFiles/);
  assert.match(palette, /activateStudioProjectFile/);
  assert.match(palette, /lineSelectionRange/);
  assert.match(palette, /patch:studio-project-files-changed/);
  assert.match(palette, /patch:studio-active-file-changed/);
  assert.match(palette, /patch:studio-quick-open/);
  assert.match(quickOpen, /buildOutlineModel\(parse\(content\)\)/);
  assert.match(quickOpen, /type: 'file'/);
  assert.match(quickOpen, /type: 'symbol'/);
  assert.match(quickOpen, /fuzzyQuickOpenScore/);
  assert.match(palette, /field: 'Field'/);
  assert.match(palette, /param: 'Param'/);
});

test('quick-open exposes Thing fields from the Project Tree model and jumps to the field line', () => {
  const items = buildStudioQuickOpenItems([{
    path: 'main.patch',
    content: `create thing player:
  name = "Sam"
  score = 0
`
  }]);
  const field = items.find(item => item.label === 'player.score');
  assert.ok(field, 'Thing field player.score should be a quick-open symbol');
  assert.equal(field.type, 'symbol');
  assert.equal(field.symbolKind, 'field');
  assert.equal(field.line, 3);
  assert.equal(field.file, 'main.patch');
  const ranked = rankStudioQuickOpenItems(items, 'player.score');
  assert.equal(ranked[0]?.label, 'player.score');
});

test('quick-open exposes recipe parameters from the Project Tree model and jumps to the recipe line', () => {
  const items = buildStudioQuickOpenItems([{
    path: 'logic/reward.patch',
    content: `create number score = 0
make reward(bonus number 0..5):
  change score:
    add bonus
`
  }]);
  const param = items.find(item => item.label === 'reward.bonus');
  assert.ok(param, 'Recipe parameter reward.bonus should be a quick-open symbol');
  assert.equal(param.type, 'symbol');
  assert.equal(param.symbolKind, 'param');
  assert.equal(param.line, 2);
  assert.equal(param.file, 'logic/reward.patch');
  const ranked = rankStudioQuickOpenItems(items, 'reward.bonus');
  assert.equal(ranked[0]?.label, 'reward.bonus');
});

test('command palette and quick-open model are packaged for offline Studio use', () => {
  assert.match(sw, /'\.\/studio-command-palette\.css'/);
  assert.match(sw, /'\.\/studio-command-palette\.js'/);
  assert.match(sw, /'\.\/studio-quick-open\.js'/);
  assert.doesNotMatch(sw, /'\.\.\/src\/studio-quick-open\.js'/);
  assert.doesNotMatch(sw, /\.\/paper\.html/);
  assert.match(buildSite, /'studio-quick-open\.js'/);
  assert.match(paletteCss, /\.command-palette::backdrop/);
  assert.match(paletteCss, /\.command-palette-kind/);
  assert.match(paletteCss, /@media \(max-width: 560px\)/);
  assert.match(paletteCss, /height: min\(88dvh, 720px\)/);
  assert.match(paletteCss, /margin: auto 0 0/);
  assert.match(paletteCss, /safe-area-inset-bottom/);
  assert.match(paletteCss, /overscroll-behavior: contain/);
  assert.match(paletteCss, /@media \(forced-colors: active\)/);
});

test('documentation layout uses balanced responsive grids instead of a squeezed four-plus-one contract row', () => {
  assert.match(refreshCss, /\.docs-contract-grid[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(refreshCss, /@media \(max-width: 1180px\)[\s\S]*\.docs-contract-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(refreshCss, /@media \(max-width: 620px\)[\s\S]*\.docs-contract-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(pagesCss, /grid-template-columns: minmax\(0, 1fr\) minmax\(320px, 400px\)/);
  assert.match(pagesCss, /\.doc-links[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});
