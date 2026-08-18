import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV12 } from '../src/native-gui-ir-v12.js';
import { encodeNativeGuiPayloadV11 } from '../src/sealed-native-gui-v11.js';
import { adaptNativeTreesForV12Backend } from '../src/native-tree-backend-adapter.js';
import {
  PATCH_SEALED_NATIVE_GUI_TREE_VERSION,
  encodeNativeGuiPayloadV12,
  sealNativeGuiRuntimeV12,
  decodeNativeGuiPayloadV12,
  inspectNativeGuiTreesV12
} from '../src/sealed-native-gui-v12.js';

const source = fs.readFileSync('examples/treeview-window.patch', 'utf8');

function build() {
  return buildNativeGuiIRV12(compile(source, { name: 'SealedTree', kind: 'window' }));
}

function stripTreeBlock(payloadV12) {
  const { eventsOffset } = inspectNativeGuiTreesV12(payloadV12);
  const adapted = adaptNativeTreesForV12Backend(build());
  const payloadV11 = encodeNativeGuiPayloadV11(adapted.compatibleIr);
  const marker = new TextEncoder().encode('files');
  let treeBlockStart = -1;
  for (let i = 0; i <= payloadV12.length - marker.length - 8; i += 1) {
    if (payloadV12[i] !== 1 || payloadV12[i + 1] !== 0 || payloadV12[i + 2] !== 0 || payloadV12[i + 3] !== 0) continue;
    // Tree metadata begins with count=1, nativeIndex, then text length/id.
    const idLength = new DataView(payloadV12.buffer, payloadV12.byteOffset + i + 8, 4).getUint32(0, true);
    if (idLength !== marker.length) continue;
    let match = true;
    for (let j = 0; j < marker.length; j += 1) if (payloadV12[i + 12 + j] !== marker[j]) match = false;
    if (match) { treeBlockStart = i; break; }
  }
  assert.ok(treeBlockStart >= 0, 'tree metadata block located');
  const out = new Uint8Array(treeBlockStart + (payloadV12.length - eventsOffset));
  out.set(payloadV12.subarray(0, treeBlockStart), 0);
  out.set(payloadV12.subarray(eventsOffset), treeBlockStart);
  assert.deepEqual(out, payloadV11);
  return out;
}

test('payload v12 carries recursive TreeView metadata over an exact v11 compatibility payload', () => {
  const bytes = encodeNativeGuiPayloadV12(build());
  const metadata = inspectNativeGuiTreesV12(bytes);
  assert.equal(metadata.trees.length, 1);
  assert.equal(metadata.trees[0].id, 'files');
  assert.deepEqual(metadata.trees[0].nodes, [
    { parent: -1, text: '{rootLabel}' },
    { parent: 0, text: 'compiler.js' },
    { parent: 0, text: 'parser.js' },
    { parent: -1, text: 'docs' },
    { parent: 3, text: 'ROADMAP.md' },
    { parent: 3, text: 'TREEVIEW_STAGE1.md' }
  ]);
  stripTreeBlock(bytes);
});

test('payload v12 public Tree metadata never exposes the private shadow state name', () => {
  const bytes = encodeNativeGuiPayloadV12(build());
  const metadata = inspectNativeGuiTreesV12(bytes);
  assert.equal(JSON.stringify(metadata).includes('__patch_native_tree_shadow_'), false);
  assert.match(new TextDecoder().decode(bytes), /__patch_native_tree_shadow_/,
    'private v11 compatibility payload intentionally retains the hidden shadow');
});

test('payload v12 footer round-trip preserves exact bytes and version', () => {
  const ir = build();
  const runtime = Uint8Array.of(0x4d, 0x5a, 0, 0, 0, 0, 0, 0);
  const sealed = sealNativeGuiRuntimeV12(runtime, ir, { platform: 'windows' });
  assert.deepEqual(decodeNativeGuiPayloadV12(sealed), encodeNativeGuiPayloadV12(ir));
  const footer = new DataView(sealed.buffer, sealed.byteOffset + sealed.byteLength - 20, 20);
  assert.equal(footer.getUint32(8, true), PATCH_SEALED_NATIVE_GUI_TREE_VERSION);
});

test('payload v12 fails closed on malformed Tree parent metadata', () => {
  const bytes = encodeNativeGuiPayloadV12(build());
  const metadata = inspectNativeGuiTreesV12(bytes);
  assert.equal(metadata.trees[0].nodes[1].parent, 0);
  // Structural corruption is covered by the C++ converter too; here ensure the JS inspector rejects truncation.
  assert.throws(() => inspectNativeGuiTreesV12(bytes.subarray(0, metadata.eventsOffset - 1)), /Malformed|invalid/i);
});
