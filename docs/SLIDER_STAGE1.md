# Slider Stage 1

Slider Stage 1 adds a source-backed numeric range control to Patch Window applications without changing Change IR 0.10 or redefining the existing native GUI v1.3 contract.

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

Its event-local `value` is a finite **number inside the declared Slider range**. The shared Window event adapter fails closed on non-numeric, non-finite or out-of-range host values. The UI control does not persist that number by itself. Persistent application state changes only when Patch source executes an ordinary semantic `change`.

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

## Compiler and IR

Slider lowers as the existing `UI_CONTROL` Change IR instruction with additional UI metadata:

- `control: "slider"`
- `id`
- `min`
- `max`
- `step`

The compiler advertises runtime capability `ui.slider`.

Change IR remains **0.10** because the Slider does not add a new persistent mutation mechanism or alter semantic Change operations. Its range and geometry are UI structure.

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

The Designer always rewrites visible `.patch` source. There is no hidden slider configuration document or second persistent UI model.

## Standalone Window Web

Standalone Window Web supports Slider Stage 1.

The generated single-file HTML app restores Slider metadata from the compiled AST, renders an accessible `<input type="range">`, exposes a live display value and validates that Slider `changed` receives a finite in-range number before executing Patch handlers.

The standalone metadata advertises:

- `sliderStage: 1`
- `sliderMode: "transient-number"`

## Native boundary

Slider Stage 1 is deliberately **not** part of the current native Ready/offline contract.

The current native line remains:

- Native GUI IR **1.2**
- sealed payload **v12**
- native runtime **v1.3**
- Windows / AppKit / GTK TreeView-capable surface

A Slider source presented to a Window target that has not explicitly enabled Slider support fails closed during Window validation. Patch does not silently drop the control and does not fall back to Electron.

Native Slider parity therefore requires a future versioned Native GUI IR/backend/payload/runtime contract plus platform smoke execution before native support can be claimed.

## Assurance boundary

Slider Stage 1 is product/editor/runtime work after the beta.32 research milestone. It does not widen the beta.32 invocation-frame/direct-Wasm correspondence claim.

The relevant invariants remain:

1. persistent mutation stays explicit through `change`;
2. UI/toolkit selection is transient unless source commits it;
3. unsupported native controls fail closed;
4. native payload/runtime contracts are versioned rather than redefined in place.
