import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('Shape parser dependencies are content-addressed into public Studio and offline cache', () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { stdio: 'pipe' });

  assert.equal(fs.existsSync('_site/paper.html'), false, 'Shape packaging must preserve the repository-only paper boundary');
  assert.ok(fs.existsSync('_site/src/shape-source.js'), 'shape-source.js');
  assert.ok(fs.existsSync('_site/src/shape-control.js'), 'shape-control.js');

  const html = fs.readFileSync('_site/index.html', 'utf8');
  const revision = /\.\/style\.css\?v=([a-f0-9]{16})/.exec(html)?.[1];
  assert.ok(revision, 'generated Studio should expose its content revision');

  const parser = fs.readFileSync('_site/src/parser.js', 'utf8');
  const shapeSource = fs.readFileSync('_site/src/shape-source.js', 'utf8');
  const worker = fs.readFileSync('_site/sw.js', 'utf8');

  assert.ok(parser.includes(`from './shape-source.js?v=${revision}'`));
  assert.ok(shapeSource.includes(`from './shape-control.js?v=${revision}'`));
  assert.ok(worker.includes('../src/shape-source.js'));
  assert.ok(worker.includes('../src/shape-control.js'));
  assert.equal(worker.includes('./paper.html'), false);
});
