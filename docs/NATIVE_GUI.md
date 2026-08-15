# Patch Native GUI

Status: **experimental native backend preview, working on Windows, macOS and Linux**

Patch lowers the same source-backed Window syntax into operating-system-native GUI code. Patch source does not import Win32, AppKit or GTK.

## Versioned layers

The native stack intentionally separates semantic IR, direct AOT generation and token-free sealed distribution:

- **Native GUI IR 0.7**: base Forms/control/menu/dialog contract.
- **Native GUI IR 0.8**: explicit Table/Grid extension with source-backed columns/rows and transient `text-list` Table events.
- **AOT backend 0.8**: direct Win32/AppKit/GTK source-generation layer for the IR 0.7 base surface, including accessibility and responsive Anchor/Dock handling.
- **AOT backend 0.9**: direct Table extension over Native GUI IR 0.8.
- **sealed payload v9 / runtime v1.0**: current token-free Ready/offline Window contract, carrying Native GUI IR 0.8 Table metadata plus responsive layout.
- **sealed payload v8 / runtime v0.9**: frozen responsive compatibility line for Native GUI IR 0.7.
- **sealed payload v7 / runtime v0.8**: older frozen accessibility compatibility/reproducibility line.

A backend or runtime version never silently redefines an older IR or payload format.

## Build paths

The host-native command remains:

```bash
patch-app myapp.patch
```

It selects the host AOT backend automatically:

```text
Windows -> Win32  -> .exe
macOS   -> AppKit -> .app
Linux   -> GTK3   -> executable
```

Patch Studio also supports token-free browser-side sealing into precompiled native runtime templates. The downloadable offline compiler performs the same supported sealed linking locally. Project-specific remote AOT through GitHub Actions remains a separate optional route.

## Native GUI IR 0.7 base

Native GUI IR 0.7 supports:

- literal `number`, `text` and `boolean` state;
- source-backed Form geometry;
- Text, Button, Input and Checkbox;
- ComboBox and single-selection ListBox;
- grouped Radio controls;
- real Tabs containers with page-owned child controls;
- structural Window menus with named menu items;
- informational dialog actions;
- named result-bearing Confirm/Open/Save dialog actions;
- Button/MenuItem `clicked`, typed control `changed`, Confirm `confirmed`/`cancelled`, and file `chosen`/`cancelled` events;
- explicit scalar `change` operations;
- named Form `open` / `close` lifecycle;
- simple state interpolation in supported labels;
- source-backed Anchor/Dock layout metadata outside persistent Change semantics.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Native GUI IR 0.8 Table / Grid

Table is an explicit IR extension rather than an implementation-only control alias:

```patch
window "People" as main size 520, 320:
  # @layout anchor left right top
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  show value
```

Table `changed` exposes the selected row as a transient list of display strings. Selection does not implicitly persist application state or create Change History. A normal Patch `change` is still required for persistence.

Direct AOT backend 0.9 maps Table to:

| Platform | Native Table |
|---|---|
| Windows | report-mode `WC_LISTVIEWW` |
| macOS | multi-column `NSTableView` inside `NSScrollView` |
| Linux | `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow` |

The dedicated direct-AOT Table matrix compiles and executes the same Table program on Windows/MSVC, macOS/AppKit and Linux/GTK3 and checks real row-selection dispatch, accessibility and responsive layout.

## Selection semantics

GUI selection is transient unless Patch source explicitly persists it:

```text
native selection -> transient event value -> when <id> changed -> explicit Patch change
```

ComboBox, ListBox and Radio expose transient text. Table exposes a transient list of row strings. Checkbox exposes a transient Boolean. Tabs page selection remains toolkit-local and has no Patch event.

## Menus and dialogs

Menus are Window structure, not positioned controls. Informational `dialog` has no return value. Result-bearing Confirm/Open/Save dialogs create named transient event sources. Paths or answers become persistent only when Patch source explicitly changes state.

