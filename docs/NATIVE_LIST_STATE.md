# Native list state and multi-select ListBox

Patch Native GUI IR 1.1 adds persistent text-list state and native multi-select ListBox semantics without changing the existing text-backed ListBox contract.

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

The toolkit selection is transient UI state. Persistent Patch state changes only because the handler performs the explicit semantic `change fruits: set = value`.

## Native GUI IR 1.1

Native GUI IR 1.1 extends the existing versioned GUI stack with:

- state type `list`, represented as a list of text values;
- `selectionMode: multiple` only on list-backed ListBox controls;
- `changed` event value type `text-list` for those controls;
- explicit list-state `set`, `add`, `remove` and `clear` actions;
- `set = value` as the typed bridge from a transient `text-list` event into persistent list state.

Text-backed ListBox remains single-select and continues to expose transient `text`. Table row selection remains its independent existing `text-list` event contract. A project may contain both Table and multi-select ListBox without one event adapter reinterpreting the other.

Native GUI IR 1.1 preserves the earlier version layers rather than redefining them:

- Native GUI IR 0.7: stable base controls;
- Native GUI IR 0.8: Table extension;
- Native GUI IR 0.9: Menu separators and shortcuts;
- Native GUI IR 1.0: source-backed MenuItem enabled/checked state;
- Native GUI IR 1.1: persistent text-list state and list-backed multi-select ListBox.

## Direct AOT backend 1.2

The normal native build commands automatically select backend 1.2 when list state is present.

### Windows

List state is represented as `std::vector<std::wstring>`. A list-backed ListBox uses `LBS_EXTENDEDSEL`; selection is read with `LB_GETSELCOUNT` / `LB_GETSELITEMS` and projected back with `LB_SETSEL`.

### macOS

List state is represented as `NSArray<NSString *>`. The AppKit `NSTableView` ListBox enables multiple selection, reads `selectedRowIndexes` and reselects every value present in persistent Patch list state.

### Linux

List state is represented as `std::vector<std::string>`. GTK3 uses `GTK_SELECTION_MULTIPLE`, the `selected-rows-changed` signal and `gtk_list_box_get_selected_rows`.

The dedicated Native ListBox v1.2 CI matrix compiles and executes the same multi-select application on Windows/MSVC, macOS/AppKit and Linux/GTK3. Its smoke selects more than one row, dispatches the real native changed-event path and verifies that the explicit `set = value` operation receives the selected text list.

## Ready apps and offline `patch link`

Windows, macOS and Linux now use the same current sealed Window contract for token-free Ready apps and offline linking:

- Native GUI IR **1.1**;
- sealed payload **v10**;
- native runtime **v1.1**.

This contract is used by:

- Patch Studio **Ready app download (no token)**;
- the downloadable offline compiler;
- ordinary local `patch link` Window builds.

Payload v10 stores text-list state as a typed list. It does not hide list state inside a text scalar. Runtime v1.1 preserves source action ordering when list changes are mixed with scalar changes, Forms or dialogs, then projects the resulting persistent Patch list back into the native multi-select control.

The previous payload **v9** / runtime **v1.0** Table-capable line remains frozen as a reproducible compatibility contract. Runtime v1.1 was added instead of redefining v1.0 in place.

## Supported native list operations

The 1.1 contract keeps these persistent mutations explicit:

```patch
change fruits:
  set = ["Apple", "Mango"]
  add "Cherry"
  remove "Apple"
  clear
```

`add` appends one value. `remove` removes the first matching value and follows normal Patch runtime error behavior when the value is absent. `set` replaces the list and `clear` empties it. `set = value` is additionally supported inside a `text-list` event such as a list-backed ListBox `changed` handler.

Initial native list state and literal list `set` values currently require literal lists of quoted text. Native GUI 1.1 deliberately rejects interpolating a list directly into a Form/control label; applications should derive a scalar display state instead.

## Runtime integrity

Patch Studio Pages deploys the runtime-v1.1 assets only when the Windows, macOS and Linux releases all exist. The deployment reads the SHA-256 digest recorded by GitHub for each exact release asset, hashes the downloaded file independently, and writes the verified result into `runtime-manifest.json`.

The browser verifies the selected runtime bytes again with Web Crypto before token-free sealing. This is byte-integrity validation of the published runtime path. It is not Windows Authenticode, Apple Developer ID signing or notarization.

## Current fail-closed boundaries

Sealed payload v10 does not yet encode the newer direct-AOT Menu decorators:

- Menu separators;
- portable shortcuts;
- source-backed MenuItem `enabled` state;
- source-backed MenuItem `checked` state.

A Ready/offline application that needs those sealed Menu features must fail closed rather than silently lose them. Direct AOT already supports the Menu features.

FreeBSD Window/GUI remains unsupported. FreeBSD Console continues through the portable C99/offline path.

## Regression evidence

The repository keeps the runtime lines separate:

- payload v9 / runtime v1.0 compatibility tests and Windows/macOS/Linux smokes;
- payload v10 / runtime v1.1 contract tests plus Windows/macOS/Linux multi-select, Table and ordinary offline-link smokes;
- direct backend 1.2 Windows/AppKit/GTK compile-and-run smokes;
- Patch Studio site and runtime-integrity surface tests.

The separation is intentional: new functionality advances through a versioned contract rather than changing the meaning of previously published binaries.
