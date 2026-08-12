# Patch Native GUI

Status: **experimental native backend preview, working on Windows, macOS and Linux**

Patch lowers the same source-backed Window syntax into operating-system-native GUI code. Patch source does not import Win32, AppKit or GTK.

Three versioned layers are intentionally separate:

- **Native GUI IR 0.7** is the platform-neutral GUI/event contract.
- **AOT backend 0.8** is the current Win32/AppKit/GTK source-generation layer; 0.8 adds native accessibility naming/readback without changing IR 0.7.
- **sealed payload v7 / runtime v0.7** is the token-free browser-sealing path.

## Build paths

The beginner-facing host-native command remains:

```bash
patch-app myapp.patch
```

It selects the host AOT backend automatically:

```text
Windows -> Win32  -> .exe
macOS   -> AppKit -> .app
Linux   -> GTK3   -> executable
```

Patch Studio also supports token-free browser-side sealing into precompiled native runtime templates. Project-specific remote AOT through GitHub Actions remains a separate optional route.

## Native GUI IR 0.7

```text
.patch source
     |
Patch compiler
     |
Native GUI IR 0.7
     |
 +---+----------------+---+
 |                    |   |
Win32               AppKit GTK3
AOT 0.8             AOT 0.8 AOT 0.8
```

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
- simple state interpolation in supported labels.

Unsupported native behavior fails closed. There is no implicit Electron fallback.

## Menus and dialogs

Menus are Window structure, not positioned controls, so they do not consume source-backed control geometry slots.

```patch
window "Menu demo" as main:
  menu "Help":
    item "About" as about_item

when about_item clicked:
  dialog "About Patch", "Native menus and informational dialogs"
```

Informational `dialog` has no return value. Result-bearing dialogs instead create named **transient event sources**:

```patch
when open_button clicked:
  open file "Open Patch file" as open_result

when open_result chosen:
  change selected_path:
    set = value
```

A result id is not Patch state. Choosing a path does not persist it automatically; only an ordinary semantic `change` does that and enters Change History.

Current native mappings are:

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| Menu | `HMENU` / `WM_COMMAND` | `NSMenu` / `NSMenuItem` | `GtkMenuBar` / `GtkMenuItem` |
| Info dialog | `MessageBoxW` | `NSAlert` | `GtkMessageDialog` |
| Confirm result | `MessageBoxW` Yes/No | `NSAlert` | `GtkMessageDialog` |
| Open result | `GetOpenFileNameW` | `NSOpenPanel` | `GtkFileChooserDialog` |
| Save result | `GetSaveFileNameW` | `NSSavePanel` | `GtkFileChooserDialog` |

Under `--patch-smoke`, blocking dialogs return deterministic test results so CI cannot wait for user interaction. Normal applications use the real OS dialogs.

See `docs/MENUS_DIALOGS.md` and `docs/RESULT_DIALOGS.md` for the detailed event contracts.

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

## AOT backend 0.8 accessibility baseline

AOT backend 0.8 adds a platform-native accessibility naming layer while keeping Native GUI IR at 0.7.

- Input, ComboBox, ListBox and Tabs receive deterministic accessible names derived from static text or a humanized Patch id.
- Radio items include their group context, for example `Mode: Advanced`.
- Button and Checkbox controls retain their native visible-label naming behavior rather than receiving a stale static override.
- Windows writes names through Microsoft Active Accessibility `IAccPropServices` and smoke-reads them through `IAccessible`.
- AppKit uses `setAccessibilityLabel:` and reads `accessibilityLabel` back in smoke mode.
- GTK3 writes and reads the accessible object's ATK name.

The Win32/AppKit/GTK AOT matrix compiles and executes these readback checks. This is an automated implementation baseline, not a WCAG conformance claim or a substitute for Narrator, VoiceOver or Orca testing.

The separate sealed runtime v0.7 implementations do **not yet** carry equivalent explicit accessibility naming/readback. That parity work remains open.

## Token-free sealed runtime v7

All three token-free native GUI builds use the `PCHGUI01` envelope. Payload **v7** carries Forms, state, events, controls, selection option vectors, Tabs parent/page metadata, per-Form menus, informational dialogs and result-bearing Confirm/Open/Save actions/events.

The runtime releases for this stage are:

- `native-win32-runtime-v0.7`
- `native-linux-runtime-v0.7`
- `native-macos-runtime-v0.7`

They are published from `main` only after their native runtime workflows compile, seal and execute the result-dialog progression successfully. Patch Pages pins the exact runtime versions so a payload-v7 browser build is not paired with an incompatible template.

The macOS browser-sealed app remains unsigned because browser-side sealing modifies the executable after the generic runtime was compiled. Final-artifact Developer ID signing/notarization is a separate distribution path.

## Executable evidence

Each supported platform has two independent native paths:

1. project-specific AOT native code generation;
2. generic sealed native runtime reconstruction.

The unified AOT matrix builds and executes Forms, ComboBox, ListBox, Tabs, Radio, Menu/Dialog and Result Dialog examples on Windows, macOS and Linux. The AOT accessibility layer additionally performs platform-API name readback.

Each sealed-runtime workflow separately compiles its generic v0.7 runtime, seals and executes the same GUI progression through Result Dialogs, and verifies payload v7.

The native artifacts do not use Electron, Chromium or Node.js as their GUI runtime.

## Current boundary

Native GUI IR 0.7 / AOT backend 0.8 does not yet include menu separators/shortcuts/checkable or disabled items, table/grid, ListBox multi-select or nested Tabs. Linux still depends on GTK3 system libraries. Sealed-runtime accessibility parity, stable installers, final signing/notarization evidence and FreeBSD native GUI support remain open product work.

None of this work changes Change IR 0.10 or expands the current research assurance claims. See `docs/MENUS_DIALOGS.md`, `docs/RESULT_DIALOGS.md`, `docs/RADIO.md`, `docs/TABS.md` and `docs/NATIVE_ACCESSIBILITY.md` for feature-specific contracts.
