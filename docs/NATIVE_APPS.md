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

Patch lowers the supported GUI surface once into checked platform-neutral **Native GUI IR v0.3** and then targets the host GUI toolkit.

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> Native GUI IR 0.3
  -> Win32 / AppKit / GTK3 backend
  -> finished native GUI application
```

Current Native GUI IR v0.3 supports:

- simple number/text/Boolean state;
- source-backed Form geometry;
- Text, Button, Input and Checkbox;
- ComboBox and single-selection ListBox with source-backed option arrays;
- Button `clicked` and typed Input/Checkbox/ComboBox/ListBox `changed` events;
- explicit scalar `change` actions;
- named Form `open` / `close` lifecycle.

Selection controls map to native widgets on all three platforms:

- ComboBox: Win32 `COMBOBOX`, AppKit `NSPopUpButton`, GTK3 `GtkComboBoxText`;
- ListBox: Win32 `LISTBOX`, AppKit `NSTableView`, GTK3 `GtkListBox`.

Unsupported native behavior fails closed during Native GUI IR lowering. **Tabs is not yet native in v0.3**, so a direct native build containing Tabs stops instead of silently omitting it or switching to Electron.

## Token-free sealed native runtimes

Patch Studio can build native GUI downloads entirely in the browser by sealing checked Native GUI IR payload **v3** into precompiled native runtime templates.

- Windows produces one native Win32 `.exe`.
- Linux produces a GTK3 ELF executable in a ZIP with executable mode preserved.
- macOS produces an unsigned universal AppKit `.app` ZIP with arm64 and x86_64 slices.

The sealed payload format is shared across the three native runtimes. ComboBox/ListBox option arrays and typed selection events are encoded in payload v3.

The macOS no-token bundle is intentionally unsigned because browser-side sealing modifies the executable after the generic runtime was compiled. Developer ID signing/notarization remains separate packaging work.

## Explicit compatibility Window path

Patch also retains an Electron-based compatibility backend for features not yet covered by Native GUI IR.

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

## Tabs Stage 1

Tabs is currently supported in Patch Studio, Standalone Window Web v0.8 and the explicit compatibility desktop runtime:

```patch
window "Settings" as main:
  tabs as settings:
    tab "General":
      text "General settings"
    tab "Advanced":
      text "Advanced settings"
```

Tab page selection is transient UI state. It does not create a Change History entry and Tabs does not expose a Patch event in Stage 1. Controls inside a page remain ordinary controls and can use their normal typed events.

Direct-native builds fail closed on Tabs until a versioned Native GUI container contract is implemented.

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
- Tabs page selection has no persistent event value in Stage 1.

Patch source must perform an ordinary semantic `change` to persist widget input/selection values.

## Cross-platform executable tests

CI exercises native and compatibility applications separately.

Direct-native gates compile/link and execute real Win32, AppKit and GTK3 programs. Native GUI v0.3 ListBox is executed through the unified three-OS AOT matrix and through all three sealed-runtime workflows.

The compatibility Runtime Templates workflow builds the Windows/macOS/Linux sandboxed desktop templates and smoke-tests source-free compiled named-Form payloads on each OS. Source-level regression tests require the compatibility renderer to contain real ComboBox/ListBox/Tabs branches so those UI structures cannot regress to silent omission.

## Beta.32 invocation-frame direct-Wasm assurance

Beta.32 remains a separate research layer over the existing direct-Wasm Console backend. It reconstructs concrete invocation frames independently of trusted call-enter/call-exit markers and generates Lean-checkable evidence relating runtime-selected effects to the beta.30 exact call tree.

The canonical single-call evidence is emitted as `GeneratedTransitiveRuntimeCertificate.lean`; repeated identical invocation frames are covered by `GeneratedRepeatedTransitiveRuntimeCertificate.lean`.

This does not make Patch an end-to-end verified compiler. Runtime capture, independent-validator/frame reconstruction, parser/extractor correctness, JavaScript-to-Wasm lowering and the Wasm engine remain explicit trust/proof-free boundaries.

## Portable C99

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD.

## Distribution boundary

Remaining distribution work includes macOS signing/notarization, polished installers and a more portable/self-contained Linux GUI distribution. Remaining native GUI parity includes Tabs, radio buttons, menus, dialogs and table/grid.
