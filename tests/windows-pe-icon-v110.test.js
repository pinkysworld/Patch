import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PATCH_WINDOWS_PE_ICON_V110_CAPACITY,
  PATCH_WINDOWS_PE_ICON_V110_ID,
  PATCH_WINDOWS_PE_ICON_V110_SENTINEL,
  WindowsPeIconV110Error,
  createWindowsPeIconPlaceholderIcoV110,
  embedWindowsPeApplicationIconV110,
  inspectWindowsPeApplicationIconV110
} from '../src/windows-pe-icon-v110.js';

const PLACEHOLDER_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAACX0lEQVR42u3UMQEAAAjDsOmcfx9gAAfkiIEeTdsBfooIYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAGIAIYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAGIAIYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAGIAQYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGABgAIABAAYAGAAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYAGAAgAEABgAYABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAYACAAQAGABgAcFlwKx7E858ZqQAAAABJRU5ErkJggg==';
const PROJECT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAG40lEQVR4Ae3WQQ0AIBAEsROBbCTiBYKO6QMD7GXSWftczx+4geYNjOGbw9vd7v8GBICACDB8AwIQHp8CKEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACEAABIAAwjcgAOHxCYAABEAACCB8AwIQHp8ACOABYkQlNm0HpoMAAAAASUVORK5CYII=';

