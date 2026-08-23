# Application builds

Status: **0.2.0-beta.35+** · Change IR **0.10** · Native GUI IR **1.3** · sealed payload **v13** · sealed runtime **v1.4**

Patch keeps Console, direct-native Window, token-free sealed Window and explicit compatibility Window paths separate. Product GUI work does not expand the beta.32 research assurance claims.

## Build matrix

```text
Console
  Web     -> direct Patch Wasm + browser host
  Windows -> project-named sealed .exe
  macOS   -> project-named sealed .app
  Linux   -> project-named sealed executable
  FreeBSD -> portable C99 + native cc

Window / GUI
  Web     -> Standalone Window Web App
  Windows -> direct Win32 AOT or token-free sealed Win32 runtime v1.4
  macOS   -> direct AppKit AOT or token-free sealed AppKit runtime v1.4
  Linux   -> direct GTK3 AOT or token-free sealed GTK3 runtime v1.4
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio downloads use **Ready app download (no token)** by default. That path lowers project-specific Native GUI IR 1.3 in the browser through `src/native-current-contract.js`, verifies the platform runtime template, seals payload v13 into the native runtime and downloads the result. The frozen TreeView contract is Native GUI IR 1.2 / payload v12 / runtime v1.3 via `src/native-frozen-contract.js`. The optional cloud/local AOT paths generate project-specific machine code with the platform toolkit compiler. See `docs/NATIVE_COMPATIBILITY.md`.

## Versioned native layers

The native stack keeps semantic, generator and sealed-runtime contracts independent:

- **Native GUI IR 0.7**: frozen base Forms/control/menu/dialog surface.
- **Native GUI IR 0.8**: additive Table extension with source-backed columns/rows and transient `text-list` Table events.
- **Native GUI IR 0.9**: additive Menu separator/shortcut representation.
- **Native GUI IR 1.0**: additive source-backed Boolean MenuItem enabled/checked state.
- **Native GUI IR 1.1**: additive persistent text-list state and list-backed multi-select ListBox semantics.
- **Native GUI IR 1.2**: frozen additive hierarchical TreeView representation with transient root-to-node path events.
- **Native GUI IR 1.3**: current additive Slider range/step/numeric-event representation.
- **AOT backend 0.8**: base Win32/AppKit/GTK generator with accessibility and responsive layout.
- **AOT backend 0.9**: native Table widgets.
- **AOT backend 1.0**: Menu separators/shortcuts.
- **AOT backend 1.1**: source-backed enabled/checked MenuItem state.
- **AOT backend 1.2**: persistent text-list state and real native multi-select ListBox.
- **AOT/backend runtime 1.3**: hierarchical native TreeView parity on Win32/AppKit/GTK.
- **AOT backend 1.4**: native Slider parity through TRACKBAR/NSSlider/GtkScale.
- **sealed payload v13 / runtime v1.4**: current token-free Ready/offline Window contract carrying responsive layout, Table, persistent list/ListBox, Menu, TreeView and Slider semantics.
- **sealed payload v12 / runtime v1.3**: frozen TreeView compatibility line; Slider intentionally fail-closed.
- **sealed payload v11 / runtime v1.2**: frozen Menu+list compatibility line.
- **sealed payload v10 / runtime v1.1**: frozen persistent-list/multi-select compatibility line.
- **sealed payload v9 / runtime v1.0**: frozen Table compatibility line.
- **sealed payload v8 / runtime v0.9**: frozen responsive compatibility line.
- **sealed payload v7 / runtime v0.8**: older frozen accessibility/result-dialog compatibility line.

A newer runtime or backend therefore does not silently redefine an older payload or IR format.

## Responsive Window layout

Visual layout remains source-backed. Standalone Web, direct Win32/AppKit/GTK AOT, token-free runtime v1.4 and supported offline-linked Window apps all honor the same Anchor/Dock layout policy. Runtime reflow is UI behavior and creates no Patch state or Change History.

## Native UI semantics

GUI interaction alone does not persist Patch state.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox/Radio and text-backed ListBox `changed` expose transient text `value`.
- list-backed ListBox `changed` exposes transient copied text-list `value`.
- Table `changed` exposes the selected row as transient list-valued `value`.
- TreeView `changed` exposes the selected root-to-node display path as transient text-list `value`.
- Slider `changed` exposes a finite numeric `value` inside the declared range.
- MenuItem `clicked` has no value.
- Tabs page selection is renderer/toolkit-local and exposes no Patch event.
- Confirm emits `confirmed` or `cancelled`.
- Open/Save emit `chosen` with transient text `value`, or `cancelled`.

Persistent application state changes only through an explicit semantic `change`.

## Native Slider

Slider is supported across browser preview, Standalone Web, direct AOT and current token-free Ready/offline Windows/macOS/Linux paths.

```patch
create number volume = 50
window "Mixer" as main size 560, 300:
  slider 0..100 as volume step 5 at 24, 80 size 300, 44
when volume changed:
  change volume:
    set = value
```

Native mappings are Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale`. Native GUI IR 1.3 records range, step, optional numeric binding and numeric event type. Payload v13 transports that metadata over the exact v12 compatibility representation. Runtime v1.4 restores the numeric event-local value before executing the existing semantic action engine.

The frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 contract remains Slider fail-closed.

## Native multi-select ListBox

