# Slider Stage 1

Slider Stage 1 adds a source-backed numeric range control to Patch Window applications without changing Change IR 0.10. It is now supported across Patch Studio, Standalone Window Web, direct native AOT, token-free Ready builds and the offline compiler.

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

The general form is:

```text
slider MIN..MAX as ID [step STEP] [at X, Y [size W, H]]
```

`MIN`, `MAX` and `STEP` are finite numeric literals. The minimum must be smaller than the maximum. `step` defaults to `1` and must be greater than zero. Signed and decimal ranges are valid.

## Event semantics

Slider exposes only `changed`.

Its event-local `value` is a finite **number** inside the declared Slider range. The shared Window event adapter fails closed on non-numeric, non-finite or out-of-range host values. The UI control does not persist that number by itself. Persistent application state changes only when Patch source executes an ordinary semantic `change`.

This means:

```patch
when volume changed:
  show value
```

observes the selected numeric value but leaves persistent state unchanged, while:

```patch
when volume changed:
  change volume:
    set = value
```

commits the value through the ordinary Change IR / Change History path.

If a persistent state variable has the same name as the Slider id, that state must be `number` state. A text/list/Boolean binding with the same id fails Window validation.

Window event adapter **0.9** is the first contract that types Slider `changed` as a bounded finite numeric event-local value.

## Compiler and Change IR

Slider lowers as the existing `UI_CONTROL` Change IR instruction with additional UI metadata:

- `control: "slider"`
- `id`
- `min`
- `max`
- `step`

The compiler advertises runtime capability `ui.slider`.

Change IR remains **0.10** because Slider does not add a new persistent mutation mechanism or alter semantic Change operations. Its range and geometry are UI structure.

## Patch Studio

Patch Studio provides:

- a **+ Slider** source-backed Designer tool;
- default `0..100`, `step 1` source generation;
- source-backed id, minimum, maximum and step Properties;
- normal source-backed X/Y/width/height geometry;
- App Preview rendering with an HTML range control;
- live transient value display while dragging;
- bounded numeric `changed` dispatch when the interaction is committed;
- Slider insertion inside source-backed Tabs pages using flow layout;
- a Slider sample application.

The Designer always rewrites visible `.patch` source. There is no hidden Slider configuration document or second persistent UI model.

## Standalone Window Web

Standalone Window Web supports Slider Stage 1.

The generated single-file HTML app restores Slider metadata from the compiled AST, renders an accessible `<input type="range">`, exposes a live display value and validates that Slider `changed` receives a finite in-range number before executing Patch handlers.

The standalone metadata advertises:

- `sliderStage: 1`
- `sliderMode: "transient-number"`

## Current native contract

Native Slider parity is provided by a new additive contract rather than by redefining the frozen TreeView line:

- Native GUI IR **1.3**
- direct native backend **1.4**
- sealed payload **v13**
- sealed native runtime **v1.4**
- Windows: native `TRACKBAR`
- macOS: native `NSSlider`
- Linux: native GTK3 `GtkScale`

The same contract is used by direct AOT builds, token-free Ready Window downloads and Windows/macOS/Linux offline Window linking.

Native GUI IR 1.3 records Slider range, step, optional numeric binding and numeric `changed` event type. Payload v13 is an additive transport over the exact payload-v12 compatibility bytes. Runtime v1.4 restores the native numeric event value before invoking the existing explicit Change action engine. The private compatibility transport is not persistent Patch state and is not exposed as language semantics.

Native smoke execution on all three desktop hosts seals the canonical `examples/slider-window.patch` as payload v13, drives the real platform Slider and verifies that:

1. the native control exists with the declared range;
2. a numeric `changed` event is dispatched;
3. `change volume: set = value` stores the actual Slider number;
4. ordinary Table, ListBox, Menu and TreeView behavior continues through the existing action executor.

## Frozen v1.3 compatibility boundary

The previous native contract remains frozen and intentionally fails closed for Slider:

- Native GUI IR **1.2**
- sealed payload **v12**
- native runtime **v1.3**
- TreeView-capable Windows / AppKit / GTK surface

A Slider source explicitly targeted at payload v12/runtime v1.3 is rejected. Patch does not silently omit the control and does not reinterpret v1.3 as Slider-capable. This frozen failure is retained as compatibility evidence while current Ready/offline builds use v13/v1.4.

## Assurance boundary

Slider Stage 1 and native runtime v1.4 are product/editor/runtime work after the beta.32 research milestone. They do not widen the beta.32 invocation-frame/direct-Wasm correspondence claim.

The relevant invariants remain:

1. persistent mutation stays explicit through `change`;
2. UI/toolkit selection is transient unless source commits it;
3. unsupported older native contracts fail closed;
4. native payload/runtime contracts are versioned rather than redefined in place;
5. the formal runtime-correspondence assurance boundary remains beta.32.