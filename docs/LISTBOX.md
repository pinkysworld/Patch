# Patch ListBox

Status: **implemented across Patch Studio, Standalone Window Web, direct native Win32/AppKit/GTK and current token-free Ready/offline Windows, macOS and Linux paths**

Patch ListBox has two source-backed selection contracts determined by the state type behind its id:

- a `create text` id keeps the original single-selection text contract;
- a `create list` id enables multi-selection and exposes a transient text-list value.

Persistent application state changes only through explicit semantic `change` operations in both modes.

## Single-selection text state

```patch
create text fruit = "Banana"

window "ListBox demo" as main size 480, 300:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruit at 24, 72 size 220, 120
  text "Selected: {fruit}" at 24, 212 size 260, 30

when fruit changed:
  change fruit:
    set = value
```

Selecting one item exposes transient event-local text `value`. Selection itself does not silently assign `fruit`; persistence occurs only because the handler executes `change fruit`.

## Multi-selection list state

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit picker" as main size 560, 340:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits at 24, 72 size 280, 150

when fruits changed:
  change fruits:
    set = value
```

A list-backed ListBox exposes the selected display strings as transient text-list `value`. `set = value` is the explicit typed bridge from that event-local list into persistent Patch list state.

The persistent list can also be changed explicitly with normal list operations such as `set`, `add`, `remove` and `clear`. Toolkit selection remains transient UI state.

## Options and layout

ListBox options are source-backed expressions separated by commas. At least two options are required.

A top-level ListBox may use source-backed `at x, y size width, height` geometry. The default Designer geometry is 220 by 120 so multiple choices remain visible without opening a dropdown.

Inside a Tabs page, ListBox uses Tabs flow layout and therefore does not carry its own `at/size` geometry. Patch Studio can add or remove nested ListBox controls through the source-backed Tabs Properties editor.

## Patch Studio Designer

Patch Studio exposes **+ ListBox** in the Toolbox. The source-backed inspector can edit the control id, option expressions and top-level geometry.

List-backed multi-selection is rendered directly in Studio App Preview. Transient browser selection is kept separate from persistent Patch list state, so a re-render does not invent an implicit semantic mutation.

## Standalone Window Web and compatibility desktop

Standalone Window Web renders text-backed ListBox as a single-select multi-row HTML `<select>` and list-backed ListBox as `<select multiple>`. The shared Window event adapter dispatches text or text-list `value` according to the backing state type.

The explicitly labelled compatibility desktop renderer also supports ListBox. Compatibility payload/runtime versions remain separate legacy contracts and are not the current direct-native Ready/offline path.

## Direct native support

Native GUI IR **1.1** introduced persistent text-list state and native multi-select ListBox semantics while preserving the existing text-backed single-select contract. Native GUI IR **1.3** is the current additive IR line and retains that ABI unchanged while composing later TreeView and Slider extensions.

The native mappings are:

- **Windows:** Win32 ListBox, with `LBS_EXTENDEDSEL` for list-backed multi-selection and selection readback through the native ListBox API;
- **macOS:** AppKit `NSTableView`, with multiple selection enabled for list-backed controls;
- **Linux:** GTK3 multi-selection list handling with `GTK_SELECTION_MULTIPLE` for list-backed controls.

The dedicated Native ListBox CI matrix keeps Win32/MSVC, AppKit and GTK evidence for this contract. Unsupported legacy payload/IR combinations fail closed rather than silently degrading a multi-select control.

## Current Ready/offline contract

The original list-state sealed compatibility line was:

- Native GUI IR **1.1**;
- sealed payload **v10**;
- native runtime **v1.1**.

That line remains frozen for compatibility testing. It is not the current consumer contract.

Current Windows, macOS and Linux Ready/offline Window builds use:

- Native GUI IR **1.3**;
- sealed payload **v13**;
- native runtime **v1.4**.

Payload v13 preserves Table, persistent list/ListBox, Menu and TreeView semantics while adding Slider metadata. The Patch Studio no-token Ready path and ordinary offline `patch link` therefore preserve the same ListBox semantics on the current desktop line.

The relevant additive progression is:

```text
Native GUI IR 0.8   Table
Native GUI IR 1.0   Menu enabled/checked state
Native GUI IR 1.1   persistent text-list state + multi-select ListBox
Native GUI IR 1.2   hierarchical TreeView, preserving the 1.1 list ABI
Native GUI IR 1.3   Slider, preserving the 1.1 list ABI

payload v9  / runtime v1.0   frozen Table line
payload v10 / runtime v1.1   frozen list-state/multi-select line
payload v11 / runtime v1.2   frozen Menu+list line
payload v12 / runtime v1.3   frozen TreeView-capable line
payload v13 / runtime v1.4   current Slider-capable line preserving ListBox semantics
```

Older payloads are not reinterpreted in place. Explicit legacy linking fails closed when a requested control/state contract is newer than the selected payload.

## Runtime integrity and distribution boundary

Patch Studio verifies the current Windows/macOS/Linux runtime-v1.4 templates against the deployment runtime manifest before browser-side sealing. The manifest is derived from GitHub Release asset digests and the browser re-hashes the selected bytes with Web Crypto.

This protects byte consistency of the published Ready runtime path. It is not Authenticode, Developer ID signing or notarization.

The downloadable offline compiler separately builds/embeds runtime v1.4 and smoke-tests ListBox together with responsive Window, Table, Menu, TreeView and Slider applications on supported desktop hosts. FreeBSD remains Console-only.

## Regression evidence

Current regression coverage includes:

- text-backed single-selection ListBox behavior;
- list-backed browser multi-selection and transient text-list events;
- explicit `change ... set = value` persistence;
- Native GUI IR 1.1 list-state compatibility tests;
- current Native GUI IR 1.3 preservation of that ABI;
- direct Win32/AppKit/GTK compile-and-run smokes;
- frozen payload v10/runtime v1.1 list-state compatibility;
- frozen payload v11/runtime v1.2 Menu+list compatibility;
- frozen payload v12/runtime v1.3 TreeView compatibility;
- current payload v13/runtime v1.4 Windows/macOS/Linux seal/link/run smokes;
- offline compiler ListBox linking/smokes;
- Patch Studio public-site and runtime-integrity checks.

See `docs/NATIVE_LIST_STATE.md` for the detailed native list-state ABI and compatibility history.
