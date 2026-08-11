# Tabs

Patch Tabs are a nested Window UI container. Page selection is transient interface state rather than persistent Patch state.

## Syntax

```patch
window "Settings" as main size 620, 380:
  tabs as settings at 24, 24 size 540, 280:
    tab "General":
      text "General settings"
      input name

    tab "Advanced":
      checkbox "Notifications" as notifications
```

A `tabs` block needs a Patch id and at least two `tab` pages. The Tabs container can use the same source-backed `at x, y size width, height` geometry as other top-level Window controls.

Controls inside a tab page use flow layout. Their event ids remain ordinary Patch control ids, so a nested Input, Checkbox, Button, ComboBox or ListBox uses the normal `when ...` handlers.

## Mutation semantics

Selecting a page does not create or modify Patch state and does not create a Change History entry. The selected page lives only in the active UI renderer or native toolkit.

Persistent application state still changes only through explicit semantic `change` blocks. For example:

```patch
when name changed:
  change name:
    set = value
```

Tabs itself does not expose `when settings changed:`. A future page-selection event would need a separate semantic contract rather than silently turning UI navigation into persistent mutation.

## Runtime support

Tabs is implemented in:

- Patch Studio Run preview;
- source-backed Patch Studio Designer for Tabs container id and geometry;
- Standalone Window Web runtime 0.8;
- explicit Electron compatibility desktop renderer;
- Native GUI IR 0.4;
- direct native Win32 AOT;
- direct native AppKit AOT;
- direct native GTK3 AOT;
- token-free sealed Win32, AppKit and GTK3 runtime payload v4.

## Native mappings

Native GUI IR 0.4 preserves the real page hierarchy. Backends use implementation-only `parentTabIndex` and `pageIndex` metadata when a flat native handle table is useful, but selected-page state is never added to Patch state or serialized in the sealed payload.

Platform mappings are:

- **Windows:** `WC_TABCONTROLW`, page titles inserted with `TCM_INSERTITEMW`, page changes observed through `TCN_SELCHANGE`;
- **macOS:** `NSTabView` containing `NSTabViewItem` page views;
- **Linux:** `GtkNotebook` containing a native page view for each Patch page.

Nested controls stay real controls in all three implementations and preserve their normal event semantics. CI native smoke tests exercise nested state-changing controls and actual native page switching.

## Sealed runtime contract

Payload v4 uses native control kind `7` for Tabs. The Tabs control stores its page-title vector. Nested controls carry parent-tab and page indices so the tiny native runtime can reconstruct the hierarchy. The payload deliberately contains no selected-page value.

The corresponding token-free runtime releases are:

- `native-win32-runtime-v0.4`;
- `native-macos-runtime-v0.4`;
- `native-linux-runtime-v0.4`.

## Current limitations

- at least two pages are required;
- only ordinary Window controls may appear directly inside a tab page;
- page controls use flow layout rather than individual source `at/size` geometry;
- Tabs cannot currently be nested inside Tabs;
- page selection has no Patch event;
- macOS token-free sealed applications remain unsigned;
- Linux native distribution still depends on normal GTK3/system libraries.
