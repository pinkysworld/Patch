# Slider Stage 1

Slider Stage 1 adds a source-backed numeric range control to Patch Window applications without changing Change IR 0.10. It is supported across Patch Studio, Standalone Window Web, direct native AOT, token-free Ready builds and the offline compiler.

## Syntax

```patch
create number volume = 50

window "Mixer" as main size 560, 300:
  text "Volume: {volume}"
  slider 0..100 as volume step 5 at 24, 80 size 300, 44

when volume changed:
  change volume:
    set = value
```

General form:

```text
slider MIN..MAX as ID [step STEP] [at X, Y [size W, H]]
```

`MIN`, `MAX` and `STEP` are finite numeric literals. Minimum must be smaller than maximum. `step` defaults to `1` and must be greater than zero. Signed and decimal ranges are valid.

## Event semantics

Slider exposes `changed`. Its event-local `value` is a finite **number** inside the declared range. Window event adapter **0.9** is the first contract that types Slider `changed` as a bounded finite numeric event-local value.

The UI control does not persist that number by itself. Persistent application state changes only when Patch source executes ordinary semantic `change`:

```patch
when volume changed:
  change volume:
    set = value
```

If persistent state has the same name as the Slider id it must be `number` state. Text/list/Boolean bindings with that id fail validation.

## Compiler and Change IR

Slider lowers as the existing `UI_CONTROL` Change IR instruction with `control: "slider"`, id, min, max and step metadata. The compiler advertises runtime capability `ui.slider`.

Change IR remains **0.10** because Slider does not add a new persistent mutation mechanism or alter semantic Change operations.

## Patch Studio and Web

Patch Studio provides source-backed Slider insertion, id/range/step Properties, geometry, App Preview, live transient values, bounded numeric `changed` dispatch, Tabs insertion and a Slider sample application.

Standalone Window Web renders an accessible `<input type="range">` and validates finite in-range event values before executing Patch handlers. The standalone metadata advertises `sliderStage: 1` and `sliderMode: "transient-number"`.

## Native contract

Slider was introduced on the additive Native GUI IR **1.3** / payload **v13** / runtime **v1.4** line. The current product-facing contract is now:

- Native GUI IR **1.6**;
- sealed payload **v16**;
- native runtime **v1.7**;
- Windows: native `TRACKBAR`;
- macOS: native `NSSlider`;
- Linux: native GTK3 `GtkScale`;
- product import: `src/native-current-contract.js`.

Native GUI IR 1.6 preserves the exact Slider range/step/binding/event semantics introduced by 1.3 while adding Chrome Stage 1, Shape Stage 1 and PaintBox Stage 1 transport. Current direct AOT, token-free Ready Window downloads and Windows/macOS/Linux offline Window linking therefore all preserve Slider behavior.

Native smoke execution verifies that the real native control exists, numeric `changed` values are delivered, explicit `change ... set = value` stores the selected number, and older Table/ListBox/Menu/TreeView behavior remains intact.

## Compatibility boundary

The frozen TreeView compatibility line intentionally fails closed for Slider:

- Native GUI IR **1.2**;
- sealed payload **v12**;
- native runtime **v1.3**.

The previous Slider-capable compatibility line remains Native GUI IR **1.3** / payload **v13** / runtime **v1.4**. Older payloads are not silently upgraded or reinterpreted.

## Assurance boundary

Slider product/runtime work is after the beta.32 research milestone and does not widen the beta.32 invocation-frame/direct-Wasm correspondence claim. Persistent mutation remains explicit through `change`, toolkit values remain transient unless committed, and unsupported older native contracts fail closed.
