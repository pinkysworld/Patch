# Patch Native GUI

Status: **experimental but executable native backend, working on Windows, macOS and Linux**

Patch lowers the same source-backed Window syntax into operating-system-native GUI code. Patch source does not import Win32, AppKit or GTK.

## Current versioned stack

The native stack intentionally separates semantic IR, direct AOT generation and token-free sealed distribution. Older contracts remain frozen instead of being redefined in place.

| Layer | Current / compatibility role |
|---|---|
| Change IR | **0.10**, unchanged by GUI extensions |
| Native GUI IR 0.7 | frozen base controls/dialog compatibility |
| Native GUI IR 0.8 | frozen Table/Grid extension |
| Native GUI IR 1.1 | persistent text-list state and multi-select ListBox ABI |
| Native GUI IR 1.2 | frozen TreeView-capable compatibility line |
| Native GUI IR **1.3** | previous Slider line, adds Slider range/step/numeric event metadata |
| Native GUI IR **1.4** | previous Chrome Stage 1 line (Panel, Timer, PictureBox, StatusBar) |
| Native GUI IR **1.5** | **current**, adds Shape rectangle/rounded/ellipse/line |
| sealed payload v8 / runtime v0.9 | frozen responsive base compatibility |
| sealed payload v9 / runtime v1.0 | frozen Table compatibility |
| sealed payload v10 / runtime v1.1 | frozen persistent-list compatibility |
| sealed payload v11 / runtime v1.2 | frozen Menu+list compatibility |
| sealed payload v12 / runtime v1.3 | frozen TreeView compatibility, Slider fail-closed |
| sealed payload v13 / runtime v1.4 | previous Slider-capable compatibility line |
| sealed payload v14 / runtime v1.5 | previous Chrome Ready/offline line |
| sealed payload v15 / runtime v1.6 | **current Ready/offline desktop contract**, adds Shape |

A backend or runtime version never silently redefines an older IR or payload format. A source program requiring a newer feature fails closed when explicitly linked against an older contract. Unversioned files such as `src/native-gui-ir.js` and `native-runtime/*-sealed-gui.cpp` are the Native GUI IR 0.7 / payload v6 include-chain base, not aliases of the current Ready runtime.

## Build paths

The host-native command remains:

```bash
patch-app myapp.patch
```

It selects the host direct-native backend automatically:

```text
Windows -> Win32  -> .exe
macOS   -> AppKit -> .app
Linux   -> GTK3   -> executable
```

Patch Studio also supports token-free browser-side sealing into precompiled native runtime templates. The downloadable offline compiler performs the same supported sealed linking locally. Project-specific remote AOT through GitHub Actions remains a separate optional route.

Current token-free Ready/offline Window builds use **Native GUI IR 1.5**, **sealed payload v15** and **runtime v1.6**. Product-facing JavaScript imports this line through `src/native-current-contract.js`. The frozen TreeView line is Native GUI IR **1.2** / payload **v12** / runtime **v1.3**, imported through `src/native-frozen-contract.js`. Version-numbered IR/sealer modules remain behind those facades for historical compatibility and regression evidence.

## Supported Window surface

The current native line includes:

- literal `number`, `text`, `boolean` and persistent `text-list` state;
- source-backed Form geometry and responsive Anchor/Dock metadata;
- Text, Button, Input and Checkbox;
- ComboBox;
- text-backed single-select ListBox;
- list-backed native multi-select ListBox;
- grouped Radio controls;
- Tabs containers with page-owned child controls;
- source-backed Table/Grid columns and rows;
- hierarchical source-backed TreeView nodes;
- source-backed Slider range, step, optional numeric binding and numeric `changed` event;
- source-backed Panel Stage 1 visual grouping, Timer, PictureBox and StatusBar;
- source-backed Shape rectangle, rounded, ellipse and line with fill/stroke/radius/opacity and no events;
- structural Window menus, separators, portable shortcuts and source-backed `enabled` / `checked` projections;
- informational dialogs;
- named result-bearing Confirm/Open/Save dialogs;
- Button/MenuItem `clicked`, typed control `changed`, Confirm `confirmed`/`cancelled`, and file `chosen`/`cancelled` events;
- explicit scalar/list `change` operations supported by the versioned event/value contract;
- named Form `open` / `close` lifecycle;
- simple state interpolation in supported labels.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Selection and input semantics

