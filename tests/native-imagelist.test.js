import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
import {
  buildNativeGuiIRV18,
  validateNativeGuiIRV18,
  toV17CompatibleV18,
  flattenNativeGuiControlsV18,
  hasNativeImageList,
  hasNativeButtonImage
} from '../src/native-gui-ir-v18.js';
import { buildNativeGuiIRV17 } from '../src/native-gui-ir-v17.js';
import {
  encodeNativeGuiPayloadV18,
  inspectNativeGuiImageListsV18,
  sealNativeGuiRuntimeV18
} from '../src/sealed-native-gui-v18.js';
import { resolveNativePictureResources } from '../src/native-picture-resources.js';
import { NativeGuiError } from '../src/native-gui-frozen-lower.js';

const SOURCE = readFileSync('examples/imagelist-window.patch', 'utf8');
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNQaPj/HwAFAgKfqfZU2QAAAABJRU5ErkJggg==';
const RESOURCE = Object.freeze({
  id: 'icons.open',
  path: 'resources/open.png',
  mediaType: 'image/png',
  size: Buffer.from(TINY_PNG, 'base64').length,
  sha256: '0'.repeat(64),
  data: TINY_PNG
});

function build(source = SOURCE) {
  return buildNativeGuiIRV18(compile(source, { name: 'NativeImageList', kind: 'window' }));
}

function buttonOf(ir) {
  return flattenNativeGuiControlsV18(ir).find(control => control.id === 'open_button');
}

function mutableButtonOf(ir) {
  const walk = controls => {
    for (const control of controls ?? []) {
      if (control.id === 'open_button') return control;
      if (control.type === 'tabs') for (const page of control.pages ?? []) {
        const found = walk(page.controls); if (found) return found;
      }
      if (control.type === 'panel') { const found = walk(control.controls); if (found) return found; }
    }
    return null;
  };
  for (const form of ir.forms ?? []) { const found = walk(form.controls); if (found) return found; }
  return null;
}

function firstButtonFieldSpans(payload, extensionOffset) {
  const bytes = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  let offset = extensionOffset;
  const u32 = () => {
    const value = bytes.readUInt32LE(offset);
    offset += 4;
    return value;
  };
  const text = () => {
    const length = u32();
    const span = { start: offset, length };
    offset += length;
    return span;
  };
  const listCount = u32();
  for (let listIndex = 0; listIndex < listCount; listIndex += 1) {
    text();
    u32();
    u32();
    const itemCount = u32();
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      text();
      text();
      text();
    }
  }
  const buttonCount = u32();
  assert.ok(buttonCount > 0);
  u32();
  const id = text();
  const imageListId = text();
  const imageItem = text();
  const source = text();
  const widthOffset = offset;
  u32();
  const heightOffset = offset;
  u32();
  return { id, imageListId, imageItem, source, widthOffset, heightOffset };
}

test('Native GUI IR 1.8 carries ImageList and Button image metadata over an exact 1.7 compatibility boundary', () => {
  const ir = build();
  assert.equal(ir.version, '1.8');
  assert.equal(hasNativeImageList(ir), true);
  assert.equal(hasNativeButtonImage(ir), true);
  assert.equal(ir.imageLists.length, 1);
  assert.deepEqual(
    { id: ir.imageLists[0].id, width: ir.imageLists[0].width, height: ir.imageLists[0].height },
    { id: 'icons', width: 16, height: 16 }
  );
  assert.equal(ir.imageLists[0].items[0].name, 'open');
  const button = buttonOf(ir);
  assert.equal(button.imageListId, 'icons');
  assert.equal(button.imageItem, 'open');
  assert.equal(button.imageResourceId, 'icons.open');
  assert.equal(button.imageSource, 'patch-resource:icons.open');
  assert.equal(button.imageWidth, 16);
  assert.equal(button.imageHeight, 16);

  const compatible = toV17CompatibleV18(ir);
  assert.equal(compatible.version, '1.7');
  assert.equal(compatible.imageLists, undefined);
  const shadow = compatible.forms[0].controls.find(item => item.id === 'open_button');
  assert.equal(shadow.imageListId, undefined);
  assert.equal(shadow.imageItem, undefined);
  assert.equal(shadow.imageSource, undefined);
  assert.equal(shadow.imageResourceId, undefined);
  assert.equal(validateNativeGuiIRV18(ir), ir);
});

test('Native GUI IR 1.7 still fail-closes ImageList Button images', () => {
  const compiled = compile(SOURCE, { name: 'LegacyImageList', kind: 'window' });
  assert.throws(() => buildNativeGuiIRV17(compiled), error => (
    error instanceof NativeGuiError && /ImageList consumers remain fail-closed/i.test(error.message)
  ));
});

