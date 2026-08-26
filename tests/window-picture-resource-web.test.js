import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStandaloneWebApp, pictureResourceDataUri } from '../src/webapp.js';

const RESOURCE = Object.freeze({
  id: 'app.logo',
  path: 'resources/logo.png',
  mediaType: 'image/png',
  size: 1,
  sha256: '0'.repeat(64),
  data: 'AA=='
});

const SOURCE = `window "Photos" as main size 420, 260:\n  picture as logo from "patch-resource:app.logo" at 24, 24 size 180, 120\n\nwhen logo clicked:\n  show "logo clicked"\n`;

test('Standalone Window Web embeds v4 Picture resources and renders a real image control', () => {
  const built = buildStandaloneWebApp(SOURCE, {
    name: 'Photos',
    kind: 'window',
    resources: [RESOURCE]
  });
  assert.equal(built.metadata.pictureStage, 1);
  assert.equal(built.metadata.pictureResourceModel, 'embedded-project-resources');
  assert.equal(built.metadata.pictureResourceCount, 1);
  assert.match(built.html, /const PATCH_IMAGE_RESOURCES=Object\.freeze\(/);
  assert.match(built.html, /"app\.logo":\{"mediaType":"image\/png","data":"AA=="\}/);
  assert.match(built.html, /source:node\.control==='picture'/);
  assert.match(built.html, /document\.createElement\('img'\)/);
  assert.match(built.html, /className='patch-picture'/);
  assert.match(built.html, /patchPictureSource\(control\.source\)/);
  assert.match(built.html, /handler\.event==='clicked'/);
  assert.match(built.html, /object-fit:contain/);
});

test('Standalone Window Web fails closed when static Picture source names a missing project resource', () => {
  assert.throws(
    () => buildStandaloneWebApp(SOURCE, { name: 'Photos', kind: 'window', resources: [] }),
    /Picture 'logo' references missing project resource 'app\.logo'/
  );
});

test('ordinary quoted Picture sources remain usable without project resources', () => {
  const source = `window "Remote":\n  picture as photo from "https://example.test/photo.png"\n`;
  const built = buildStandaloneWebApp(source, { name: 'Remote', kind: 'window' });
  assert.equal(built.metadata.pictureStage, 1);
  assert.equal(built.metadata.pictureResourceModel, 'quoted-source');
  assert.equal(built.metadata.pictureResourceCount, 0);
  assert.match(built.html, /https:\/\/example\.test\/photo\.png/);
});

test('Picture resource resolver creates an image data URI and rejects missing logical ids', () => {
  assert.equal(pictureResourceDataUri('patch-resource:app.logo', [RESOURCE]), 'data:image/png;base64,AA==');
  assert.equal(pictureResourceDataUri('https://example.test/x.png', [RESOURCE]), 'https://example.test/x.png');
  assert.throws(() => pictureResourceDataUri('patch-resource:missing', [RESOURCE]), /not present in this project/);
});
