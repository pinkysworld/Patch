# Application builds

Status: **0.2.0-beta.35+** · Change IR **0.10** · Native GUI IR **1.2** · sealed runtime **v1.3**

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
  Windows -> direct Win32 AOT or token-free sealed Win32 runtime v1.3
  macOS   -> direct AppKit AOT or token-free sealed AppKit runtime v1.3
  Linux   -> direct GTK3 AOT or token-free sealed GTK3 runtime v1.3
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio downloads use **Ready app download (no token)** by default. That path lowers project-specific Native GUI IR 1.2 in the browser, verifies the platform runtime template, seals payload v12 into the native runtime and downloads the result. The optional cloud/local AOT paths generate project-specific machine code with the platform toolkit compiler.

## Versioned native layers

The native stack keeps semantic, generator and sealed-runtime contracts independent:

- **Native GUI IR 0.7**: frozen base Forms/control/menu/dialog surface.
- **Native GUI IR 0.8**: additive Table extension with source-backed columns/rows and transient `text-list` Table events.
- **Native GUI IR 0.9**: additive Menu separator/shortcut representation.
- **Native GUI IR 1.0**: additive source-backed Boolean MenuItem enabled/checked state.
- **Native GUI IR 1.1**: additive persistent text-list state and list-backed multi-select ListBox semantics.
- **Native GUI IR 1.2**: current additive hierarchical TreeView representation with transient root-to-node path events.
- **AOT backend 0.8**: base Win32/AppKit/GTK generator with accessibility and responsive layout.
- **AOT backend 0.9**: native Table widgets.
- **AOT backend 1.0**: Menu separators/shortcuts.
- **AOT backend 1.1**: source-backed enabled/checked MenuItem state.
- **AOT backend 1.2**: persistent text-list state and real native multi-select ListBox.
- **AOT/backend runtime 1.3**: hierarchical native TreeView parity on Win32/AppKit/GTK.
- **sealed payload v12 / runtime v1.3**: current token-free Ready/offline Window contract carrying responsive layout, Table, persistent list/ListBox, Menu and TreeView semantics.
- **sealed payload v11 / runtime v1.2**: frozen Menu+list compatibility line.
- **sealed payload v10 / runtime v1.1**: frozen persistent-list/multi-select compatibility line.
- **sealed payload v9 / runtime v1.0**: frozen Table compatibility line.
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

The parser treats these as comments while the compiler extracts them into Window layout metadata. Standalone Web, direct Win32/AppKit/GTK AOT, token-free runtime v1.3 and supported offline-linked Window apps all honor the same layout policy. Runtime reflow is UI behavior and creates no Patch state or Change History.

## Native UI semantics

GUI interaction alone does not persist Patch state.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox/Radio and text-backed ListBox `changed` expose transient text `value`.
- list-backed ListBox `changed` exposes transient copied text-list `value`.
- Table `changed` exposes the selected row as transient list-valued `value`.
- TreeView `changed` exposes the selected root-to-node display path as transient text-list `value`.
- MenuItem `clicked` has no value.
- Tabs page selection is renderer/toolkit-local and exposes no Patch event.
- Confirm emits `confirmed` or `cancelled`.
- Open/Save emit `chosen` with transient text `value`, or `cancelled`.

Persistent application state changes only through an explicit semantic `change`.

## Native multi-select ListBox

List-backed ListBox has parity across browser preview, Standalone Web, direct AOT and current token-free Ready/offline Windows/macOS/Linux paths.

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

Native GUI IR 1.1 introduced the persistent text-list state/event ABI. Current Native GUI IR 1.2 / payload v12 / runtime v1.3 preserves it unchanged while adding TreeView. The v10 compatibility line remains frozen and independently tested.

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
| Direct Win32/AppKit/GTK AOT | real native Table | transient row list | backend 0.9 compatibility + later additive backends smoke-tested |
| Token-free sealed Ready app | real native Table | transient row list | current payload v12/runtime v1.3; v9/v1.0 frozen Table compatibility |
| Offline `patch link` Window | real native Table | transient row list | current payload v12/runtime v1.3 |
| FreeBSD Window | no | no | unsupported |