const PLACEHOLDER_PNG = new Uint8Array(Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'));
const PROJECT_PNG = new Uint8Array(Buffer.from(PROJECT_PNG_BASE64, 'base64'));
const RESOURCE_RVA = 0x1000;
const RESOURCE_RAW = 0x200;
const ICON_ID = 101;
const ICON_DATA_REL = 0x200;
const GROUP_DATA_REL = ICON_DATA_REL + PATCH_WINDOWS_PE_ICON_V110_CAPACITY + 0x20;

function buildSyntheticPeWithIconSlot() {
  const placeholderIco = createWindowsPeIconPlaceholderIcoV110(PLACEHOLDER_PNG);
  const slot = placeholderIco.subarray(22);
  assert.equal(slot.length, PATCH_WINDOWS_PE_ICON_V110_CAPACITY);

  const resourceRawSize = align(GROUP_DATA_REL + 0x100, 0x200);
  const bytes = new Uint8Array(RESOURCE_RAW + resourceRawSize);
  const view = new DataView(bytes.buffer);

  bytes[0] = 0x4d; bytes[1] = 0x5a;
  view.setUint32(0x3c, 0x80, true);
  bytes.set([0x50, 0x45, 0x00, 0x00], 0x80);
  const coff = 0x84;
  view.setUint16(coff, 0x8664, true);
  view.setUint16(coff + 2, 1, true);
  view.setUint16(coff + 16, 0xf0, true);
  const optional = coff + 20;
  view.setUint16(optional, 0x20b, true);
  view.setUint32(optional + 108, 16, true);
  view.setUint32(optional + 112 + 16, RESOURCE_RVA, true);
  view.setUint32(optional + 112 + 20, resourceRawSize, true);
  const section = optional + 0xf0;
  bytes.set(new TextEncoder().encode('.rsrc\0\0\0'), section);
  view.setUint32(section + 8, resourceRawSize, true);
  view.setUint32(section + 12, RESOURCE_RVA, true);
  view.setUint32(section + 16, resourceRawSize, true);
  view.setUint32(section + 20, RESOURCE_RAW, true);

  resourceDirectory(bytes, 0x000, [
    [3, true, 0x020],
    [14, true, 0x070]
  ]);
  resourceDirectory(bytes, 0x020, [[ICON_ID, true, 0x040]]);
  resourceDirectory(bytes, 0x040, [[1033, false, 0x060]]);
  resourceDataEntry(bytes, 0x060, RESOURCE_RVA + ICON_DATA_REL, PATCH_WINDOWS_PE_ICON_V110_CAPACITY);

  resourceDirectory(bytes, 0x070, [[1, true, 0x090]]);
  resourceDirectory(bytes, 0x090, [[1033, false, 0x0b0]]);
  resourceDataEntry(bytes, 0x0b0, RESOURCE_RVA + GROUP_DATA_REL, 20);

  bytes.set(slot, RESOURCE_RAW + ICON_DATA_REL);
  const groupOffset = RESOURCE_RAW + GROUP_DATA_REL;
  view.setUint16(groupOffset, 0, true);
  view.setUint16(groupOffset + 2, 1, true);
  view.setUint16(groupOffset + 4, 1, true);
  bytes[groupOffset + 6] = 0;
  bytes[groupOffset + 7] = 0;
  bytes[groupOffset + 8] = 0;
  bytes[groupOffset + 9] = 0;
  view.setUint16(groupOffset + 10, 1, true);
  view.setUint16(groupOffset + 12, 32, true);
  view.setUint32(groupOffset + 14, PATCH_WINDOWS_PE_ICON_V110_CAPACITY, true);
  view.setUint16(groupOffset + 18, ICON_ID, true);
  return bytes;
}

function resourceDirectory(bytes, relative, entries) {
  const offset = RESOURCE_RAW + relative;
  const view = new DataView(bytes.buffer);
  view.setUint16(offset + 12, 0, true);
  view.setUint16(offset + 14, entries.length, true);
  entries.forEach(([id, directory, target], index) => {
    const entry = offset + 16 + index * 8;
    view.setUint32(entry, id, true);
    view.setUint32(entry + 4, (directory ? 0x80000000 : 0) | target, true);
  });
}

function resourceDataEntry(bytes, relative, rva, size) {
  const offset = RESOURCE_RAW + relative;
  const view = new DataView(bytes.buffer);
  view.setUint32(offset, rva, true);
  view.setUint32(offset + 4, size, true);
  view.setUint32(offset + 8, 0, true);
  view.setUint32(offset + 12, 0, true);
}

function align(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

test('placeholder ICO reserves one deterministic 256 KiB PNG-backed RT_ICON image', () => {
  const ico = createWindowsPeIconPlaceholderIcoV110(PLACEHOLDER_PNG);
  assert.equal(ico.length, 22 + PATCH_WINDOWS_PE_ICON_V110_CAPACITY);
  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
  assert.deepEqual([...ico.subarray(0, 6)], [0, 0, 1, 0, 1, 0]);
  assert.equal(ico[6], 0);
  assert.equal(ico[7], 0);
  assert.equal(view.getUint32(14, true), PATCH_WINDOWS_PE_ICON_V110_CAPACITY);
  assert.equal(view.getUint32(18, true), 22);
  const sentinel = new TextDecoder().decode(ico.subarray(ico.length - PATCH_WINDOWS_PE_ICON_V110_SENTINEL.length));
  assert.equal(sentinel, PATCH_WINDOWS_PE_ICON_V110_SENTINEL);
});

test('PE icon embedder replaces only the reserved resource slot and updates RT_ICON plus RT_GROUP_ICON sizes', () => {
  const original = buildSyntheticPeWithIconSlot();
  const before = inspectWindowsPeApplicationIconV110(original);
  assert.equal(before.id, PATCH_WINDOWS_PE_ICON_V110_ID);
  assert.equal(before.iconId, ICON_ID);
  assert.equal(before.currentSize, PATCH_WINDOWS_PE_ICON_V110_CAPACITY);
  assert.equal(before.groupSize, PATCH_WINDOWS_PE_ICON_V110_CAPACITY);
  assert.equal(before.width, 256);
  assert.equal(before.height, 256);

  const patched = embedWindowsPeApplicationIconV110(original, PROJECT_PNG);
  assert.equal(patched.length, original.length);
  const after = inspectWindowsPeApplicationIconV110(patched);
  assert.equal(after.iconId, ICON_ID);
  assert.equal(after.currentSize, PROJECT_PNG.length);
  assert.equal(after.groupSize, PROJECT_PNG.length);
  assert.equal(after.width, 256);
  assert.equal(after.height, 256);
  assert.deepEqual(patched.subarray(after.dataOffset, after.dataOffset + PROJECT_PNG.length), PROJECT_PNG);
  assert.equal(new TextDecoder().decode(patched.subarray(after.sentinelOffset, after.sentinelOffset + PATCH_WINDOWS_PE_ICON_V110_SENTINEL.length)), PATCH_WINDOWS_PE_ICON_V110_SENTINEL);
  assert.notDeepEqual(patched, original);
});

test('reserved PE slot remains safely repatchable without moving the executable layout', () => {
  const original = buildSyntheticPeWithIconSlot();
  const first = embedWindowsPeApplicationIconV110(original, PROJECT_PNG);
  const second = embedWindowsPeApplicationIconV110(first, PLACEHOLDER_PNG);
  const inspected = inspectWindowsPeApplicationIconV110(second);
  assert.equal(second.length, original.length);
  assert.equal(inspected.currentSize, PLACEHOLDER_PNG.length);
  assert.equal(inspected.groupSize, PLACEHOLDER_PNG.length);
  assert.deepEqual(second.subarray(inspected.dataOffset, inspected.dataOffset + PLACEHOLDER_PNG.length), PLACEHOLDER_PNG);
});

test('PE icon embedder fails closed when the reserved slot marker is absent', () => {
  const broken = buildSyntheticPeWithIconSlot();
  const sentinel = new TextEncoder().encode(PATCH_WINDOWS_PE_ICON_V110_SENTINEL);
  for (let offset = 0; offset <= broken.length - sentinel.length; offset += 1) {
    let match = true;
    for (let index = 0; index < sentinel.length; index += 1) if (broken[offset + index] !== sentinel[index]) { match = false; break; }
    if (match) { broken[offset] ^= 0xff; break; }
  }
  assert.throws(
    () => inspectWindowsPeApplicationIconV110(broken),
    error => error instanceof WindowsPeIconV110Error && error.code === 'WINDOWS_PE_ICON_V110_SLOT_MISSING'
  );
});

test('PE icon v0.1 requires an exact 256x256 project PNG', () => {
  const tiny = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==', 'base64'));
  assert.throws(
    () => embedWindowsPeApplicationIconV110(buildSyntheticPeWithIconSlot(), tiny),
    error => error instanceof WindowsPeIconV110Error && error.code === 'WINDOWS_PE_ICON_V110_DIMENSIONS'
  );
});