test('IR 1.8 rejects missing ImageList items and all mismatched Button binding metadata', () => {
  for (const [field, value, pattern] of [
    ['imageItem', 'missing', /missing ImageList item/i],
    ['imageResourceId', 'icons.other', /image resource does not match/i],
    ['imageSource', 'patch-resource:icons.other', /image source does not match/i],
    ['imageWidth', 24, /image size must match/i],
    ['imageHeight', 24, /image size must match/i]
  ]) {
    const ir = build();
    const button = mutableButtonOf(ir);
    button[field] = value;
    assert.throws(() => validateNativeGuiIRV18(ir), pattern, field);
  }
});

test('IR 1.8 rejects incomplete Button image metadata instead of silently defaulting it', () => {
  for (const field of ['imageResourceId', 'imageSource', 'imageWidth', 'imageHeight']) {
    const ir = build();
    const button = mutableButtonOf(ir);
    delete button[field];
    assert.throws(() => validateNativeGuiIRV18(ir), /image binding is incomplete/i, field);
  }
});

test('native resource linking resolves one canonical PNG source for ImageList and Button', () => {
  const ir = build();
  const resolved = resolveNativePictureResources(ir, [RESOURCE]);
  const item = resolved.ir.imageLists[0].items[0];
  const button = buttonOf(resolved.ir);
  assert.match(item.source, /^data:image\/png;base64,/);
  assert.equal(button.imageSource, item.source);
  assert.equal(button.imageResourceId, item.resourceId);
  assert.equal(resolved.resolved.filter(entry => entry.consumer === 'imagelist').length, 1);
  assert.equal(validateNativeGuiIRV18(resolved.ir), resolved.ir);
});

test('native ImageList rejects missing, mismatched, WebP and SVG resources fail-closed', () => {
  assert.throws(() => resolveNativePictureResources(build(), []), /missing project resource/i);

  const ir = build();
  ir.imageLists = [{
    ...ir.imageLists[0],
    items: [{ ...ir.imageLists[0].items[0], source: 'patch-resource:icons.other' }]
  }];
  assert.throws(() => resolveNativePictureResources(ir, [RESOURCE]), /source does not match resource/i);

  const webp = { ...RESOURCE, mediaType: 'image/webp', path: 'resources/open.webp' };
  assert.throws(() => resolveNativePictureResources(build(), [webp]), /webp|not a native Ready/i);
  const svgData = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
  const svg = { ...RESOURCE, mediaType: 'image/svg+xml', path: 'resources/open.svg', data: svgData, size: Buffer.from(svgData, 'base64').length };
  assert.throws(() => resolveNativePictureResources(build(), [svg]), /svg|not a native Ready/i);
});

test('payload v18 preserves the payload-v17 prefix and validates PILT Button/list integrity', () => {
  const ir = resolveNativePictureResources(build(), [RESOURCE]).ir;
  const payload = encodeNativeGuiPayloadV18(ir);
  const inspected = inspectNativeGuiImageListsV18(payload);
  assert.equal(inspected.imageLists.length, 1);
  assert.equal(inspected.buttons.length, 1);
  assert.equal(inspected.buttons[0].id, 'open_button');
  assert.equal(inspected.buttons[0].imageItem, 'open');
  assert.equal(inspected.buttons[0].source, inspected.imageLists[0].items[0].source);
  assert.equal(inspected.buttons[0].width, inspected.imageLists[0].width);
  assert.equal(inspected.buttons[0].height, inspected.imageLists[0].height);
  assert.ok(inspected.payloadV17.length > 0);
});

test('payload v18 inspector rejects tampered Button item, source and dimensions', () => {
  const ir = resolveNativePictureResources(build(), [RESOURCE]).ir;
  const original = encodeNativeGuiPayloadV18(ir);
  const inspected = inspectNativeGuiImageListsV18(original);
  const spans = firstButtonFieldSpans(original, inspected.extensionOffset);

  const payloadItem = Buffer.from(original);
  assert.equal(spans.imageItem.length, 4);
  Buffer.from('nope').copy(payloadItem, spans.imageItem.start);
  assert.throws(() => inspectNativeGuiImageListsV18(payloadItem), /missing ImageList item/i);

  const payloadSource = Buffer.from(original);
  payloadSource[spans.source.start + spans.source.length - 1] ^= 1;
  assert.throws(() => inspectNativeGuiImageListsV18(payloadSource), /image source does not match/i);

  const payloadWidth = Buffer.from(original);
  payloadWidth.writeUInt32LE(24, spans.widthOffset);
  assert.throws(() => inspectNativeGuiImageListsV18(payloadWidth), /image size does not match/i);
});

test('payload v18 can be sealed directly without promoting the current facade', () => {
  const ir = resolveNativePictureResources(build(), [RESOURCE]).ir;
  const mz = new Uint8Array([0x4d, 0x5a]);
  const sealed = sealNativeGuiRuntimeV18(mz, ir, { platform: 'windows' });
  assert.ok(sealed.length > mz.length);
});