List-backed ListBox has parity across browser preview, Standalone Web, direct AOT and current token-free Ready/offline Windows/macOS/Linux paths. Native GUI IR 1.1 introduced the persistent text-list state/event ABI. Current Native GUI IR 1.3 / payload v13 / runtime v1.4 preserves it unchanged while adding Slider. The v10 compatibility line remains frozen and independently tested.

## Table support

Table/Grid continues to use the specialized Table representation introduced at Native GUI IR **0.8** and direct backend **0.9**. The frozen direct-native mappings remain explicit compatibility evidence:

- **Windows:** report-mode `WC_LISTVIEWW`;
- **macOS:** multi-column `NSTableView` inside `NSScrollView`;
- **Linux:** `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow`.

Standalone Web and Studio App Preview expose the selected row as a transient row list through the shared semantic Window event adapter. Direct AOT and current token-free sealed Ready/offline paths preserve the same semantic selected-row contract. Current payload v13/runtime v1.4 carries the unchanged Table representation; payload v9/runtime v1.0 remains the frozen Table compatibility line.

A Table row remains transient UI selection unless source explicitly persists it.

## TreeView support

TreeView is source-backed and hierarchical. Selecting a node exposes its root-to-node display path as transient text-list `value`. Persistent state changes only when the handler executes `change`.

Current native mappings are Win32 common-controls TreeView, AppKit `NSOutlineView`, and GTK3 `GtkTreeView` + `GtkTreeStore`. Native GUI IR 1.3/payload v13/runtime v1.4 preserves the TreeView ABI introduced by the frozen IR 1.2/payload v12/runtime v1.3 line.

## Token-free sealed runtimes

Current Ready Window builds use **payload v13 / runtime v1.4** on Windows, macOS and Linux. Runtime release tags are:

- `native-win32-runtime-v1.4`;
- `native-linux-runtime-v1.4`;
- `native-macos-runtime-v1.4`.

The **Patch Native Sealed Slider Runtime v1.4** workflow validates payload v13, builds each runtime from source, seals the canonical Slider app and executes the finished artifact on all three desktop hosts. It verifies native Slider creation, numeric event handling and preservation of existing Table/ListBox/Menu/Tree semantics before publishing the versioned runtime assets on `main`.

### Frozen compatibility

Payload **v12** / runtime **v1.3** remains the frozen TreeView line. Payload **v11** / runtime **v1.2** remains the frozen Menu+list line. Payload **v10** / runtime **v1.1** remains the frozen persistent-list/multi-select line. Payload **v9** / runtime **v1.0** remains the frozen Table line. Payload **v8** / runtime **v0.9** and payload **v7** / runtime **v0.8** remain earlier frozen lines. Dedicated workflows continue to exercise the older contracts independently.

## Runtime-template integrity

The runtime integrity mechanism protects the current runtime v1.4 assets. During Pages deployment:

1. Pages requires `studio-runtime-v0.6` plus the three native runtime-v1.4 releases.
2. GitHub Release provides the runtime assets and recorded `sha256:` digests.
3. `scripts/runtime-integrity-manifest.js` independently hashes every downloaded runtime and fails when bytes differ.
4. Pages publishes `runtimes/runtime-manifest.json` for all browser-consumed runtime templates.
5. the browser loads `web/runtime-integrity.js` before `native-build.js`, hashes runtime bytes with Web Crypto SHA-256 and fails closed on a missing/mismatching manifest entry.

The service worker treats same-origin `/runtimes/` requests as fresh-first while online and keeps successful responses only as offline fallback.

This establishes byte consistency across the GitHub Release -> Pages -> browser path. It does not claim Authenticode, Developer ID/notarization, a transparency log or a separate signing trust root.

## Offline compiler

Current Windows, Linux, Apple Silicon macOS and Intel macOS offline compiler paths embed/package runtime **v1.4** and seal Window payload **v13**. Their matrix executes Console, responsive Window, Table, native multi-select ListBox, decorated Menu, TreeView and Slider smokes. FreeBSD remains Console-only through portable C99 + local `cc`.

See `docs/OFFLINE_COMPILER.md` for platform packaging and verification details.

## Menu capability

Direct AOT and current sealed Ready/offline paths support Menu separators, portable shortcuts and source-backed enabled/checked state. Payload v11/runtime v1.2 established the frozen Menu+list compatibility line; payload v13/runtime v1.4 preserves it while composing TreeView and Slider without redefining v11.

## Native accessibility baseline

Direct and sealed native paths implement deterministic naming for otherwise-unlabelled controls and group context for Radio options. Table, TreeView and Slider widgets use source-derived accessible context where the native toolkit needs it.

This is an automated engineering baseline, not a WCAG conformance claim. Manual Narrator/VoiceOver/Orca testing remains open.

## Explicit compatibility Window path

Patch retains the Electron-based compatibility backend as an explicit fallback, never as a silent native fallback. The compatibility runtime remains `studio-runtime-v0.6` with compatibility Ready payload v0.4. Native GUI IR/payload/backend evolution does not redefine that format.

## Research boundary

Native product changes through IR 1.3/payload v13/runtime v1.4 do not alter the beta.32 assurance evidence. `GeneratedRepeatedTransitiveRuntimeCertificate.lean` and the related invocation-frame/call-tree evidence remain the current research correspondence milestone. Product runtime version numbers should not be read as expanded proof coverage.
