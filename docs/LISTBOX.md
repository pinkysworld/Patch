# Patch ListBox

Status: **implemented across Patch Studio, Standalone Window Web, direct native Win32/AppKit/GTK and current token-free Ready/offline Windows, macOS and Linux paths**

Patch ListBox has two source-backed selection contracts determined by the state type behind its id:

- a `create text` id keeps the single-selection text contract;
- a `create list` id enables multi-selection and exposes a transient text-list value.

Persistent application state changes only through explicit semantic `change` operations in both modes.

## Single-selection text state

```patch
create text fruit = "Banana"

window "ListBox demo" as main size 480, 300:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruit at 24, 72 size 220, 120

when fruit changed:
  change fruit:
    set = value
```

Selecting one item exposes transient event-local text `value`. Selection itself does not silently assign persistent state.

## Multi-selection list state

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit picker" as main size 560, 340:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits at 24, 72 size 280, 150

when fruits changed:
  change fruits:
    set = value
```

A list-backed ListBox exposes selected display strings as transient text-list `value`. `set = value` is the explicit typed bridge into persistent Patch list state. Persistent lists also support normal `set`, `add`, `remove` and `clear` operations.

## Layout and Designer

ListBox options are source-backed expressions separated by commas and at least two options are required. A top-level ListBox may use `at x, y size width, height`; inside Tabs it uses Tabs flow layout.

Patch Studio exposes ListBox through the searchable Component Palette and Object Inspector. The inspector edits id, options and top-level geometry. List-backed multi-selection is rendered directly in App Preview while transient toolkit selection remains separate from persistent state.

## Standalone Web

Standalone Window Web renders text-backed ListBox as a single-select multi-row HTML `<select>` and list-backed ListBox as `<select multiple>`. The shared Window event adapter dispatches text or text-list `value` according to the backing state type.

## Direct native support

Native GUI IR **1.1** introduced persistent text-list state and native multi-select ListBox semantics. Current Native GUI IR **1.9** preserves that ABI while composing TreeView, Slider, Chrome Stage 1, Shape, PaintBox, Button/ImageList and application/Form icon capabilities.

Native mappings are:

- **Windows:** Win32 ListBox, with `LBS_EXTENDEDSEL` for list-backed multi-selection;
- **macOS:** AppKit `NSTableView`, with multiple selection for list-backed controls;
- **Linux:** GTK3 list selection with `GTK_SELECTION_MULTIPLE` for list-backed controls.

Unsupported legacy payload/IR combinations fail closed rather than silently degrading multi-select behavior.

## Current Ready/offline contract

The original list-state compatibility line remains:

- Native GUI IR **1.1**;
- sealed payload **v10**;
- native runtime **v1.1**.

Current Windows, macOS and Linux Ready/offline Window builds use:

- Native GUI IR **1.9**;
- sealed payload **v19**;
- native runtime **v1.10**.

Current Ready preserves Table, persistent list/ListBox, Menu, TreeView, Slider, Chrome Stage 1, Shape, PaintBox and PaintBox draw-image semantics while also carrying Button/ImageList image transport and application/Form icons. The Patch Studio no-token Ready path and ordinary offline `patch link` therefore preserve the same ListBox semantics.

For explicit compatibility, the Offline Compiler still supports Native GUI IR **1.7** / payload **v17** / runtime **v1.8** using the real runtime-v1.8 underlay rather than reinterpreting those bytes as a v1.10 runtime.

Relevant additive progression:

```text
Native GUI IR 0.8   Table
Native GUI IR 1.0   Menu enabled/checked state
Native GUI IR 1.1   persistent text-list state + multi-select ListBox
Native GUI IR 1.2   hierarchical TreeView, preserving the 1.1 list ABI
Native GUI IR 1.3   Slider, preserving the 1.1 list ABI
Native GUI IR 1.4   Chrome Stage 1, preserving ListBox/TreeView/Slider
Native GUI IR 1.5   Shape Stage 1, preserving ListBox/TreeView/Slider/Chrome
Native GUI IR 1.6   PaintBox Stage 1, preserving ListBox/TreeView/Slider/Chrome/Shape
Native GUI IR 1.7   PaintBox draw image
Native GUI IR 1.8   Button/ImageList image transport
Native GUI IR 1.9   application/Form icon transport over the complete earlier stack

payload v9  / runtime v1.0   frozen Table line
payload v10 / runtime v1.1   frozen list-state/multi-select line
payload v11 / runtime v1.2   frozen Menu+list line
payload v12 / runtime v1.3   frozen TreeView-capable line
payload v13 / runtime v1.4   previous Slider-capable line
payload v14 / runtime v1.5   previous Chrome line
payload v15 / runtime v1.6   previous Shape line
payload v16 / runtime v1.7   previous PaintBox line preserving ListBox semantics
payload v17 / runtime v1.8   explicit Offline Compiler compatibility line
payload v18 / runtime v1.9   Button/ImageList underlay
payload v19 / runtime v1.10  current Ready/offline line preserving ListBox semantics
```

Older payloads are not reinterpreted in place. Explicit legacy linking fails closed when a requested control/state contract is newer than the selected payload.

## Runtime integrity

Patch Studio verifies current Windows/macOS/Linux runtime-v1.10 templates against the deployment runtime manifest before browser-side sealing. The downloadable Offline Compiler defaults to payload v19/runtime v1.10 and separately carries a runtime-v1.8 underlay for explicit payload-v17 compatibility.

This protects version/byte consistency of the published Ready runtime path. It is not Authenticode, Developer ID signing or notarization.

See `docs/NATIVE_LIST_STATE.md` for the detailed list-state ABI and compatibility history.
