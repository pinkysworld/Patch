# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal remains QuickBASIC/Visual-Basic/Delphi-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.32

Patch Studio provides source editing/local autosave, Console and Window Run, a source-backed visual Designer, named Forms, drag/resize layout, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio controls, Tabs, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

For Windows, macOS and Linux the default desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required.

Change IR **0.10** and research beta **0.2.0-beta.32** remain unchanged by GUI product work.

## Source-backed Forms and controls

Form dimensions, top-level geometry, labels, ids, options, Tabs page structure and Menu structure remain in `.patch` source. There is no hidden `.dfm`, `.frm` or second persistent form document.

GUI interaction does not implicitly persist state. Input/ComboBox/ListBox/Radio expose transient text `value`; Checkbox exposes transient Boolean `value`; persistent state changes only through an explicit Patch `change`.

Tabs page selection remains transient renderer/toolkit state and creates no Patch variable or Change History entry.

## Menus and informational dialogs

Native GUI 0.6 adds structural menus and informational dialogs:

```patch
window "Menu demo" as main size 560, 320:
  menu "Help":
    item "About" as about_item
  text "Choose Help > About" at 24, 48 size 320, 30

when about_item clicked:
  dialog "About Patch", "Native menus and informational dialogs"
```

Menus are Window structure, not positioned Designer controls. MenuItem `clicked` carries no event value. Informational `dialog` has no result field and does not create hidden state or Change History.

## Direct native desktop path

The recommended native Window path uses checked **Native GUI IR 0.6**.

Current direct-native mappings include:

- Text/Button/Input/Checkbox on Win32, AppKit and GTK3;
- ComboBox as Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- ListBox as Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`;
- Radio as Win32 `BS_AUTORADIOBUTTON`, AppKit `NSButtonTypeRadio`, GTK3 `GtkRadioButton`;
- Tabs as Win32 `WC_TABCONTROLW`, AppKit `NSTabView`, GTK3 `GtkNotebook`;
- Menu as Win32 `HMENU`, AppKit `NSMenu`, GTK3 `GtkMenuBar`;
- informational dialog as Win32 `MessageBoxW`, AppKit `NSAlert`, GTK3 `GtkMessageDialog`;
- named Form open/close lifecycle;
- typed transient values and explicit semantic changes.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Token-free native downloads

Studio browser-side sealing uses sealed native payload **v6** and the following runtime release line:

- `native-win32-runtime-v0.6`
- `native-linux-runtime-v0.6`
- `native-macos-runtime-v0.6`

Payload v6 serializes Forms/state, ordinary controls, selection options, Tabs parent/page metadata, per-Form menus and informational dialog action kind 4.

Windows produces one native Win32 `.exe`. Linux produces a GTK3 executable ZIP. macOS produces an unsigned universal AppKit `.app` ZIP. The macOS output remains unsigned because browser-side sealing changes the executable after runtime-template publication.

## Explicit compatibility desktop path

The Electron compatibility route remains explicit and separate. Its compiled Window artifact remains **v0.2**, Ready payload **v0.4**, and runtime template **`studio-runtime-v0.6`**.

Native GUI 0.6 does not silently change compatibility semantics. Unsupported Menu/Dialog behavior in a non-native target must fail closed rather than disappear.

## PWA updates

The current beta.32 native Menu/Dialog cache key is `patch-studio-0.2-beta.32-forms7`. Large OS runtime assets remain on demand rather than part of the core offline cache.

## Beta.32 research boundary

The ordinary Studio does not need Lean or expose beta.32 proof machinery. Beta.32 remains the independent invocation-frame direct-Wasm correspondence layer over the supported finite safe-integer call-tree fragment.

The reproducible evidence set still includes `GeneratedRepeatedTransitiveRuntimeCertificate.lean`; native UI product work does not expand those assurance claims. Runtime capture, independent validator/frame reconstruction, parser/extractor correctness, JS-to-Wasm lowering and the Wasm engine remain explicit proof-free boundaries.

## Next work

The next product stages are:

1. result-bearing Confirm/Open/Save dialogs with explicit transient result events;
2. Menu separators, shortcuts and source-backed enabled/checked state;
3. Table/Grid;
4. ListBox multi-selection with an explicit list-valued event contract;
5. project tree/source files, alignment/docking, import/export and distribution polish.
