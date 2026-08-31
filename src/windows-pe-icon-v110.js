import { inspectPngDimensions } from './native-window-icon-packaging.js';

export const PATCH_WINDOWS_PE_ICON_V110_VERSION = '0.1';
export const PATCH_WINDOWS_PE_ICON_V110_ID = 'windows-pe-icon-v110/0.1';
export const PATCH_WINDOWS_PE_ICON_V110_SIZE = 256;
export const PATCH_WINDOWS_PE_ICON_V110_CAPACITY = 256 * 1024;
export const PATCH_WINDOWS_PE_ICON_V110_SENTINEL = 'PATCHV110ICONPLACEHOLDER';

const RT_ICON = 3;
const RT_GROUP_ICON = 14;
const PNG_SIGNATURE = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SENTINEL_BYTES = new TextEncoder().encode(PATCH_WINDOWS_PE_ICON_V110_SENTINEL);
const MAX_PROJECT_ICON_BYTES = PATCH_WINDOWS_PE_ICON_V110_CAPACITY - SENTINEL_BYTES.length;

export class WindowsPeIconV110Error extends Error {
  constructor(message, code = 'WINDOWS_PE_ICON_V110') {
    super(message);
    this.name = 'WindowsPeIconV110Error';
    this.code = code;
  }
}

/**
 * Create the build-time .ico consumed by rc.exe for the generic runtime-v1.10
 * template. The RT_ICON payload reserves a fixed 256 KiB slot and carries a
 * sentinel outside the declared project PNG bytes. After linking, the browser
 * or Offline Compiler can replace that slot deterministically without moving
 * PE sections or requiring rcedit, rc.exe, GitHub or a local compiler.
 */
export function createWindowsPeIconPlaceholderIcoV110(input) {
  const png = requireProjectIconPng(input, 'placeholder');
  const imageOffset = 22;
  const out = new Uint8Array(imageOffset + PATCH_WINDOWS_PE_ICON_V110_CAPACITY);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  out[6] = 0; // 256
  out[7] = 0; // 256
  out[8] = 0;
  out[9] = 0;
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, PATCH_WINDOWS_PE_ICON_V110_CAPACITY, true);
  view.setUint32(18, imageOffset, true);
  out.set(png, imageOffset);
  out.set(SENTINEL_BYTES, imageOffset + PATCH_WINDOWS_PE_ICON_V110_CAPACITY - SENTINEL_BYTES.length);
  return out;
}

/**
 * Replace the reserved RT_ICON bytes in a linked runtime-v1.10 PE image.
 * The resource section does not grow or move. The RT_ICON data-entry size and
 * matching RT_GROUP_ICON bytesInRes value are updated to the real project PNG
 * length. The sentinel remains beyond the declared resource size so repeated
 * deterministic patching is possible and the executable layout stays stable.
 */
export function embedWindowsPeApplicationIconV110(executableBytes, input) {
  const png = requireProjectIconPng(input, 'project');
  const source = toBytes(executableBytes);
  const pe = parsePe(source);
  const slot = locateReservedIconSlot(source, pe);
  const group = locateMatchingGroupIcon(source, pe, slot.iconId);
  const out = new Uint8Array(source);

  out.fill(0, slot.dataOffset, slot.dataOffset + PATCH_WINDOWS_PE_ICON_V110_CAPACITY);
  out.set(png, slot.dataOffset);
  out.set(SENTINEL_BYTES, slot.dataOffset + PATCH_WINDOWS_PE_ICON_V110_CAPACITY - SENTINEL_BYTES.length);
  new DataView(out.buffer).setUint32(slot.dataEntryOffset + 4, png.length, true);
  new DataView(out.buffer).setUint32(group.bytesInResOffset, png.length, true);

  const inspected = inspectWindowsPeApplicationIconV110(out);
  if (inspected.currentSize !== png.length || inspected.iconId !== slot.iconId) {
    throw new WindowsPeIconV110Error('Windows PE icon slot verification failed after patching.', 'WINDOWS_PE_ICON_V110_VERIFY');
  }
  return out;
}