GUI interaction is transient unless Patch source explicitly persists it:

```text
native interaction -> transient event value -> when <id> changed -> explicit Patch change
```

Current transient values are:

| Control | `changed` event value |
|---|---|
| Input | text |
| ComboBox | text |
| Radio | text |
| text-backed ListBox | text |
| list-backed ListBox | text-list of selected display strings |
| Checkbox | Boolean |
| Table | text-list containing the selected row's display strings |
| TreeView | text-list containing the selected root-to-node display path |
| Slider | finite number inside the declared range |

Tabs page selection remains renderer/toolkit-local and has no Patch event. Interaction itself does not create Patch state or Change History.

## Slider

Native GUI IR 1.3 adds Slider as an additive contract over the frozen TreeView line:

```patch
create number volume = 50
window "Mixer" as main size 560, 300:
  slider 0..100 as volume step 5 at 24, 80 size 300, 44
when volume changed:
  change volume:
    set = value
```

Native mappings are:

| Platform | Native Slider |
|---|---|
| Windows | common-controls `TRACKBAR` |
| macOS | `NSSlider` |
| Linux | GTK3 `GtkScale` |

The runtime validates and restores a finite numeric event-local value before executing the ordinary Patch handler. Moving the toolkit control never becomes implicit Patch state. Persistence occurs only through the explicit `change volume` block.

Payload v13 appends Slider metadata to the exact payload-v12 compatibility representation. Runtime v1.4 consumes that extension and reuses the existing semantic action engine. Payload v12/runtime v1.3 remains deliberately Slider fail-closed.

## Table / Grid

Table was introduced as an explicit IR extension rather than an implementation-only control alias. Native mappings remain report-mode `WC_LISTVIEWW` on Windows, multi-column `NSTableView` in `NSScrollView` on macOS and `GtkTreeView` + `GtkListStore` in `GtkScrolledWindow` on Linux.

The selected row is a transient text-list event value. Current v15/v1.6 preserves the frozen v9/v1.0 Table representation.

## TreeView

Native GUI IR 1.2 introduced hierarchical TreeView while keeping selection semantically transient. Native mappings remain common-controls TreeView on Windows, `NSOutlineView` in `NSScrollView` on macOS and `GtkTreeView` + `GtkTreeStore` in `GtkScrolledWindow` on Linux.

Selecting a node exposes the root-to-node text-list path. Current Native GUI IR 1.5 / payload v15 / runtime v1.6 preserves that exact TreeView contract while adding Slider, Chrome Stage 1 and Shape. Payload v12/runtime v1.3 remains the frozen TreeView-origin line.

## Multi-select ListBox and persistent list state

A ListBox backed by `create list` uses the text-list event contract. The native toolkit owns transient selection. Patch persistence occurs only through an explicit `change` block.

Native GUI IR 1.1 introduced this state/event ABI. Current IR 1.5 / payload v15 preserves it unchanged. Frozen payload v10/runtime v1.1 remains dedicated compatibility evidence for the original list-state line.

## Menus and dialogs

Menus are Window structure, not positioned controls. Current native Menu support includes separators, portable shortcuts and Boolean `enabled` / `checked` projections from ordinary Patch state. Menu activation itself does not create hidden persistent toolkit state.

Current mappings include:

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Menu | `HMENU` / `WM_COMMAND` | `NSMenu` / `NSMenuItem` | `GtkMenuBar` / `GtkMenuItem` |
| Info dialog | `MessageBoxW` | `NSAlert` | `GtkMessageDialog` |
| Confirm result | `MessageBoxW` Yes/No | `NSAlert` | `GtkMessageDialog` |
| Open result | `GetOpenFileNameW` | `NSOpenPanel` | `GtkFileChooserDialog` |
| Save result | `GetSaveFileNameW` | `NSSavePanel` | `GtkFileChooserDialog` |

