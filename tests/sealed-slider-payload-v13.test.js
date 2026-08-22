import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/compiler.js';
import { buildNativeGuiIRV13 } from '../src/native-gui-ir-v13.js';
import { adaptNativeSlidersForV13Backend } from '../src/native-slider-backend-adapter.js';
import { encodeNativeGuiPayloadV12 } from '../src/sealed-native-gui-v12.js';
import {
  PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION,
  encodeNativeGuiPayloadV13,
  sealNativeGuiRuntimeV13,
  decodeNativeGuiPayloadV13,
  inspectNativeGuiSlidersV13
} from '../src/sealed-native-gui-v13.js';

const source = `create number volume = 20
window "Mixer" as main size 520, 220:
  slider 0..100 as volume step 5 at 24, 32 size 320, 44
  text "Volume {volume}" at 24, 92 size 220, 30
when volume changed:
  change volume:
    set = value
`;

function build() {
  return buildNativeGuiIRV13(compile(source, { name: 'SealedSlider', kind: 'window' }));
}

test('payload v13 appends Slider metadata to exact payload v12 compatibility bytes', () => {
  const ir = build();
  const adapted = adaptNativeSlidersForV13Backend(ir);
  const payloadV12 = encodeNativeGuiPayloadV12(adapted.compatibleIr);
  const payloadV13 = encodeNativeGuiPayloadV13(ir);
  const metadata = inspectNativeGuiSlidersV13(payloadV13);
  assert.deepEqual(metadata.payloadV12, payloadV12);
  assert.equal(metadata.sliders.length, 1);
  assert.deepEqual(metadata.sliders[0], {
    nativeIndex: 0,
    id: 'volume',
    min: 0,
    max: 100,
    step: 5,
    binding: 'volume',
    events: [{ eventIndex: 0, sentinels: [8000000000000000] }]
  });
});

test('payload v13 records numeric event sentinel ownership explicitly', () => {
  const metadata = inspectNativeGuiSlidersV13(encodeNativeGuiPayloadV13(build()));
  const sentinel = metadata.sliders[0].events[0].sentinels[0];
  assert.equal(Number.isFinite(sentinel), true);
  assert.equal(sentinel, 8000000000000000);
  assert.match(new TextDecoder().decode(metadata.payloadV12), /volume/);
});

test('payload v13 footer round-trips exact bytes and version', () => {
  const ir = build();
  const runtime = Uint8Array.of(0x4d, 0x5a, 0, 0, 0, 0, 0, 0);
  const sealed = sealNativeGuiRuntimeV13(runtime, ir, { platform: 'windows' });
  assert.deepEqual(decodeNativeGuiPayloadV13(sealed), encodeNativeGuiPayloadV13(ir));
  const footer = new DataView(sealed.buffer, sealed.byteOffset + sealed.byteLength - 20, 20);
  assert.equal(footer.getUint32(8, true), PATCH_SEALED_NATIVE_GUI_SLIDER_VERSION);
});

test('payload v13 fails closed on malformed Slider extension', () => {
  const bytes = encodeNativeGuiPayloadV13(build());
  const broken = new Uint8Array(bytes);
  broken[broken.length - 8] = 0;
  assert.throws(() => inspectNativeGuiSlidersV13(broken), /Slider extension trailer/i);
});
