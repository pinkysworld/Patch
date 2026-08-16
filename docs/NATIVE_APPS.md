# Application builds

Status: **0.2.0-beta.35** · Change IR **0.10**

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
  Windows -> direct Win32 AOT or token-free sealed Win32 runtime
  macOS   -> direct AppKit AOT or token-free sealed AppKit runtime
  Linux   -> direct GTK3 AOT or token-free sealed GTK3 runtime
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio downloads use **Ready app download (no token)** by default. That path lowers project-specific Native GUI IR in the browser, verifies the platform runtime template, seals the checked payload into the native runtime and downloads the result. The optional cloud/local AOT paths generate project-specific machine code with the platform toolkit compiler.

## Versioned native layers

The native stack keeps semantic, generator and sealed-runtime contracts independent:

- **Native GUI IR 0.7**: stable base Forms/control/menu/dialog surface.
- **Native GUI IR 0.8**: additive Table extension with source-backed columns/rows and transient `text-list` Table events.
- **Native GUI IR 0.9**: additive Menu separator/shortcut representation.
- **Native GUI IR 1.0**: additive source-backed Boolean MenuItem enabled/checked state.
- **Native GUI IR 1.1**: additive persistent text-list state and list-backed multi-select ListBox semantics.
- **AOT backend 0.8**: base Win32/AppKit/GTK generator with accessibility and responsive layout.
- **AOT backend 0.9**: native Table widgets.
- **AOT backend 1.0**: Menu separators/shortcuts.
- **AOT backend 1.1**: source-backed enabled/checked MenuItem state.
- **AOT backend 1.2**: persistent text-list state and real native multi-select ListBox.
- **sealed payload v10 / runtime v1.1**: current token-free Ready/offline Window contract carrying Table, responsive layout and native list state.
- **sealed payload v9 / runtime v1.0**: frozen previous Table-capable compatibility line.
- **sealed payload v8 / runtime v0.9**: frozen responsive compatibility line.
- **sealed payload v7 / runtime v0.8**: older frozen accessibility/result-dialog compatibility line.

A newer runtime or backend therefore does not silently redefine an older payload or IR format.

## Responsive Window layout

Visual layout remains source-backed:

```patch
# @layout anchor left right top
button "Save" as save at 24, 24 size 120, 36

# @layout dock bottom
text "Ready" at 24, 380 size 200, 30
```

The parser treats these as comments while the compiler extracts them into Window layout metadata. Standalone Web, direct Win32/AppKit/GTK AOT, token-free runtime v1.1 and supported offline-linked Window apps all honor the same layout policy. Runtime reflow is UI behavior and creates no Patch state or Change History.

## Native UI semantics

GUI interaction alone does not persist Patch state.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox/Radio and text-backed ListBox `changed` expose transient text `value`.
- list-backed ListBox `changed` exposes transient copied text-list `value`.
- Table `changed` exposes the selected row as transient list-valued `value`.
- MenuItem `clicked` has no value.
- Tabs page selection is renderer/toolkit-local and exposes no Patch event.
- Confirm emits `confirmed` or `cancelled`.
- Open/Save emit `chosen` with transient text `value`, or `cancelled`.

Persistent application state changes only through an explicit semantic `change`.

## Native multi-select ListBox

List-backed ListBox now has parity across browser preview, Standalone Web, direct AOT and current token-free Ready/offline Windows/macOS/Linux paths.

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit Picker":
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits

when fruits changed:
  change fruits:
    set = value
