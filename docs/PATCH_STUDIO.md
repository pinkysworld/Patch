# Patch Studio

Patch Studio is the browser-first IDE for Patch. The product goal is QuickBASIC/Visual-Basic/Delphi-style immediacy with one readable Patch source format across browser and desktop targets.

## What works in 0.2 beta.32

Patch Studio provides source editing/local autosave, Console and Window Run, a source-backed visual Designer, named Forms, drag/resize layout, Text/Button/Input/Checkbox/ComboBox/ListBox controls, Change Contract/IR views, portable `.patchapp`, Web/Wasm builds, Windows/macOS/Linux Console and Window builds, and FreeBSD Console through portable C99.

For Windows, macOS and Linux the default desktop workflow is **Ready app download (no token)**. No personal GitHub token, Node.js, Rust/Cargo or local compiler is required.

Change IR **0.10** is unchanged. Beta.32 is a research assurance extension and does not alter normal Studio runtime semantics. Form geometry, Form visibility and widget selection are UI/runtime structure rather than new persistent-mutation semantics claims.

## Beta.32 invocation-frame assurance

The ordinary Studio does not need Lean or expose beta.32 proof machinery. The research artifact uses the same direct-Wasm compiler/runtime path exercised by Console programs, then performs offline/CI correspondence validation.

The direct-Wasm backend emits no trusted call-enter/call-exit markers. The independent Change-IR validator reconstructs concrete invocation frames containing caller/callee identity, dynamic invocation ordinal, parent/depth information, exact arguments/bindings and transition ranges.

For each accepted beta.30 call witness, beta.32 selects observed effects by concrete frame identity. `GeneratedTransitiveRuntimeCertificate.lean` records the canonical transitive case and `GeneratedRepeatedTransitiveRuntimeCertificate.lean` records repeated identical-call evidence. Generated Lean evidence checks the independently reconstructed frame binding equals the beta.30 exact callee binding and re-evaluates frame-selected observed semantic effects against the exact call tree.

Runtime capture and independent-validator/invocation-frame reconstruction correctness remain explicit proof-free boundaries.

## Forms and source-backed Designer

Forms and controls remain ordinary Patch source:

```patch
create boolean subscribed = false
create text size = "Medium"
create text fruit = "Banana"

window "Preferences" as main size 640, 420:
  text "Preferences" at 24, 24 size 220, 30
  checkbox "Receive updates" as subscribed at 24, 72 size 220, 36
  combo "Small", "Medium", "Large" as size at 24, 124 size 220, 36
  listbox "Apple", "Banana", "Cherry", "Mango" as fruit at 280, 72 size 220, 120
```

In Studio you can:

- select the active Form and create additional Forms with **+ Form**;
- edit Form name, title, width and height;
- add Text, Button, Input, Checkbox, ComboBox and ListBox controls;
- edit source-backed ids, labels and option expressions where applicable;
- edit X/Y/width/height;
- drag a selected control directly on the Form;
- resize it from the bottom-right handle;
- delete a control and its matching event block;
- jump from the inspector to the exact source declaration.

Every visual edit rewrites `main.patch`. There is no hidden `.dfm`, `.frm` or second persistent form document.

## Named Forms

A Form only needs a short name after `as` if it should be opened or closed by the application:

```patch
window "Main" as main size 560, 340:
  button "Settings" as open_settings at 24, 72 size 120, 36

window "Settings" as settings size 480, 300:
  button "Close" as close_settings at 24, 124 size 100, 36

when open_settings clicked:
  open settings

when close_settings clicked:
  close settings
```

The first named Form starts visible. Additional named Forms start hidden until `open <name>`. `close <name>` hides them again. Form visibility is transient UI lifecycle and does not create Change History entries.

## Typed transient GUI values

GUI interaction does not implicitly persist state. Controls expose transient event-local `value`; persistent state changes only if Patch source executes an ordinary semantic `change`.

Checkbox exposes Boolean `value`:

```patch
when subscribed changed:
  change subscribed:
    set = value
```

Input, ComboBox and single-selection ListBox expose text `value`:

```patch
when fruit changed:
  change fruit:
    set = value
```

A handler may inspect `value` without storing it. The Window event adapter rejects a value with the wrong event type.

ListBox is intentionally single-selection in this stage. Multi-selection will require an explicit list-valued event contract rather than overloading the text contract.

## Standalone Window Web

Standalone Window Web runtime **v0.7** supports the current Form lifecycle plus Text, Button, Input, Checkbox, ComboBox and ListBox. ComboBox and ListBox preserve source-backed option expressions and dispatch text selection values through the same event path used by Studio.

## Direct native desktop path

Native GUI IR **v0.2** is the checked platform-neutral contract used by the recommended native Window build path.

Current direct-native mappings include:

- Text/Button/Input/Checkbox on Win32, AppKit and GTK3;
- ComboBox as Win32 `COMBOBOX`, AppKit `NSPopUpButton` and GTK3 `GtkComboBoxText`;
- named Form open/close lifecycle;
- typed changed values and explicit semantic changes.

Token-free Studio builds use precompiled native runtime templates with checked sealed payload **v2**:

- Windows: one native Win32 `.exe`;
- Linux: native GTK3 ELF executable in a ZIP;
- macOS: unsigned universal AppKit `.app` ZIP with arm64 and x86_64 slices.

ListBox is **not yet in Native GUI IR v0.2**. A project containing ListBox fails closed during native preflight instead of silently dropping the control or silently switching to Electron.

The macOS no-token app remains unsigned because sealing the project payload changes the executable after the generic runtime is compiled. Signing/notarization is a separate packaging milestone.

## Explicit compatibility desktop path

Patch retains an Electron-based compatibility backend as an explicit fallback, not the recommended native Window path.

Compatibility desktop builds consume a source-free `patch-compiled-window-program` **v0.2** artifact carrying Change IR 0.10 and source-backed Form layout. The Ready compatibility payload format remains **v0.4**.

Compatibility runtime template **`studio-runtime-v0.5`** renders Text, Button, Input, Checkbox, ComboBox and ListBox plus named Form lifecycle. v0.5 specifically closes the older renderer gap where ComboBox could pass shared validation but be omitted by the compatibility UI.

The compatibility runtime remains sandboxed and does not reparse `main.patch` for current compiled payloads.

## Build matrix

```text
Windows App (.exe)   Console or Window   ready download
macOS App (.app)     Console or Window   ready download
Linux App            Console or Window   ready download
FreeBSD Console      Console only        portable C99 path
Standalone Web App   Console or Window   browser-local build
```

For Window projects, the recommended path is direct native when the program fits Native GUI IR v0.2. Unsupported native controls fail closed. The explicit compatibility mode covers the broader Studio/Web control surface while native parity is extended.

## PWA updates

The beta.32 ListBox cache key begins with `patch-studio-0.2-beta.32-forms5`. Large OS runtime assets remain on demand rather than part of the core offline cache.

## Source remains truth

The `.patch` file remains the reviewable representation of behavior and GUI structure. Form names, dimensions, control geometry, labels and selection options live in that same source. Compiled Window artifacts and Native GUI IR are derived build products, not second editable models.

## Next work

Product priorities include native ListBox parity, radio buttons, tabs, menus, dialogs, table/grid, project tree/source files, alignment guides, anchors/docking, multi-select, project import/export, signing/notarization and a more portable Linux distribution bundle.

Research priorities remain controlled overhead measurements, systematic related work, a broader application/security corpus, reproducibility, and further reduction of parser/lowering/runtime trust boundaries without overstating full verification.
