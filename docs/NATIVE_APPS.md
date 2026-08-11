# Application builds

Status: **0.2.0-beta.32** · Change IR **0.10**

Patch keeps Console, direct-native Window and explicit compatibility Window paths separate. Product GUI work does not expand the beta.32 research assurance claims.

## Build matrix

```text
Console
  Web     -> direct Patch Wasm + browser host
  Windows -> project-named sealed .exe
  macOS   -> project-named sealed .app
  Linux   -> project-named sealed executable
  FreeBSD -> portable C99 + native cc

Window / GUI
  Web     -> Standalone Window Web App v0.8
  Windows -> recommended native Win32 build; compatibility fallback available
  macOS   -> recommended native AppKit build; compatibility fallback available
  Linux   -> recommended native GTK3 build; compatibility fallback available
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio builds use **Ready app download (no token)**. The direct native path does not require a personal GitHub token, Node.js, Rust/Cargo or a local compiler.

## Direct native Window path

Patch lowers supported source once into checked platform-neutral **Native GUI IR 0.6** and then targets the host GUI toolkit.

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> Native GUI IR 0.6
  -> Win32 / AppKit / GTK3
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
- Button/MenuItem `clicked` and typed control `changed` events;
- explicit scalar `change` actions;
- named Form `open` / `close` lifecycle.

Current native mappings include:

- ComboBox: Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- ListBox: Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`;
- Radio: Win32 `BS_AUTORADIOBUTTON`, AppKit `NSButtonTypeRadio`, GTK3 `GtkRadioButton`;
- Tabs: Win32 `WC_TABCONTROLW`, AppKit `NSTabView`, GTK3 `GtkNotebook`;
- Menu: Win32 `HMENU`, AppKit `NSMenu`, GTK3 `GtkMenuBar`;
- informational dialog: Win32 `MessageBoxW`, AppKit `NSAlert`, GTK3 `GtkMessageDialog`.

Unsupported native behavior fails closed during preflight instead of silently dropping UI or switching to Electron.

## Native UI semantics

GUI interaction alone does not persist Patch state.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox/ListBox/Radio `changed` expose transient text `value`.
- MenuItem `clicked` has no value.
- Tabs page selection is renderer/toolkit-local and exposes no Patch event.
- informational `dialog` has no result value.

Patch source must execute an ordinary semantic `change` to persist a value and create Change History.

## Token-free sealed native runtimes

Patch Studio can build native GUI downloads in the browser by sealing checked Native GUI IR into the `PCHGUI01` executable envelope.

Current sealed payload **v6** carries:

- Forms and simple state;
- flat ordinary controls;
- selection option arrays;
- Tabs page titles and implementation-only parent/page placement metadata;
- per-Form structural menus;
- MenuItem event sources;
- informational dialog action kind 4.

The native runtime releases for this stage are:

- `native-win32-runtime-v0.6`;
- `native-linux-runtime-v0.6`;
- `native-macos-runtime-v0.6`.

Those tags are published from `main` only after their native runtime workflows compile, seal and execute the v6 Menu/Dialog smoke successfully. Pages pins the exact versions.

The macOS browser-sealed bundle remains unsigned because project sealing changes the executable after the generic runtime template was compiled. Signing/notarization remains separate packaging work.

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

The compatibility runtime template remains **`studio-runtime-v0.6`** with Ready payload **v0.4**. Native GUI IR/payload version changes do not silently redefine that compatibility format.

Menu/Dialog support is a direct-native feature in this stage. Compatibility/Web paths must fail closed where a new node is unsupported rather than omit it.

## Cross-platform executable evidence

CI exercises native AOT and token-free runtime paths separately.

The unified native matrix builds and executes Forms, ComboBox, ListBox, Tabs, Radio and Menu/Dialog applications on Windows, macOS and Linux. Individual Win32/AppKit/GTK workflows also build the Menu/Dialog example directly.

Each sealed-runtime workflow independently:

1. compiles the generic OS runtime;
2. seals the canonical progression of GUI examples;
3. seals `menu-dialog-window.patch`;
4. executes it through the actual native MenuItem event path under `--patch-smoke`;
5. verifies payload v6.

Smoke mode suppresses only the blocking modal presentation. It records the dialog title/message after the real menu event dispatch. Normal applications use the real OS dialog.

## Research boundary

Beta.32 remains a separate invocation-frame-aware direct-Wasm research layer. Native product GUI work does not make Patch an end-to-end verified compiler and does not expand the beta.32 formal fragment.

Runtime capture, independent validator/frame reconstruction, parser/extractor correctness, JavaScript-to-Wasm lowering and the Wasm engine remain explicit trust/proof-free boundaries.

## Remaining product work

The next native stages are intentionally versioned separately:

- result-bearing Confirm/Open/Save dialogs with explicit transient result events;
- Menu separators, shortcuts and source-backed enabled/checked state;
- Table/Grid;
- ListBox multi-selection with an explicit list-valued event contract;
- signing/notarization/installers;
- more self-contained Linux distribution packaging.