```

The native mappings are:

- Win32: `LBS_EXTENDEDSEL` + `LB_GETSELITEMS` / `LB_SETSEL`;
- AppKit: multi-select `NSTableView` + `selectedRowIndexes`;
- GTK3: `GTK_SELECTION_MULTIPLE` + `selected-rows-changed`.

Direct AOT uses Native GUI IR **1.1** / backend **1.2**. Token-free Ready/offline uses payload **v10** / runtime **v1.1**. The v10 payload keeps list `set`, `add`, `remove`, `clear` and event-local `set = value` structurally distinct instead of encoding lists as strings.

## Table support

Table/Grid continues to use the specialized Table representation introduced at Native GUI IR **0.8** and direct backend **0.9**:

- Win32: report-mode `WC_LISTVIEWW`;
- AppKit: multi-column `NSTableView` inside `NSScrollView`;
- GTK3: `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow`.

| Surface | Table display | Row selection / `changed` | Status |
| --- | --- | --- | --- |
| Designer | yes | Designer selection only | implemented |
| Standalone Web | yes | transient row list | implemented |
| Studio App preview | yes | transient row list | implemented |
| Direct Win32/AppKit/GTK AOT | real native Table | transient row list | backend 0.9 smoke-tested |
| Token-free sealed Ready app | real native Table | transient row list | current payload v10/runtime v1.1; v9/v1.0 frozen compatibility |
| Offline `patch link` Window | real native Table | transient row list | current payload v10/runtime v1.1 |
| FreeBSD Window | no | no | unsupported |

Native GUI IR 1.1 and payload v10 preserve the Table contract while adding persistent list state for ListBox. A Table row remains transient UI selection unless source explicitly persists it.

## Token-free sealed runtimes

Current Ready Window builds use **payload v10 / runtime v1.1** on Windows, macOS and Linux. Runtime release tags are:

- `native-win32-runtime-v1.1`;
- `native-linux-runtime-v1.1`;
- `native-macos-runtime-v1.1`.

The **Patch Native Sealed List Runtime** workflow builds each runtime from source and proves three paths per desktop host:

1. the canonical multi-select ListBox app sealed directly as payload v10;
2. Table compatibility carried through the new runtime;
3. ordinary offline `patch link` of the same multi-select source.

The v1.1 runtime uses an additive v10-to-v9 compatibility adapter internally so the established scalar/Table core remains reproducible while list state and list actions are handled by the new layer. Original event action ordering is preserved when list actions are mixed with scalar changes, dialogs or Form actions.

### Frozen compatibility

Payload **v9** / runtime **v1.0** remains a frozen Table-capable line and is still built/smoked independently on Windows, macOS and Linux. Payload **v8** / runtime **v0.9** and payload **v7** / runtime **v0.8** remain the earlier frozen lines.

## Beta.34 runtime-template integrity

The integrity mechanism introduced in beta.34 remains the current delivery gate, now applied to runtime v1.1 assets.

During Pages deployment:

1. Pages requires `studio-runtime-v0.6` plus the three native runtime-v1.1 releases.
2. GitHub Release provides the runtime assets and recorded `sha256:` digests.
3. `scripts/runtime-integrity-manifest.js` independently hashes every downloaded runtime and fails when bytes differ.
4. Pages publishes `runtimes/runtime-manifest.json` for all browser-consumed runtime templates.
5. the browser loads `web/runtime-integrity.js` before `native-build.js`, hashes runtime bytes with Web Crypto SHA-256 and fails closed on a missing/mismatching manifest entry.

The service worker treats same-origin `/runtimes/` requests as fresh-first while online and keeps successful responses only as offline fallback.

This establishes byte consistency across the GitHub Release -> Pages -> browser path. It does not claim Authenticode, Developer ID/notarization, a transparency log or a separate signing trust root.

## Offline compiler

Current Windows, Linux, Apple Silicon macOS and Intel macOS offline compiler paths embed/package runtime **v1.1** and seal Window payload **v10**. Their matrix executes Console, responsive Window, Table and native multi-select Window smokes. FreeBSD remains Console-only through portable C99 + local `cc`.

See `docs/OFFLINE_COMPILER.md` for platform packaging and verification details.

## Menu capability boundary

Direct AOT already supports Menu separators/portable shortcuts and source-backed enabled/checked state through Native GUI IR 0.9/1.0 and backend 1.0/1.1. Current sealed payload v10/runtime v1.1 deliberately remains fail-closed for advanced Menu decorations/state combinations rather than silently dropping those properties. Extending that sealed/offline contract is a separate backlog item.

## Native accessibility baseline

Direct and sealed native paths implement deterministic naming for otherwise-unlabelled Input, ComboBox, ListBox and Tabs controls and group context for Radio options. Table widgets use source-derived accessible names.

- Windows: Microsoft Active Accessibility `IAccPropServices` / `IAccessible`;
- macOS: AppKit accessibility labels;
- Linux: GTK3/ATK accessible names.

This is an automated engineering baseline, not a WCAG conformance claim. Manual Narrator/VoiceOver/Orca testing remains open.

## Explicit compatibility Window path

Patch retains the Electron-based compatibility backend as an explicit fallback, never as a silent native fallback:

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> patch-compiled-window-program 0.2 / Change IR 0.10
  -> sandboxed compatibility runtime
  -> Windows/macOS/Linux application
```

The compatibility runtime remains `studio-runtime-v0.6` with compatibility Ready payload v0.4. Native GUI IR/payload/backend evolution does not redefine that format.

## Research boundary

Native product changes do not alter the beta.32 assurance evidence. `GeneratedRepeatedTransitiveRuntimeCertificate.lean` and the related invocation-frame/call-tree evidence remain the current research correspondence milestone. Product runtime version numbers should not be read as expanded proof coverage.
