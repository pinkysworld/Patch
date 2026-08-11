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
  Windows -> recommended native Win32 build; compatibility desktop fallback available
  macOS   -> recommended native AppKit build; compatibility desktop fallback available
  Linux   -> recommended native GTK3 build; compatibility desktop fallback available
  FreeBSD -> not yet supported
```

Windows/macOS/Linux ordinary Studio builds use **Ready app download (no token)**. The direct native path does not require a personal GitHub token, Node.js, Rust/Cargo or a local compiler.

## Direct native Window path

Patch lowers the supported GUI surface once into checked platform-neutral **Native GUI IR v0.4** and then targets the host GUI toolkit.

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> Native GUI IR 0.4
  -> Win32 / AppKit / GTK3 backend
  -> finished native GUI application
```

Current Native GUI IR v0.4 supports:

- simple number/text/Boolean state;
- source-backed Form geometry;
- Text, Button, Input and Checkbox;
- ComboBox and single-selection ListBox with source-backed option arrays;
- real nested Tabs containers with two or more pages;
- Button `clicked` and typed Input/Checkbox/ComboBox/ListBox `changed` events;
- explicit scalar `change` actions;
- named Form `open` / `close` lifecycle.

Native mappings include:

- ComboBox: Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- ListBox: Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`;
- Tabs: Win32 `WC_TABCONTROLW`, AppKit `NSTabView`, GTK3 `GtkNotebook`.

Tabs page selection is transient native UI state. It is not represented as Patch state, is not added to Change History, and Tabs itself exposes no Patch `changed` event. Controls inside a tab page remain normal Patch controls and retain their ordinary event semantics.

Unsupported native behavior still fails closed during Native GUI IR lowering instead of silently omitting UI or switching to Electron.

## Token-free sealed native runtimes

Patch Studio can build native GUI downloads entirely in the browser by sealing checked Native GUI IR payload **v4** into precompiled native runtime templates.

- Windows produces one native Win32 `.exe`.
- Linux produces a GTK3 ELF executable in a ZIP with executable mode preserved.
- macOS produces an unsigned universal AppKit `.app` ZIP with arm64 and x86_64 slices.

Payload v4 is shared across all three native runtimes. It carries Forms, state, ordinary controls, selection option arrays, Tabs page titles, and implementation-only parent/page placement metadata. The currently selected tab page is deliberately not serialized.

The native runtime releases used by Patch Studio are:

- `native-win32-runtime-v0.4`;
- `native-linux-runtime-v0.4`;
- `native-macos-runtime-v0.4`.

The macOS no-token bundle is intentionally unsigned because browser-side sealing modifies the executable after the generic runtime was compiled. Developer ID signing/notarization remains separate packaging work.

## Explicit compatibility Window path

Patch also retains an Electron-based compatibility backend for broader product coverage.

Compatibility build flow:

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> patch-compiled-window-program 0.2 / Change IR 0.10
  -> sandboxed compatibility runtime
  -> Windows/macOS/Linux application
```

Current Ready compatibility payload **v0.4** contains the source-free compiled Window artifact and does not require `main.patch` at application startup.

Compatibility runtime template **`studio-runtime-v0.6`** renders Text, Button, Input, Checkbox, ComboBox, single-selection ListBox and Tabs plus named Form lifecycle. Tabs page selection is held only in renderer-local memory and is not represented as hidden Patch application state.

The compatibility player uses sandboxing, context isolation, strict payload validation and a minimal IPC bridge.

## Tabs

```patch
window "Settings" as main:
  tabs as settings:
    tab "General":
      text "General settings"
    tab "Advanced":
      text "Advanced settings"
```

Tab page selection is transient UI state on Web, compatibility desktop and all three native platforms. It does not create a Change History entry. Controls inside a page remain ordinary controls and can use their normal typed events.

Native GUI IR v0.4 preserves the real page hierarchy. The AOT and sealed native implementations may use `parentTabIndex` and `pageIndex` metadata internally, but this metadata is not Patch state.

## Named Forms and simple lifecycle

Named Forms use beginner-oriented source syntax:

```patch
window "Main" as main:
  button "Settings" as open_settings

window "Settings" as settings:
  button "Close" as close_settings

when open_settings clicked:
  open settings

when close_settings clicked:
  close settings
```

The first named Form starts visible; later named Forms start hidden. `open name` and `close name` modify transient UI visibility only. They do not create persistent Patch state or Change History entries.

## Selection and input semantics

Persistent GUI state never changes merely because a widget changed.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox `changed` exposes transient text `value`.
- single-selection ListBox `changed` exposes transient text `value`.
- Tabs page selection remains transient UI state and has no persistent event value.

Patch source must perform an ordinary semantic `change` to persist widget input/selection values.

## Cross-platform executable tests

CI exercises native and compatibility applications separately.

The unified direct-native matrix compiles, links and executes Forms, ComboBox, ListBox and Tabs applications on Windows, macOS and Linux. Separate sealed-runtime workflows compile each generic platform runtime, seal the same progression including `tabs-window.patch`, execute it, and verify payload v4.

Tabs native smoke coverage does more than check a header: it exercises actual native page switching and nested state-changing controls.

The compatibility Runtime Templates workflow independently builds Windows/macOS/Linux sandboxed desktop templates and smoke-tests source-free compiled payloads on each OS.

## Beta.32 invocation-frame direct-Wasm assurance

Beta.32 remains a separate research layer over the existing direct-Wasm Console backend. It reconstructs concrete invocation frames independently of trusted call-enter/call-exit markers and generates Lean-checkable evidence relating runtime-selected effects to the beta.30 exact call tree.

The canonical single-call evidence is emitted as `GeneratedTransitiveRuntimeCertificate.lean`; repeated identical invocation frames are covered by `GeneratedRepeatedTransitiveRuntimeCertificate.lean`.

This does not make Patch an end-to-end verified compiler. Runtime capture, independent-validator/frame reconstruction, parser/extractor correctness, JavaScript-to-Wasm lowering and the Wasm engine remain explicit trust/proof-free boundaries.

## Portable C99

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD.

## Distribution boundary

Remaining distribution work includes macOS signing/notarization, polished installers and a more portable/self-contained Linux GUI distribution. Remaining richer native GUI work includes radio buttons, menus, dialogs and table/grid controls.
