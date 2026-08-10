# Patch ComboBox

Status: **language, Studio and Standalone Window Web support implemented; direct native GUI parity follows separately**

Patch keeps ComboBox syntax small and uses the same explicit-persistence rule as Input and Checkbox controls.

```patch
create text size = "Medium"

window "Combo demo" as main size 480, 240:
  combo "Small", "Medium", "Large" as size at 24, 72 size 220, 36
  text "Selected: {size}" at 24, 124 size 260, 30

when size changed:
  change size:
    set = value
```

## Semantics

A ComboBox selection produces a transient event-local text value named `value` inside `when ... changed:`.

Selecting an item does **not** silently mutate persistent Patch state. To persist the selection, source code must use an ordinary semantic `change`, such as `set = value`. That change is recorded in the normal Patch history and remains visible to Change Contract analysis.

This is the same model used by existing semantic GUI inputs:

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox `changed` exposes transient text `value`.

## Option expressions

ComboBox options are source-backed expressions separated by commas:

```patch
combo "Small", "Medium", "Large" as size
```

At least two options are required. The compiler preserves the option expressions in Window IR, while the runtime evaluates them for display.

## Designer

Patch Studio can create ComboBox controls from the Toolbox. The source-backed inspector can edit:

- control id;
- option expressions;
- X/Y position;
- width/height.

All edits rewrite `main.patch`; there is no hidden form database.

## Standalone Web

Standalone Window Web runtime v0.6 renders ComboBox as a browser `<select>` and dispatches the selected option as a text `value` through the same semantic Window event path.

## Native boundary

Native GUI IR v0.1 intentionally does not accept ComboBox yet. A native Windows/macOS/Linux build containing ComboBox fails closed instead of silently omitting the control or switching back to Electron.

The next native milestone will add ComboBox once to Native GUI IR, then lower the same contract to:

- Win32 ComboBox;
- AppKit `NSPopUpButton`;
- GTK3 ComboBox;
- the three sealed native runtimes used by token-free Patch Studio downloads.

That native extension is kept separate so the platform-neutral semantics can be validated before changing the sealed binary payload contract.
