import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('runtime v1.5 sources wrap v1.4 and decode payload 14 / PCHC', () => {
  const win32 = readFileSync('native-runtime/win32-sealed-gui-v15.cpp', 'utf8');
  const gtk = readFileSync('native-runtime/gtk-sealed-gui-v15.cpp', 'utf8');
  const appkit = readFileSync('native-runtime/appkit-sealed-gui-v15.mm', 'utf8');
  const header = readFileSync('native-runtime/sealed-chrome-v15.hpp', 'utf8');
  const pictureData = readFileSync('native-runtime/picture-data-v15.hpp', 'utf8');
  const example = readFileSync('examples/chrome-window.patch', 'utf8');
  for (const source of [win32, gtk, appkit]) {
    assert.match(source, /version != 14/);
    assert.match(source, /PatchConvertPayloadV14ToV13/);
    assert.match(source, /PATCH_CHROME_TIMER_V15/);
    assert.match(source, /RunPatchChromeSmokeV15/);
    assert.match(source, /picture-data-v15\.hpp/);
    assert.match(source, /PatchPictureEmbeddedSourceV15/);
    assert.match(source, /PatchDecodePictureDataUriV15/);
  }
  assert.match(win32, /BS_GROUPBOX/);
  assert.match(win32, /SetTimer/);
  assert.match(win32, /IWICImagingFactory/);
  assert.match(win32, /CreateDIBSection/);
  assert.match(win32, /SS_BITMAP/);
  assert.match(win32, /windowscodecs\.lib/);
  assert.match(gtk, /gtk_frame_new/);
  assert.match(gtk, /GdkPixbufLoader/);
  assert.match(gtk, /gtk_button_set_image/);
  assert.match(appkit, /NSTimer/);
  assert.match(appkit, /NSImage/);
  assert.match(appkit, /NSImageScaleProportionallyUpOrDown/);
  assert.match(header, /"PCHC"/);
  assert.match(pictureData, /PATCH_PICTURE_MAX_BYTES_V15\s*=\s*2u\s*\*\s*1024u\s*\*\s*1024u/);
  assert.match(pictureData, /decodedSize\s*>\s*PATCH_PICTURE_MAX_BYTES_V15/);
  assert.match(pictureData, /data:image\/png;base64,/);
  assert.match(pictureData, /data:image\/jpeg;base64,/);
  assert.doesNotMatch(pictureData, /image\/webp/);
  assert.match(example, /picture as poster from "data:image\/png;base64,/);
});

test('Chrome smoke Picture fixture is a structurally valid PNG with correct chunk CRCs', () => {
  const example = readFileSync('examples/chrome-window.patch', 'utf8');
  const match = example.match(/picture as poster from "data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(match, 'embedded PNG Picture fixture should be present');
  const bytes = Buffer.from(match[1], 'base64');
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);

  let offset = 8;
  let sawIdat = false;
  let sawIend = false;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, 'PNG chunk header should fit');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    assert.ok(crcOffset + 4 <= bytes.length, 'PNG chunk data should fit');
    const expected = bytes.readUInt32BE(crcOffset);
    const actual = pngCrc32(Buffer.concat([type, bytes.subarray(dataStart, dataEnd)]));
    assert.equal(actual, expected, `${type.toString('ascii')} chunk CRC should be valid`);
    const name = type.toString('ascii');
    if (name === 'IDAT') sawIdat = true;
    if (name === 'IEND') sawIend = true;
    offset = crcOffset + 4;
  }
  assert.equal(offset, bytes.length);
  assert.equal(sawIdat, true);
  assert.equal(sawIend, true);
});

function pngCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
