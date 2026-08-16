# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal remains QuickBASIC/Visual-Basic/Delphi-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.35

Patch Studio provides source editing and local autosave, Console and Window Run, a source-backed visual Designer, named Forms, direct Form and control drag/resize layout, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio/Table controls, Tabs, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

The public website is split into focused **Studio**, **Language**, **Documentation**, **Downloads** and **Help** pages. The default Windows/macOS/Linux desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required. Optional local/cloud AOT remains separate.

Patch package **0.2.0-beta.35** keeps Change IR **0.10**. The beta.32 invocation-frame assurance result remains the current formal runtime-correspondence milestone. Later product/runtime work does not widen that formal claim.

## One canonical Studio state

The canonical browser project is the version-2 `patch-studio-project` bundle. Programmatic sample/Designer mutations and normal typing use the same DOM `input`/`change` signals, so source, recovery, Designer, Change Contract and the native-build panel observe one project state.

`web/studio-dom-sync.js` emits only missing shared signals after programmatic Studio actions. The unversioned `patchStudio.project` entry remains a compatibility mirror rather than the authoritative project state.

## Source-backed Forms and controls

Form dimensions, top-level geometry, labels, ids, options, Table rows, Tabs page structure and Menu structure remain in `.patch` source. There is no hidden `.dfm`, `.frm` or second persistent form document.

A selected control can be moved/resized visually. A Form has a lower-right resize grip. Pointer and keyboard changes rewrite the visible Patch source. Forms may grow beyond the visible Designer width; the Designer remains scrollable instead of clamping the form.

GUI interaction does not implicitly persist state. Input/ComboBox/Radio and text-backed ListBox expose transient text `value`; Checkbox exposes transient Boolean `value`; list-backed ListBox exposes transient text-list `value`; Table `changed` exposes a transient row list. Persistent state changes only through explicit Patch `change`.

Tabs page selection remains transient renderer/toolkit state and creates no Patch variable or Change History entry.

## ListBox multi-selection

The state type behind a ListBox id determines its interaction contract.

Text-backed stays single-select:

```patch
create text fruit = "Banana"

window "Fruit":
  listbox "Apple", "Banana", "Cherry" as fruit
```

List-backed becomes multi-select:

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit Picker":
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits

when fruits changed:
  change fruits:
    set = value
