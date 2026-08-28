import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PATCH_COMPONENT_MATRIX_SCHEMA,
  PATCH_COMPONENT_MATRIX_VERSION,
  formatPatchComponentCapabilityMatrixMarkdown,
  formatPatchComponentCapabilityMatrixText,
  patchComponentCapabilityMatrix
} from '../src/component-matrix.js';
import { PATCH_COMPONENT_REGISTRY_VERSION, PATCH_COMPONENTS } from '../src/component-registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('capability matrix is generated from the canonical registry rather than a second catalog', () => {
  const matrix = patchComponentCapabilityMatrix();
  assert.equal(matrix.schema, PATCH_COMPONENT_MATRIX_SCHEMA);
  assert.equal(matrix.version, PATCH_COMPONENT_MATRIX_VERSION);
  assert.equal(matrix.registryVersion, PATCH_COMPONENT_REGISTRY_VERSION);
  assert.equal(matrix.contract.id, 'native-gui-1.6/payload-16/runtime-1.7');
  assert.equal(matrix.contract.nativeGuiIR, '1.6');
  assert.equal(matrix.contract.payload, 16);
  assert.equal(matrix.contract.runtime, '1.7');
  assert.deepEqual(matrix.components.map(component => component.type), PATCH_COMPONENTS.map(component => component.type));
  const imagelist = matrix.components.find(component => component.type === 'imagelist');
  assert.equal(imagelist.visual, false);
  assert.equal(imagelist.targets.studio, 'authoring');
  assert.equal(imagelist.targets.web, 'supported');
  assert.equal(imagelist.targets.windows, 'unsupported');
  const shape = matrix.components.find(component => component.type === 'shape');
  assert.equal(shape.targets.web, 'supported');
  assert.equal(shape.targets.windows, 'supported');
  assert.equal(Object.isFrozen(matrix), true);
  assert.equal(Object.isFrozen(matrix.components), true);
});

test('checked-in capability matrix markdown matches registry generation', () => {
  const generated = formatPatchComponentCapabilityMatrixMarkdown();
  const checkedIn = fs.readFileSync(path.join(root, 'docs', 'COMPONENT_CAPABILITY_MATRIX.md'), 'utf8');
  assert.equal(checkedIn, generated);
  assert.match(generated, /Do not edit the table by hand/);
  assert.match(generated, /`imagelist`/);
  assert.match(generated, /`paintbox`/);
  assert.match(formatPatchComponentCapabilityMatrixText(), /Patch components {2}registry 0\.8/);
});

test('patch components CLI prints the registry matrix and JSON envelope', () => {
  const cli = path.join(root, 'src', 'cli-entry.js');
  const text = spawnSync(process.execPath, [cli, 'components'], { encoding: 'utf8' });
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /Patch components {2}registry 0\.8/);
  assert.match(text.stdout, /imagelist/);
  assert.match(text.stdout, /authoring/);

  const json = spawnSync(process.execPath, [cli, 'components', '--json'], { encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  const report = JSON.parse(json.stdout);
  assert.equal(report.schema, 'patch-components');
  assert.equal(report.registryVersion, '0.8');
  assert.equal(report.components.at(-1).type, 'imagelist');
});
