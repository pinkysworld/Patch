# Native list state and multi-select ListBox

Native GUI IR **1.1** introduced persistent text-list state and native multi-select ListBox semantics without changing the existing text-backed ListBox contract. That ABI remains part of the current Native GUI IR **1.2** / sealed payload **v12** / runtime **v1.3** desktop line.

This document describes the list-state extension itself and distinguishes its original compatibility versions from the current Ready/offline consumer contract.

## Source contract

A text-backed ListBox remains single-select:

```patch
create text fruit = "Banana"

window "Fruit":
  listbox "Apple", "Banana", "Cherry" as fruit

when fruit changed:
  change fruit:
    set = value
```

A ListBox whose id is backed by `create list` is multi-select:

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit picker" as main size 560, 340:
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits at 24, 72 size 280, 150

when fruits changed:
  change fruits:
    set = value
```

Toolkit selection is transient UI state. Persistent Patch state changes only because the handler performs the explicit semantic `change fruits: set = value`.

## Native GUI IR 1.1 list-state extension

Native GUI IR 1.1 added:

- state type `list`, represented as a list of text values;
- `selectionMode: multiple` only on list-backed ListBox controls;
- `changed` event value type `text-list` for those controls;
- explicit list-state `set`, `add`, `remove` and `clear` actions;
- `set = value` as the typed bridge from a transient `text-list` event into persistent list state.

Text-backed ListBox remains single-select and exposes transient text. Table row selection remains its independent `text-list` event contract. A project may contain both Table and multi-select ListBox without one event adapter reinterpreting the other.

The additive Native GUI IR history is:

- Native GUI IR 0.7: base controls;
- Native GUI IR 0.8: Table extension;
- Native GUI IR 0.9: Menu separators and shortcuts;
- Native GUI IR 1.0: source-backed MenuItem enabled/checked state;
- Native GUI IR 1.1: persistent text-list state and list-backed multi-select ListBox;
- Native GUI IR 1.2: current hierarchical TreeView extension, preserving the 1.1 list-state ABI.

## Direct native backend

The native backend line maps list state without converting it to an opaque string.

### Windows

List state is represented as `std::vector<std::wstring>`. A list-backed ListBox uses `LBS_EXTENDEDSEL`; selection is read with `LB_GETSELCOUNT` / `LB_GETSELITEMS` and projected back with `LB_SETSEL`.

### macOS

List state is represented as `NSArray<NSString *>`. The AppKit `NSTableView` ListBox enables multiple selection, reads `selectedRowIndexes` and reselects every value present in persistent Patch list state.

### Linux

List state is represented as `std::vector<std::string>`. GTK3 uses `GTK_SELECTION_MULTIPLE`, the `selected-rows-changed` signal and `gtk_list_box_get_selected_rows`.

The dedicated Native ListBox v1.2 CI matrix retains direct Windows/MSVC, macOS/AppKit and Linux/GTK evidence for the list-state feature. Later TreeView/runtime layers are additive and preserve this behavior.

## Ready apps and offline `patch link`

The original list-state sealed compatibility line was:

- Native GUI IR **1.1**;
- sealed payload **v10**;
- native runtime **v1.1**.

That v10/v1.1 line remains frozen and independently tested. It is no longer the current Ready/offline consumer version.

Current Windows, macOS and Linux Ready/offline Window builds use:

- Native GUI IR **1.2**;
- sealed payload **v12**;
- native runtime **v1.3**.

Payload v12 preserves typed list state, multi-select ListBox events and list mutations while also carrying the later Menu and TreeView contracts. Patch Studio Ready app download, the downloadable offline compiler and ordinary local `patch link` therefore all preserve the same list-state semantics through the current v12/v1.3 line.

The version progression is deliberately additive:

- payload v9/runtime v1.0: frozen Table line;
- payload v10/runtime v1.1: frozen persistent-list/multi-select line;
- payload v11/runtime v1.2: frozen Menu+list line;
- payload v12/runtime v1.3: current TreeView-capable line preserving Table, Menu and list semantics.

## Supported native list operations

The persistent mutations remain explicit:

```patch
change fruits:
  set = ["Apple", "Mango"]
  add "Cherry"
  remove "Apple"
  clear
```

`add` appends one value. `remove` removes the first matching value and follows normal Patch runtime error behavior when the value is absent. `set` replaces the list and `clear` empties it. `set = value` is supported inside a `text-list` event such as a list-backed ListBox `changed` handler.

Initial native list state and literal list `set` values use literal lists of quoted text in the current supported contract. Applications should derive scalar display state rather than interpolating an entire list directly into a Form/control label.

## Runtime integrity

Patch Studio Pages now gates the current runtime-v1.3 assets. Deployment requires:

- `native-win32-runtime-v1.3`;
- `native-macos-runtime-v1.3`;
- `native-linux-runtime-v1.3`;
- the compatibility/Console `studio-runtime-v0.6` release.

Pages reads the GitHub-recorded SHA-256 digest for every exact runtime asset, independently hashes the downloaded bytes and writes the verified result into `runtime-manifest.json`. The browser verifies the selected runtime again with Web Crypto before token-free sealing.

This is byte-integrity validation of the published runtime path. It is not Windows Authenticode, Apple Developer ID signing or notarization.

## Current fail-closed boundaries

The obsolete v10 limitation on advanced Menu decoration is retained only as a compatibility property of payload v10. Current payload v12/runtime v1.3 supports the later Menu separators, portable shortcuts and source-backed `enabled`/`checked` state inherited from payload v11/runtime v1.2, plus hierarchical TreeView.

An application explicitly linked against a legacy payload fails closed when it requests features newer than that payload. FreeBSD Window/GUI remains unsupported; FreeBSD Console continues through the portable C99/offline path.

## Regression evidence

The repository keeps runtime generations separate:

- payload v9/runtime v1.0 compatibility tests and desktop smokes;
- payload v10/runtime v1.1 list-state compatibility tests;
- payload v11/runtime v1.2 Menu+list compatibility tests;
- payload v12/runtime v1.3 TreeView-capable Windows/macOS/Linux seal/link/run smokes;
- direct native ListBox compile-and-run smokes;
- downloadable offline-compiler responsive/Table/ListBox/Menu/TreeView smokes;
- Patch Studio site and runtime-integrity surface tests.

The separation is intentional: new functionality advances through a versioned contract rather than changing the meaning of previously published binaries.