export function inspectWindowsPeApplicationIconV110(executableBytes) {
  const bytes = toBytes(executableBytes);
  const pe = parsePe(bytes);
  const slot = locateReservedIconSlot(bytes, pe);
  const group = locateMatchingGroupIcon(bytes, pe, slot.iconId);
  const current = bytes.subarray(slot.dataOffset, slot.dataOffset + slot.currentSize);
  const dimensions = hasPngSignature(current) && current.length >= 24
    ? inspectPngDimensions(current)
    : null;
  return Object.freeze({
    id: PATCH_WINDOWS_PE_ICON_V110_ID,
    version: PATCH_WINDOWS_PE_ICON_V110_VERSION,
    iconId: slot.iconId,
    capacity: PATCH_WINDOWS_PE_ICON_V110_CAPACITY,
    currentSize: slot.currentSize,
    groupSize: group.bytesInRes,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    dataOffset: slot.dataOffset,
    dataEntryOffset: slot.dataEntryOffset,
    groupDataOffset: group.dataOffset,
    sentinelOffset: slot.sentinelOffset
  });
}

function locateReservedIconSlot(bytes, pe) {
  const candidates = resourceLeavesByType(bytes, pe, RT_ICON);
  const matches = [];
  for (const candidate of candidates) {
    if (candidate.dataSize > PATCH_WINDOWS_PE_ICON_V110_CAPACITY) continue;
    const slotEnd = candidate.dataOffset + PATCH_WINDOWS_PE_ICON_V110_CAPACITY;
    if (slotEnd > bytes.length) continue;
    const sentinelOffset = slotEnd - SENTINEL_BYTES.length;
    if (!bytesEqual(bytes.subarray(sentinelOffset, slotEnd), SENTINEL_BYTES)) continue;
    if (!hasPngSignature(bytes.subarray(candidate.dataOffset, Math.min(candidate.dataOffset + 8, bytes.length)))) continue;
    matches.push({
      iconId: candidate.resourceId,
      dataOffset: candidate.dataOffset,
      dataEntryOffset: candidate.dataEntryOffset,
      currentSize: candidate.dataSize,
      sentinelOffset
    });
  }
  if (matches.length !== 1) {
    throw new WindowsPeIconV110Error(
      matches.length
        ? 'Windows PE contains more than one runtime-v1.10 icon placeholder slot.'
        : 'Windows PE does not contain the reserved runtime-v1.10 application icon slot.',
      matches.length ? 'WINDOWS_PE_ICON_V110_DUPLICATE_SLOT' : 'WINDOWS_PE_ICON_V110_SLOT_MISSING'
    );
  }
  return matches[0];
}

function locateMatchingGroupIcon(bytes, pe, iconId) {
  const groups = resourceLeavesByType(bytes, pe, RT_GROUP_ICON);
  const matches = [];
  for (const group of groups) {
    if (group.dataSize < 6 || group.dataOffset + group.dataSize > bytes.length) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset + group.dataOffset, group.dataSize);
    if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) continue;
    const count = view.getUint16(4, true);
    if (!count || 6 + count * 14 > group.dataSize) continue;
    for (let index = 0; index < count; index += 1) {
      const entry = 6 + index * 14;
      const resourceId = view.getUint16(entry + 12, true);
      if (resourceId !== iconId) continue;
      const width = view.getUint8(entry);
      const height = view.getUint8(entry + 1);
      if (width !== 0 || height !== 0) {
        throw new WindowsPeIconV110Error('Reserved Windows PE application icon group is not the required 256x256 slot.', 'WINDOWS_PE_ICON_V110_GROUP_DIMENSIONS');
      }
      matches.push({
        dataOffset: group.dataOffset,
        bytesInResOffset: group.dataOffset + entry + 8,
        bytesInRes: view.getUint32(entry + 8, true)
      });
    }
  }
  if (matches.length !== 1) {
    throw new WindowsPeIconV110Error(
      matches.length
        ? 'Windows PE contains more than one matching application icon group entry.'
        : 'Windows PE application icon group does not reference the reserved icon slot.',
      matches.length ? 'WINDOWS_PE_ICON_V110_DUPLICATE_GROUP' : 'WINDOWS_PE_ICON_V110_GROUP_MISSING'
    );
  }
  return matches[0];
}