```

The event-local `value` is a copied list of selected strings. UI selection is transient until source performs an explicit semantic `change`.

Current parity is implemented in:

- Studio App Preview;
- Standalone Window Web;
- direct Win32/AppKit/GTK AOT through Native GUI IR **1.1** / backend **1.2**;
- token-free Ready Windows/macOS/Linux through payload **v10** / runtime **v1.1**;
- ordinary offline `patch link` on Windows/macOS/Linux through the same v10/v1.1 contract.

### Historical beta.35 boundary

At the initial beta.35 browser milestone, **Native GUI IR 0.7 currently supports number, text and boolean persistent state** and native list state was intentionally fail-closed. That original boundary is preserved as historical evidence, but native parity has since been completed through the additive IR 1.1/backend 1.2 and payload v10/runtime v1.1 contracts. Older formats were not redefined in place.

## Table / Grid

Table remains source-backed:

```patch
window "People" as main size 520, 320:
  # @layout anchor left right top
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  show value
```

Current Table support:

- Designer: add/select/move/resize/rename/remove while preserving rows;
- Standalone Web and Studio App Preview: transient list-valued selected row;
- direct native AOT: Native GUI IR **0.8** / backend **0.9** with real Win32/AppKit/GTK widgets;
- current Ready/offline: Table metadata is preserved inside payload **v10** / runtime **v1.1**;
- frozen previous Table line: payload **v9** / runtime **v1.0**.

Table selection remains transient and does not create persistent list state by itself.

## Project format v2

Patch Studio bundles use `patch-studio-project` **version 2** and store:

- project name;
- Console/Window kind;
- `main.patch` source;
- selected build target;
- selected native build mode.

Version 1 remains readable and migrates explicitly to v2. Unknown future project versions are rejected rather than guessed. Recovery snapshots normalize imported legacy projects before restore.

## Project Outline

The source workspace includes a source-backed Project Outline. It groups top-level Forms, State, Events and Recipes from the last successfully parsed `main.patch`. Clicking an entry navigates to the exact source line; Form navigation also activates the Designer. Invalid intermediate source keeps the last good outline visible rather than inventing a second persistent project model.

This is a navigation-first precursor to true separate source files/forms. `main.patch` remains the only authoritative source file in project bundle v2.

## Recovery and diagnostics

Recovery keeps deduplicated local snapshots and supports Snapshot now, Restore, Export, Delete and Clear all.

`Copy diagnostics` and `.patchreport` create local privacy-redacted support bundles. They include version, target, source size/hash, compiler state, browser/PWA state and bounded recent errors but omit project source. No diagnostics upload path exists in Studio.

## Menus and dialogs

The base native GUI surface includes structural menus, informational dialogs and result-bearing Confirm/Open/Save flows. Direct AOT has progressed beyond that base:

- Native GUI IR **0.9** / backend **1.0** adds Menu separators and portable shortcuts;
- Native GUI IR **1.0** / backend **1.1** adds source-backed Boolean enabled/checked MenuItem state;
- Native GUI IR **1.1** / backend **1.2** adds persistent text-list state and multi-select ListBox.

Current sealed payload v10/runtime v1.1 preserves the base Menu/dialog behavior but intentionally remains fail-closed for the advanced separator/shortcut/state combination. Extending that sealed contract is a separate backlog item rather than silently discarding Menu properties.

## Direct native desktop path

The direct-native stack is additive:

```text
Native GUI IR 0.7 -> backend 0.8  base controls/accessibility/responsive layout
Native GUI IR 0.8 -> backend 0.9  Table
Native GUI IR 0.9 -> backend 1.0  Menu separators/shortcuts
Native GUI IR 1.0 -> backend 1.1  Menu enabled/checked state
Native GUI IR 1.1 -> backend 1.2  persistent list state + multi-select ListBox
```

Current native mappings include:

- Text/Button/Input/Checkbox on Win32, AppKit and GTK3;
- ComboBox as Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- text-backed and list-backed ListBox using each platform's native list/table control;
- Radio as Win32 `BS_AUTORADIOBUTTON`, AppKit radio `NSButton`, GTK3 `GtkRadioButton`;
- Tabs as Win32 `WC_TABCONTROLW`, AppKit `NSTabView`, GTK3 `GtkNotebook`;
- Table as Win32 `WC_LISTVIEWW`, AppKit multi-column `NSTableView`, GTK3 `GtkTreeView`/`GtkListStore`;
- Menu as Win32 `HMENU`, AppKit `NSMenu`, GTK3 `GtkMenuBar`;
- native dialogs and named Form lifecycle.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Token-free Ready runtime

Current Windows, Linux and macOS Ready Window downloads lower Native GUI IR **1.1** in the browser and seal payload **v10** into native runtime **v1.1**.

The current platform release tags are:

- `native-win32-runtime-v1.1`;
- `native-macos-runtime-v1.1`;
- `native-linux-runtime-v1.1`.

Payload v10 preserves Table and responsive metadata while adding persistent list state. Payload **v9** / runtime **v1.0** remains the frozen previous Table-capable compatibility line; payload v8/runtime v0.9 and v7/runtime v0.8 remain older frozen lines.

## Native build resilience and runtime integrity

The optional cloud/AOT path supports explicit Cancel, timeout and Retry. Retry uses the original in-memory build snapshot instead of silently rebuilding changed editor contents.

The token-free Ready path is the default. The **Beta.34 runtime-template integrity** mechanism continues to protect current v1.1 assets:

1. Pages requires `studio-runtime-v0.6` plus all three native runtime-v1.1 releases.
2. It downloads the exact browser-consumed runtime assets.
3. It reads the SHA-256 digest recorded by GitHub Release.
4. `scripts/runtime-integrity-manifest.js` independently hashes the downloaded file and rejects mismatch.
5. Pages publishes `runtimes/runtime-manifest.json`.
6. `web/runtime-integrity.js` hashes the selected runtime again with Web Crypto before `native-build.js` may use it.

A missing entry or mismatch stops packaging. This is byte-integrity validation inside the existing release/deployment trust path, not Authenticode or Developer ID/notarization.

The Pages deployment uses the canonical current site gate before artifact upload/deploy, so frozen historical validators cannot block a newer product beta while remaining independently testable in CI.

## PWA updates

Patch Studio derives a deterministic content revision from browser-facing pages/assets/compiler/runtime modules. Generated CSS, JavaScript, manifest and icon references carry that revision; the Service Worker uses it as the active cache identity.

Same-origin `/runtimes/` requests are fresh-first online. Successfully fetched bytes remain available only as offline fallback. The browser bundle includes the full Native GUI IR dependency chain required by the current builder: v0.8 -> v0.9 -> v1.0 -> v1.1.

## Beta.32 research boundary

The ordinary Studio does not need Lean or expose beta.32 proof machinery. Beta.32 remains the independent invocation-frame direct-Wasm correspondence layer over the supported finite safe-integer call-tree fragment.

The reproducible evidence set includes `GeneratedRepeatedTransitiveRuntimeCertificate.lean`. Product/UI/runtime work after beta.32 does not expand those assurance claims. Runtime capture, validator/frame reconstruction, remaining parser/extractor correctness, JS-to-Wasm lowering and the Wasm engine remain explicit proof-free boundaries.

## Production-readiness additions

The current Studio/repository includes:

- stable `PATCHxxxx` diagnostics with line/column locations;
- versioned CLI JSON results while preserving exit codes;
- deterministic release manifests and checksum verification;
- SHA-256 verification for every browser-consumed Ready runtime template;
- CodeQL and repository security-policy checks;
- deterministic parser/compiler fuzzing;
- Interpreter/direct-Wasm/executable-C99 differential tests;
- property-based Change/History/Undo/Redo tests;
- source-compatibility corpus and logical artifact reproducibility checks.

## Next work

Native ListBox list-state/multi-selection parity is complete. The next product stages include sealed/offline parity for advanced Menu separators/shortcuts/enabled/checked state, true separate source files/forms beyond the current source-backed Project Outline, richer data controls, distribution signing/notarization evidence, installers and additional accessibility/package polish.
