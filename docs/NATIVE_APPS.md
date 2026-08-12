# Application builds

Status: **0.2.0-beta.33** · Change IR **0.10**

Patch keeps Console, direct-native Window, token-free sealed Window and explicit compatibility Window paths separate. Product GUI work does not expand the current research assurance claims.

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

Windows/macOS/Linux ordinary Studio native downloads can use **Ready app download (no token)**. That path seals project-specific Native GUI payload into precompiled runtime templates and does not require a personal GitHub token, Node.js, Rust/Cargo or a local compiler.

The local `patch-app` command instead selects the host AOT toolkit backend and compiles a project-specific native application.

## Versioned native layers

The current native stack intentionally separates three versions:

- **Native GUI IR 0.7**: platform-neutral Forms/control/event/result contract.
- **AOT backend 0.8**: current Win32/AppKit/GTK code generator. Backend 0.8 adds native accessibility naming/readback while retaining IR 0.7.
- **sealed payload v7 / runtime v0.7**: token-free browser-sealing contract.

A backend implementation change therefore does not silently redefine the IR or sealed payload format.

## Direct AOT Window path

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> Native GUI IR 0.7
  -> Win32 / AppKit / GTK3 backend 0.8
  -> finished native application
```

The current native surface includes:

- number/text/Boolean state;
- source-backed Form geometry;
- Text, Button, Input and Checkbox;
- ComboBox and single-selection ListBox;
- grouped Radio;
- Tabs with page-owned controls and transient page selection;
- structural Window menus with named MenuItems;
- informational dialogs with no result value;
- result-bearing Confirm/Open/Save dialogs with named transient result sources;
- Button/MenuItem `clicked`, typed control `changed`, Confirm `confirmed`/`cancelled`, and file `chosen`/`cancelled` events;
- explicit scalar `change` actions;
- named Form `open` / `close` lifecycle.

Current native mappings include:

- ComboBox: Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- ListBox: Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`;
- Radio: Win32 `BS_AUTORADIOBUTTON`, AppKit `NSButtonTypeRadio`, GTK3 `GtkRadioButton`;
- Tabs: Win32 `WC_TABCONTROLW`, AppKit `NSTabView`, GTK3 `GtkNotebook`;
- Menu: Win32 `HMENU`, AppKit `NSMenu`, GTK3 `GtkMenuBar`;
- informational/confirmation dialog: Win32 `MessageBoxW`, AppKit `NSAlert`, GTK3 `GtkMessageDialog`;
- Open/Save: Win32 common file dialogs, AppKit `NSOpenPanel` / `NSSavePanel`, GTK file chooser dialogs.

Unsupported native behavior fails closed during preflight instead of silently dropping UI or switching to Electron.

## Native UI semantics

GUI interaction alone does not persist Patch state.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox/ListBox/Radio `changed` expose transient text `value`.
- MenuItem `clicked` has no value.
- Tabs page selection is renderer/toolkit-local and exposes no Patch event.
- informational `dialog` has no result value.
- Confirm emits `confirmed` or `cancelled`.
- Open/Save emit `chosen` with transient text `value`, or `cancelled`.

Patch source must execute an ordinary semantic `change` to persist a value and create Change History.

## AOT accessibility baseline

Backend 0.8 adds deterministic native accessible names for otherwise-unlabelled Input, ComboBox, ListBox and Tabs controls and adds group context to Radio options. Button/Checkbox native visible-label semantics are preserved.

The AOT smoke path writes and reads those names through the platform accessibility API:

- Windows: Microsoft Active Accessibility `IAccPropServices` / `IAccessible`;
- macOS: AppKit accessibility labels;
- Linux: GTK3/ATK accessible names.

Win32, AppKit and GTK cross-platform CI compiles and executes the readback assertions. This is an automated engineering baseline, not a WCAG conformance claim. Manual Narrator/VoiceOver/Orca testing remains open.

The token-free sealed v0.7 runtimes do **not yet** have equivalent explicit accessibility naming/readback, so overall native accessibility parity is not yet complete.

## Token-free sealed native runtimes

Patch Studio can build native GUI downloads in the browser by sealing checked Native GUI IR into the `PCHGUI01` executable envelope.

Current sealed payload **v7** carries:

- Forms and simple state;
- ordinary and selection controls;
- Tabs page titles and implementation-only parent/page placement metadata;
- per-Form structural menus and MenuItem event sources;
- informational dialogs;
- Confirm/Open/Save actions and their transient result event sources.

The native runtime releases are:

- `native-win32-runtime-v0.7`;
- `native-linux-runtime-v0.7`;
- `native-macos-runtime-v0.7`.

Those tags are published from `main` only after their native runtime workflows compile, seal and execute the GUI progression through `result-dialog-window.patch` and verify payload v7. Pages pins the exact runtime versions.

The macOS browser-sealed bundle remains unsigned because project sealing changes the executable after the generic runtime template was compiled. Final-artifact signing/notarization remains separate distribution work.

## Explicit compatibility Window path

Patch retains the Electron-based compatibility backend as an explicit fallback, not as a silent native fallback.

Compatibility build flow:

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> patch-compiled-window-program 0.2 / Change IR 0.10
  -> sandboxed compatibility runtime
  -> Windows/macOS/Linux application
```

The compatibility runtime template remains **`studio-runtime-v0.6`** with Ready payload **v0.4**. Native GUI IR/payload/backend version changes do not silently redefine that compatibility format.

Where a newer Window node is unsupported by compatibility/Web paths, those targets must fail closed rather than omit it.

## Cross-platform executable evidence

CI exercises AOT and token-free runtime paths separately.

The unified AOT matrix builds and executes Forms, ComboBox, ListBox, Tabs, Radio, Menu/Dialog and Result Dialog applications on Windows, macOS and Linux. The accessibility layer adds platform-native readback assertions to that executable smoke path.

Each sealed-runtime workflow independently:

1. compiles the generic OS runtime v0.7;
2. seals the canonical progression of GUI examples;
3. seals and executes `result-dialog-window.patch`;
4. verifies the real native event/result path under `--patch-smoke`;
5. verifies sealed payload v7.

Smoke mode suppresses only blocking user interaction. Normal applications use the real OS dialogs.

## Research boundary

Native product GUI work does not make Patch an end-to-end verified compiler and does not expand the current formal fragment. Runtime capture, independent validator/frame reconstruction, parser/extractor correctness, JavaScript-to-Wasm lowering, native toolkit/compiler behavior and the Wasm engine remain explicit trust/proof-free boundaries where applicable.

## Remaining product work

The next native stages are versioned separately:

- sealed-runtime accessibility parity with AOT backend 0.8;
- Menu separators, shortcuts and source-backed enabled/checked state;
- Table/Grid;
- ListBox multi-selection with an explicit list-valued event contract;
- signing/notarization evidence and install/update packaging;
- more self-contained Linux distribution packaging;
- FreeBSD native GUI support.