function resourceLeavesByType(bytes, pe, typeId) {
  const rootEntries = readResourceDirectory(bytes, pe, 0);
  const type = rootEntries.find(entry => entry.id === typeId && entry.directory);
  if (!type) return [];
  const leaves = [];
  walkResourceDirectory(bytes, pe, type.targetRelativeOffset, [], leaves, 0);
  return leaves;
}

function walkResourceDirectory(bytes, pe, relativeOffset, path, leaves, depth) {
  if (depth > 4) throw new WindowsPeIconV110Error('Windows PE resource tree exceeds the supported depth.', 'WINDOWS_PE_ICON_V110_RESOURCE_TREE');
  for (const entry of readResourceDirectory(bytes, pe, relativeOffset)) {
    const nextPath = [...path, entry];
    if (entry.directory) {
      walkResourceDirectory(bytes, pe, entry.targetRelativeOffset, nextPath, leaves, depth + 1);
      continue;
    }
    const dataEntryOffset = pe.resourceOffset + entry.targetRelativeOffset;
    need(bytes, dataEntryOffset, 16, 'resource data entry');
    const view = new DataView(bytes.buffer, bytes.byteOffset + dataEntryOffset, 16);
    const dataRva = view.getUint32(0, true);
    const dataSize = view.getUint32(4, true);
    const dataOffset = rvaToFileOffset(pe, dataRva, dataSize);
    const resourceId = nextPath.find(item => item.id !== null)?.id ?? null;
    leaves.push({ resourceId, dataEntryOffset, dataRva, dataOffset, dataSize });
  }
}

function readResourceDirectory(bytes, pe, relativeOffset) {
  const offset = pe.resourceOffset + relativeOffset;
  need(bytes, offset, 16, 'resource directory');
  const header = new DataView(bytes.buffer, bytes.byteOffset + offset, 16);
  const count = header.getUint16(12, true) + header.getUint16(14, true);
  if (count > 4096) throw new WindowsPeIconV110Error('Windows PE resource directory contains too many entries.', 'WINDOWS_PE_ICON_V110_RESOURCE_COUNT');
  need(bytes, offset + 16, count * 8, 'resource directory entries');
  const entries = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset + 16, count * 8);
  for (let index = 0; index < count; index += 1) {
    const name = view.getUint32(index * 8, true);
    const target = view.getUint32(index * 8 + 4, true);
    entries.push(Object.freeze({
      id: (name & 0x80000000) === 0 ? (name & 0x7fffffff) : null,
      named: (name & 0x80000000) !== 0,
      directory: (target & 0x80000000) !== 0,
      targetRelativeOffset: target & 0x7fffffff
    }));
  }
  return entries;
}

