import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public Studio and offline PWA package Window icon modules', () => {
  const parser = fs.readFileSync('src/parser.js', 'utf8');
  const designer = fs.readFileSync('src/designer.js', 'utf8');
  const webapp = fs.readFileSync('src/webapp.js', 'utf8');
  const forms = fs.readFileSync('web/forms-designer.js', 'utf8');
  const playground = fs.readFileSync('web/playground.js', 'utf8');
  const buildSite = fs.readFileSync('scripts/build-site.js', 'utf8');
  const worker = fs.readFileSync('web/sw.js', 'utf8');
  const docs = fs.readFileSync('web/docs.html', 'utf8');
  const policy = fs.readFileSync('src/window-icon.js', 'utf8');
  assert.match(parser, /from '\.\/window-icon\.js'/);
  assert.match(designer, /from '\.\/window-icon\.js'/);
  assert.match(webapp, /windowIconStage/);
  assert.match(forms, /patchFormIcon/);
  assert.match(playground, /patch-window-icon/);
  assert.match(buildSite, /'window-icon\.js'/);
  assert.match(worker, /'\.\.\/src\/window-icon\.js'/);
  assert.match(docs, /docs\/WINDOW_ICONS\.md/);
  assert.match(docs, /window-icon\/1\.0/);
  assert.match(policy, /PATCH_WINDOW_ICON_POLICY_ID = 'window-icon\/1\.0'/);
  assert.match(policy, /This module is not an IR bump/);
});