Current native mappings include:

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Menu | `HMENU` / `WM_COMMAND` | `NSMenu` / `NSMenuItem` | `GtkMenuBar` / `GtkMenuItem` |
| Info dialog | `MessageBoxW` | `NSAlert` | `GtkMessageDialog` |
| Confirm result | `MessageBoxW` Yes/No | `NSAlert` | `GtkMessageDialog` |
| Open result | `GetOpenFileNameW` | `NSOpenPanel` | `GtkFileChooserDialog` |
| Save result | `GetSaveFileNameW` | `NSSavePanel` | `GtkFileChooserDialog` |

Under `--patch-smoke`, blocking dialogs return deterministic test results so CI cannot wait for user interaction. Normal applications use real OS dialogs.

## Tabs

Tabs remains a real native container:

- Windows: `WC_TABCONTROLW`;
- macOS: `NSTabView`;
- Linux: `GtkNotebook`.

The selected page is transient renderer/toolkit state. It is absent from Patch state and Change History. Child controls retain normal event semantics inside a page.

## Accessibility

The native paths use one deterministic naming contract:

- Input, ComboBox, ListBox, Tabs and Table receive source-derived accessible names when a native visible label is insufficient.
- Radio items include group context such as `Mode: Advanced`.
- Button and Checkbox keep their native visible-label behavior.

Platform APIs are:

- Windows: Microsoft Active Accessibility `IAccPropServices`, read back through `IAccessible`;
- AppKit: accessibility labels;
- GTK3: ATK accessible names.

Direct AOT backend 0.8/0.9 and sealed runtime v1.0 execute platform-API readback smokes. This is an automated implementation baseline, not a WCAG conformance claim or a substitute for manual Narrator, VoiceOver or Orca testing.

## Token-free sealed runtime v1.0 / payload v9

All three current token-free Ready Window builds use the `PCHGUI01` envelope with payload **v9**. Payload v9 preserves the v8 Forms/state/control/menu/dialog/layout contract and adds:

- Table control kind `9`;
- source-backed Table column and row vectors;
- transient Table event type `text-list`;
- Native GUI IR 0.8 Table metadata without persistent list state.

Runtime **v1.0** validates v9 and uses real native Table widgets. It reuses the established v0.9/v0.8 base parser path through a validated internal adapter instead of redefining the old payload. The implementation-only synthetic shadow state used by that adapter is not application-visible Table state.

Runtime releases are:

- `native-win32-runtime-v1.0`;
- `native-linux-runtime-v1.0`;
- `native-macos-runtime-v1.0`.

The sealed-runtime workflow builds each runtime, seals the same Table program, executes the finished application and then repeats the operation through the ordinary offline `patch link` path. The offline compiler matrix additionally proves Table linking on Windows, Linux, Apple Silicon macOS and Intel macOS.

Patch Pages waits for all three v1.0 runtime assets before deploying the browser compiler that consumes payload v9. A release-order race therefore does not publish a mismatched Studio/runtime pair.

Payload **v8** / runtime **v0.9** and payload **v7** / runtime **v0.8** remain explicit compatibility/reproducibility lines.

The macOS browser-sealed app remains unsigned because browser-side sealing modifies the executable after the generic runtime was compiled. Final-artifact Developer ID signing/notarization is separate distribution work.

## Executable evidence

Supported native behavior is covered by independent paths:

1. stable direct AOT base controls;
2. direct AOT Table backend 0.9;
3. sealed compatibility payload v8/runtime v0.9;
4. sealed Table payload v9/runtime v1.0;
5. ordinary offline `patch link` using runtime v1.0;
6. downloadable offline compiler linking Table on Windows/Linux/Apple Silicon/macOS Intel.

The native GUI artifacts do not use Electron, Chromium or Node.js as their GUI runtime. The explicit compatibility package remains separate and labeled as Electron-based.

## Current boundary

Native GUI still does not include Menu separators/shortcuts/checkable or disabled items, ListBox multi-select or nested Tabs. Linux depends on GTK3 system libraries. Manual assistive-technology validation, stable installers, final signing/notarization evidence and FreeBSD native GUI support remain open product work.

None of this changes Change IR 0.10 or expands the current research assurance claims. See `docs/MENUS_DIALOGS.md`, `docs/RESULT_DIALOGS.md`, `docs/RADIO.md`, `docs/TABS.md`, `docs/NATIVE_ACCESSIBILITY.md` and `docs/NATIVE_APPS.md` for related contracts.