function parsePe(bytes) {
  need(bytes, 0, 0x40, 'DOS header');
  if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) throw new WindowsPeIconV110Error('Input is not a Windows PE executable.', 'WINDOWS_PE_ICON_V110_PE');
  const dos = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const peOffset = dos.getUint32(0x3c, true);
  need(bytes, peOffset, 24, 'PE header');
  if (bytes[peOffset] !== 0x50 || bytes[peOffset + 1] !== 0x45 || bytes[peOffset + 2] !== 0 || bytes[peOffset + 3] !== 0) {
    throw new WindowsPeIconV110Error('Input has an invalid Windows PE signature.', 'WINDOWS_PE_ICON_V110_PE');
  }
  const coff = peOffset + 4;
  const numberOfSections = dos.getUint16(coff + 2, true);
  const optionalSize = dos.getUint16(coff + 16, true);
  const optionalOffset = coff + 20;
  need(bytes, optionalOffset, optionalSize, 'PE optional header');
  const magic = dos.getUint16(optionalOffset, true);
  const dataDirectoryOffset = optionalOffset + (magic === 0x20b ? 112 : magic === 0x10b ? 96 : -1);
  const numberOfRvaOffset = optionalOffset + (magic === 0x20b ? 108 : magic === 0x10b ? 92 : -1);
  if (dataDirectoryOffset < optionalOffset || numberOfRvaOffset < optionalOffset) {
    throw new WindowsPeIconV110Error('Unsupported Windows PE optional-header format.', 'WINDOWS_PE_ICON_V110_PE_FORMAT');
  }
  if (dos.getUint32(numberOfRvaOffset, true) < 3) {
    throw new WindowsPeIconV110Error('Windows PE has no resource data directory.', 'WINDOWS_PE_ICON_V110_RESOURCE_MISSING');
  }
  need(bytes, dataDirectoryOffset + 16, 8, 'PE resource data directory');
  const resourceRva = dos.getUint32(dataDirectoryOffset + 16, true);
  const resourceSize = dos.getUint32(dataDirectoryOffset + 20, true);
  if (!resourceRva || !resourceSize) throw new WindowsPeIconV110Error('Windows PE has no resource section.', 'WINDOWS_PE_ICON_V110_RESOURCE_MISSING');

  const sectionOffset = optionalOffset + optionalSize;
  need(bytes, sectionOffset, numberOfSections * 40, 'PE section table');
  const sections = [];
  for (let index = 0; index < numberOfSections; index += 1) {
    const entry = sectionOffset + index * 40;
    sections.push(Object.freeze({
      virtualSize: dos.getUint32(entry + 8, true),
      virtualAddress: dos.getUint32(entry + 12, true),
      rawSize: dos.getUint32(entry + 16, true),
      rawOffset: dos.getUint32(entry + 20, true)
    }));
  }
  const pe = { resourceRva, resourceSize, sections, resourceOffset: 0 };
  pe.resourceOffset = rvaToFileOffset(pe, resourceRva, Math.min(resourceSize, 16));
  return Object.freeze(pe);
}

function rvaToFileOffset(pe, rva, size = 1) {
  for (const section of pe.sections) {
    const span = Math.max(section.virtualSize, section.rawSize);
    if (rva < section.virtualAddress || rva >= section.virtualAddress + span) continue;
    const delta = rva - section.virtualAddress;
    if (delta + size > section.rawSize) {
      throw new WindowsPeIconV110Error('Windows PE resource points outside section raw data.', 'WINDOWS_PE_ICON_V110_RVA');
    }
    return section.rawOffset + delta;
  }
  throw new WindowsPeIconV110Error(`Windows PE resource RVA 0x${rva.toString(16)} is not file-backed.`, 'WINDOWS_PE_ICON_V110_RVA');
}

function requireProjectIconPng(input, label) {
  const png = toBytes(input);
  const dimensions = inspectPngDimensions(png);
  if (dimensions.width !== PATCH_WINDOWS_PE_ICON_V110_SIZE || dimensions.height !== PATCH_WINDOWS_PE_ICON_V110_SIZE) {
    throw new WindowsPeIconV110Error(
      `Windows PE ${label} icon v0.1 requires an exact ${PATCH_WINDOWS_PE_ICON_V110_SIZE}x${PATCH_WINDOWS_PE_ICON_V110_SIZE} PNG; received ${dimensions.width}x${dimensions.height}.`,
      'WINDOWS_PE_ICON_V110_DIMENSIONS'
    );
  }
  if (png.length > MAX_PROJECT_ICON_BYTES) {
    throw new WindowsPeIconV110Error(
      `Windows PE ${label} icon exceeds the ${MAX_PROJECT_ICON_BYTES}-byte reserved runtime-v1.10 slot.`,
      'WINDOWS_PE_ICON_V110_TOO_LARGE'
    );
  }
  return png;
}

function hasPngSignature(bytes) {
  return bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}
function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
function need(bytes, offset, size, label) {
  if (!Number.isInteger(offset) || !Number.isInteger(size) || offset < 0 || size < 0 || offset + size > bytes.length) {
    throw new WindowsPeIconV110Error(`Windows PE ${label} is truncated or out of bounds.`, 'WINDOWS_PE_ICON_V110_BOUNDS');
  }
}
function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new WindowsPeIconV110Error('Windows PE icon operation expects bytes.', 'WINDOWS_PE_ICON_V110_BYTES');
}
