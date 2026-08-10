# Patch ComboBox

Status: **language, Studio, Standalone Window Web, compatibility desktop and direct native GUI support implemented**

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

Selecting an item does **not** silently mutate persistent Patch state. To persist the selection, source code must use an ordinary semantic `change`, such as `set = value`. That change is recorded in normal Patch history and remains visible to Change Contract analysis.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox `changed` exposes transient text `value`.

## Option expressions

ComboBox options are source-backed expressions separated by commas:

```patch
combo "Small", "Medium", "Large" as size
```

At least two options are required. Window IR preserves the option expressions. Native GUI IR v0.2 currently requires each native option to be a quoted text literal and stores the evaluated strings in the platform-neutral control record.

## Designer

Patch Studio can create ComboBox controls from the Toolbox. The source-backed inspector can edit control id, option expressions and X/Y/width/height. All edits rewrite `main.patch`; there is no hidden form database.

## Standalone Web and compatibility desktop

Standalone Window Web runtime v0.7 renders ComboBox as a browser `<select>` and dispatches the selected option as text `value` through the shared semantic Window event path.

Compatibility desktop runtime template `studio-runtime-v0.5` also renders ComboBox. v0.5 closes an older renderer gap where shared Window validation could accept ComboBox while the compatibility player omitted it.

## Native GUI v0.2

Native GUI IR v0.2 carries ComboBox options, the text-state binding, geometry and the text-valued `changed` event once. The same contract is lowered to:

- Windows Win32 `COMBOBOX` with `CBS_DROPDOWNLIST` and `CBN_SELCHANGE`;
- macOS AppKit `NSPopUpButton`;
- Linux GTK3 `GtkComboBoxText`;
- the three sealed native runtimes used by token-free Patch Studio downloads.

The sealed native payload is version 2. Each control record carries an option count followed by UTF-8 option strings. Windows, macOS and Linux runtime templates reject malformed ComboBox payloads before creating UI.

## Native execution evidence

The native runtime workflows compile the real platform runtime and smoke both the existing Forms lifecycle example and `examples/combo-window.patch`. The ComboBox smoke selects the final option through the native widget, dispatches the native changed event, and verifies that the explicit Patch `change` persisted that text value.

This preserves the important semantic boundary: native widget state can be transient, while persistent Patch state changes only through source-visible mutation.
