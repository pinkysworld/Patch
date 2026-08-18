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
| Native GUI IR 1.1 | persistent text-list state, multi-select ListBox, Menu state/shortcuts |
| Native GUI IR 1.2 | **current**, adds hierarchical TreeView |
| sealed payload v8 / runtime v0.9 | frozen responsive base compatibility |
| sealed payload v9 / runtime v1.0 | frozen Table compatibility |
| sealed payload v10 / runtime v1.1 | frozen persistent-list compatibility |
| sealed payload v11 / runtime v1.2 | frozen Menu+list compatibility |
| sealed payload v12 / runtime v1.3 | **current Ready/offline desktop contract**, adds TreeView |

A backend or runtime version never silently redefines an older IR or payload format. A source program requiring a newer feature fails closed when explicitly linked against an older contract.

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

Current token-free Ready/offline Window builds use **Native GUI IR 1.2**, **sealed payload v12** and **runtime v1.3**.

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
- structural Window menus, separators, portable shortcuts and source-backed `enabled` / `checked` projections;
- informational dialogs;
- named result-bearing Confirm/Open/Save dialogs;
- Button/MenuItem `clicked`, typed control `changed`, Confirm `confirmed`/`cancelled`, and file `chosen`/`cancelled` events;
- explicit scalar/list `change` operations supported by the versioned event/value contract;
- named Form `open` / `close` lifecycle;
- simple state interpolation in supported labels.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Selection semantics

GUI selection is transient unless Patch source explicitly persists it:

```text
native selection -> transient event value -> when <id> changed -> explicit Patch change
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

Tabs page selection remains renderer/toolkit-local and has no Patch event. Selection itself does not create Patch state or Change History.

## Table / Grid

Table was introduced as an explicit IR extension rather than an implementation-only control alias:

```patch
window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  show value
```

Native mappings are:

| Platform | Native Table |
|---|---|
| Windows | report-mode `WC_LISTVIEWW` |
| macOS | multi-column `NSTableView` inside `NSScrollView` |
| Linux | `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow` |

## TreeView

Native GUI IR 1.2 adds hierarchical TreeView while keeping selection semantically transient:

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

Selecting `compiler.js` exposes `['src', 'compiler.js']` as the transient event-local `value`. Persistent `selected` changes only because the handler contains an explicit semantic `change`.

Native mappings are:

| Platform | Native TreeView |
|---|---|
| Windows | common-controls TreeView |
| macOS | `NSOutlineView` in `NSScrollView` |
| Linux | `GtkTreeView` + `GtkTreeStore` in `GtkScrolledWindow` |

Payload v12 carries an explicit Tree metadata block over the frozen v11 prefix. Runtime v1.3 validates and consumes that metadata, while the established v1.2 event/action engine remains authoritative for semantic changes.

## Multi-select ListBox and persistent list state

A ListBox backed by `create list` uses the text-list event contract:

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit Picker":
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits

when fruits changed:
  change fruits:
    set = value
```

The native toolkit owns transient selection. Patch persistence occurs only through the explicit `change fruits` block. Native GUI IR 1.1 introduced this state/event ABI, and current IR 1.2 / payload v12 preserves it unchanged.

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

The native paths use a deterministic naming contract for controls whose visible native text is insufficient. Platform APIs are:

- Windows: Microsoft Active Accessibility `IAccPropServices`, read back through `IAccessible`;
- AppKit: accessibility labels;
- GTK3: ATK accessible names.

Automated accessibility smoke evidence is an implementation baseline, not a WCAG conformance claim or a substitute for manual Narrator, VoiceOver or Orca testing.

## Token-free sealed runtime v1.3 / payload v12

All three current token-free Ready Window builds use the `PCHGUI01` envelope with payload **v12** and runtime **v1.3**.

The v1.3 release workflow independently:

1. validates the payload-v12/Native-GUI-IR-1.2 contract;
2. builds the Win32, universal AppKit and GTK3 runtime templates;
3. seals the same canonical TreeView program for each host;
4. executes the finished sealed application under `--patch-smoke`;
5. uploads the exact runtime template artifacts;
6. on `main`, publishes separate `native-*-runtime-v1.3` releases.

Patch Pages waits for all three v1.3 release assets before deploying the browser compiler that consumes payload v12. It obtains the GitHub release SHA-256 digest for every runtime asset, builds the runtime integrity manifest and only then publishes the site. Patch Studio independently re-hashes the selected runtime with Web Crypto before sealing.

The macOS browser-sealed app remains unsigned because browser-side sealing modifies the executable after the generic runtime was built. Final-artifact Developer ID signing/notarization is separate distribution work.

## Executable evidence

Current native behavior is covered by independent paths:

1. direct AOT Win32/AppKit/GTK compilation and runtime smokes;
2. frozen compatibility workflow coverage for older payload/runtime contracts;
3. payload-v12/runtime-v1.3 TreeView seal/link/run smokes on Windows, macOS and Linux;
4. ordinary offline `patch link` tests for the current contract plus explicit legacy-version tests;
5. downloadable offline compiler matrices;
6. Pages release-integrity gating for the runtime templates used by token-free browser builds.

The native GUI artifacts do not use Electron, Chromium or Node.js as their GUI runtime. The explicit compatibility package remains separate and labeled as Electron-based.

## Current boundary

Linux native GUI requires compatible GTK3 system libraries. Stable installers, real credentialed Windows signing, real macOS signing/notarization evidence, richer distribution/update channels, FreeBSD native GUI and manual assistive-technology validation remain open product work.

None of this changes Change IR 0.10 or expands the current formal research assurance claims. See `docs/NATIVE_LIST_STATE.md`, `docs/MENUS_DIALOGS.md`, `docs/RESULT_DIALOGS.md`, `docs/RADIO.md`, `docs/TABS.md`, `docs/NATIVE_ACCESSIBILITY.md`, `docs/OFFLINE_COMPILER.md` and `docs/NATIVE_APPS.md` for related contracts.