Under `--patch-smoke`, blocking dialogs return deterministic test results so CI cannot wait for user interaction. Normal applications use real OS dialogs.

## Accessibility

The native paths use a deterministic naming contract for controls whose visible native text is insufficient. Platform APIs are Microsoft Active Accessibility `IAccPropServices` on Windows, AppKit accessibility labels on macOS and ATK accessible names on GTK3.

Automated accessibility smoke evidence is an implementation baseline, not a WCAG conformance claim or a substitute for manual Narrator, VoiceOver or Orca testing.

## Token-free sealed runtime v1.6 / payload v15

All three current token-free Ready Window builds use the `PCHGUI01` envelope with payload **v15** and runtime **v1.6**.

The v1.6 release workflow independently:

1. validates the payload-v15/Native-GUI-IR-1.5 contract;
2. builds the Win32, universal AppKit and GTK3 runtime templates;
3. seals the canonical Shape program for each host and the Chrome example through the same runtime;
4. executes the finished sealed application under `--patch-smoke`;
5. verifies real native Shape drawing while retaining Chrome, Slider, Table/ListBox/Menu/Tree behavior;
6. uploads the exact runtime template artifacts;
7. on `main`, publishes separate versioned runtime releases.

The current platform release tags are:

- `native-win32-runtime-v1.6`;
- `native-macos-runtime-v1.6`;
- `native-linux-runtime-v1.6`.

Patch Pages waits for all three v1.6 release assets before deploying the browser compiler that consumes payload v15. It obtains the GitHub release SHA-256 digest for every runtime asset, builds the runtime integrity manifest and only then publishes the site. Patch Studio independently re-hashes the selected runtime with Web Crypto before sealing.

The macOS browser-sealed app remains unsigned because browser-side sealing modifies the executable after the generic runtime was built. Final-artifact Developer ID signing/notarization is separate distribution work.

## Frozen compatibility chain

The current line does not replace historical evidence:

```text
Native GUI IR 0.8 / payload v9  / runtime v1.0  Table
Native GUI IR 1.1 / payload v10 / runtime v1.1  persistent list + multi-select ListBox
payload v11 / runtime v1.2                         Menu + list
Native GUI IR 1.2 / payload v12 / runtime v1.3  TreeView, Slider fail-closed
Native GUI IR 1.3 / payload v13 / runtime v1.4  previous Slider-capable line
Native GUI IR 1.4 / payload v14 / runtime v1.5  previous Chrome Stage 1 line
Native GUI IR 1.5 / payload v15 / runtime v1.6  current Shape Stage 1 line
```

Explicit legacy linking remains fail-closed when a source needs a newer capability.

## Executable evidence

Current native behavior is covered by independent paths:

1. direct AOT Win32/AppKit/GTK compilation and runtime smokes;
2. frozen compatibility workflow coverage for older payload/runtime contracts;
3. payload-v15/runtime-v1.6 Shape seal/link/run smokes on Windows, macOS and Linux;
4. ordinary offline `patch link` tests for the current contract plus explicit legacy-version tests;
5. downloadable offline compiler matrices;
6. Pages release-integrity gating for the runtime templates used by token-free browser builds.

The native GUI artifacts do not use Electron, Chromium or Node.js as their GUI runtime. The explicit compatibility package remains separate and labeled as Electron-based.

## Current boundary

Linux native GUI requires compatible GTK3 system libraries. Stable installers, real credentialed Windows signing, real macOS signing/notarization evidence, richer distribution/update channels, FreeBSD native GUI and manual assistive-technology validation remain open distribution/validation work.

None of this changes Change IR 0.10 or expands the beta.32 formal research assurance claims. See `docs/NATIVE_COMPATIBILITY.md`, `docs/SLIDER_STAGE1.md`, `docs/NATIVE_LIST_STATE.md`, `docs/MENUS_DIALOGS.md`, `docs/RESULT_DIALOGS.md`, `docs/RADIO.md`, `docs/TABS.md`, `docs/NATIVE_ACCESSIBILITY.md`, `docs/OFFLINE_COMPILER.md` and `docs/NATIVE_APPS.md` for related contracts.