A Table row remains transient UI selection unless source explicitly persists it.

## TreeView support

TreeView is source-backed and hierarchical:

```patch
create list selected = []
window "Files" as main size 560, 380:
  tree as files at 24, 56 size 300, 240:
    node "src":
      node "compiler.js"
      node "parser.js"
    node "docs":
      node "README.md"
when files changed:
  change selected:
    set = value
```

Selecting `compiler.js` exposes `['src', 'compiler.js']` as transient text-list `value`. Persistent state changes only because the handler executes `change selected`.

Current native mappings are Win32 common-controls TreeView, AppKit `NSOutlineView`, and GTK3 `GtkTreeView` + `GtkTreeStore`. Browser, direct-native and sealed Ready/offline paths use the same root-to-node display-path contract.

## Token-free sealed runtimes

Current Ready Window builds use **payload v12 / runtime v1.3** on Windows, macOS and Linux. Runtime release tags are:

- `native-win32-runtime-v1.3`;
- `native-linux-runtime-v1.3`;
- `native-macos-runtime-v1.3`.

The **Patch Native Sealed TreeView Runtime v1.3** workflow validates payload v12, builds each runtime from source, seals the canonical TreeView app and executes the finished artifact on all three desktop hosts. On `main`, only after the platform jobs succeed, it publishes the three versioned runtime assets.

### Frozen compatibility

Payload **v11** / runtime **v1.2** remains the frozen Menu+list line. Payload **v10** / runtime **v1.1** remains the frozen persistent-list/multi-select line. Payload **v9** / runtime **v1.0** remains the frozen Table line. Payload **v8** / runtime **v0.9** and payload **v7** / runtime **v0.8** remain earlier frozen lines. Dedicated workflows continue to exercise the older contracts independently.

## Runtime-template integrity

The integrity mechanism introduced in beta.34 protects the current runtime v1.3 assets.

During Pages deployment:

1. Pages requires `studio-runtime-v0.6` plus the three native runtime-v1.3 releases.
2. GitHub Release provides the runtime assets and recorded `sha256:` digests.
3. `scripts/runtime-integrity-manifest.js` independently hashes every downloaded runtime and fails when bytes differ.
4. Pages publishes `runtimes/runtime-manifest.json` for all browser-consumed runtime templates.
5. the browser loads `web/runtime-integrity.js` before `native-build.js`, hashes runtime bytes with Web Crypto SHA-256 and fails closed on a missing/mismatching manifest entry.

The service worker treats same-origin `/runtimes/` requests as fresh-first while online and keeps successful responses only as offline fallback.

This establishes byte consistency across the GitHub Release -> Pages -> browser path. It does not claim Authenticode, Developer ID/notarization, a transparency log or a separate signing trust root.

## Offline compiler

Current Windows, Linux, Apple Silicon macOS and Intel macOS offline compiler paths embed/package runtime **v1.3** and seal Window payload **v12**. Their matrix executes Console, responsive Window, Table, native multi-select ListBox, decorated Menu and TreeView smokes. FreeBSD remains Console-only through portable C99 + local `cc`.

See `docs/OFFLINE_COMPILER.md` for platform packaging and verification details.

## Menu capability

Direct AOT and current sealed Ready/offline paths support Menu separators, portable shortcuts and source-backed enabled/checked state. Payload v11/runtime v1.2 established the frozen Menu+list compatibility line; payload v12/runtime v1.3 preserves it and adds TreeView without redefining v11.

## Native accessibility baseline

Direct and sealed native paths implement deterministic naming for otherwise-unlabelled Input, ComboBox, ListBox and Tabs controls and group context for Radio options. Table and TreeView widgets use source-derived accessible names.

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
