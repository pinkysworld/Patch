# Patch Native GUI

Status: **experimental native backend preview, working on Windows, macOS and Linux**

Patch lowers the same source-backed Window syntax into operating-system-native GUI code. Patch source does not import Win32, AppKit or GTK.

## Build paths

The beginner-facing native command remains:

```bash
patch-app myapp.patch
```

It selects the host backend automatically:

```text
Windows -> Win32  -> .exe
macOS   -> AppKit -> .app
Linux   -> GTK3   -> executable
```

Patch Studio also supports token-free browser-side sealing into precompiled native runtime templates. Project-specific AOT through GitHub Actions remains available as a separate route.

## Native GUI IR 0.6

```text
.patch source
     |
Patch compiler
     |
Native GUI IR 0.6
     |
 +---+----------------+---+
 |                    |   |
Win32               AppKit GTK3
```

Native GUI IR 0.6 supports:

- literal `number`, `text` and `boolean` state;
- source-backed Form geometry;
- Text, Button, Input and Checkbox;
- ComboBox and single-selection ListBox;
- grouped Radio controls;
- real Tabs containers with page-owned child controls;
- structural Window menus with named menu items;
- informational dialog actions;
- Button/MenuItem `clicked` and typed control `changed` events;
- explicit scalar `change` operations;
- named Form `open` / `close` lifecycle;
- simple state interpolation in supported labels.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Menus and informational dialogs

Menus are Window structure, not positioned controls. They therefore do not consume source-backed control geometry slots.

```patch
window "Menu demo" as main:
  menu "Help":
    item "About" as about_item

when about_item clicked:
  dialog "About Patch", "Native menus and informational dialogs"
```

Menu items expose only `clicked` and carry no event value. Informational `dialog` carries no return value and creates no hidden state or Change History entry.

Native mappings:

| Platform | Menu | Informational dialog |
|---|---|---|
| Windows | `HMENU` / `WM_COMMAND` | `MessageBoxW` |
| macOS | `NSMenu` / `NSMenuItem` | `NSAlert` |
| Linux | `GtkMenuBar` / `GtkMenuItem` | `GtkMessageDialog` |

The native smoke path triggers the real menu event path. Under `--patch-smoke`, a modal dialog is recorded rather than displayed so CI cannot block waiting for a user click.

## Selection semantics

ComboBox, ListBox and Radio share one rule:

```text
native selection -> transient text value -> when <id> changed -> explicit Patch change
```

Selecting a Radio item does not itself mutate persistent Patch state. The selected option becomes event-local text `value`. Only an ordinary Patch `change` persists it and creates Change History.

Radio mappings are:

| Platform | Native control |
|---|---|
| Windows | grouped `BS_AUTORADIOBUTTON` buttons |
| macOS | `NSButton` with `NSButtonTypeRadio` |
| Linux | native `GtkRadioButton` group |

## Tabs

Tabs remains a real native container:

- Windows: `WC_TABCONTROLW` + `TCN_SELCHANGE`
- macOS: `NSTabView` + `NSTabViewItem`
- Linux: `GtkNotebook`

The selected page is transient renderer state. It is absent from Patch state and Change History. Child controls retain their normal event semantics inside a page.

## Token-free sealed runtime v6

All three token-free native builds use the `PCHGUI01` envelope. Payload **v6** carries Forms, state, events, controls, selection option vectors, Tabs parent/page metadata, per-Form menus and informational dialog action kind 4.

The runtime releases for this stage are:

- `native-win32-runtime-v0.6`
- `native-linux-runtime-v0.6`
- `native-macos-runtime-v0.6`

They are published from `main` only after their native runtime workflows compile, seal and execute the Menu/Dialog example successfully. Patch Pages pins the exact release versions so a payload-v6 browser build cannot be paired with an older runtime.

The macOS token-free app remains unsigned because browser-side sealing modifies the executable after the generic runtime was compiled. Signing/notarization is a separate packaging stage.

## Executable evidence

Each supported platform has two independent native paths:

1. project-specific AOT native code generation;
2. generic sealed native runtime reconstruction.

The unified AOT matrix builds and executes Forms, ComboBox, ListBox, Tabs, Radio and Menu/Dialog on Windows, macOS and Linux. Each sealed runtime workflow separately seals and executes the Menu/Dialog application and verifies payload v6.

The native artifacts do not use Electron, Chromium or Node.js as their GUI runtime.

## Current boundary

Native GUI 0.6 does not yet include result-bearing confirm/open/save dialogs, menu separators/shortcuts/checkable or disabled items, table/grid, ListBox multi-select or nested Tabs. Linux still depends on GTK3 system libraries, and the browser-sealed macOS app is unsigned.

None of this work changes Change IR 0.10 or the beta.32 research assurance claims. See `docs/MENUS_DIALOGS.md`, `docs/RADIO.md` and `docs/TABS.md` for the feature-specific contracts.
