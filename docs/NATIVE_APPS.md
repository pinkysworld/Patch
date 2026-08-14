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

The current native stack intentionally separates its contracts:

- **Native GUI IR 0.7**: platform-neutral Forms/control/event/result contract.
- **AOT backend 0.8**: current Win32/AppKit/GTK code generator with native accessibility naming/readback and responsive Anchor/Dock handling.
- **sealed payload v8 / runtime v0.9**: current token-free browser/offline sealing contract with native accessibility plus runtime-responsive Anchor/Dock layout.
- **sealed payload v7 / runtime v0.8**: frozen compatibility release line retained for reproducibility.

A backend/runtime implementation change therefore does not silently redefine the IR or sealed payload format.

## Responsive Window layout

Visual layout remains source-backed. Patch Studio writes ordinary comments next to controls, for example:

```patch
# @layout anchor left right top
button "Save" as save at 24, 24 size 120, 36

# @layout dock bottom
text "Ready" at 24, 380 size 200, 30
```

The parser continues to treat those directives as comments. The compiler extracts them into a separate Window layout-policy manifest. Persistent application semantics and Change IR stay unchanged.

The same policy is now honored by:

- Standalone Window Web Apps while the browser Form is resized;
- direct Win32/AppKit/GTK AOT apps during native window resizing;
- token-free sealed Win32/AppKit/GTK runtime v0.9 apps using payload v8;
- Window apps linked by the downloadable offline compiler.

Anchor rules preserve the selected margins or stretch a control when opposite edges are anchored. Dock rules support `top`, `bottom`, `left`, `right` and `fill`. Fixed controls remain fixed. Nested Tabs controls keep their existing page-relative placement contract rather than being silently reinterpreted as top-level Form controls.

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
- source-backed Form geometry and responsive Anchor/Dock metadata;
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

Patch source must execute an ordinary semantic `change` to persist a value and create Change History. Runtime layout reflow also does not create Patch state or Change History.

## Native accessibility baseline

Both direct-native paths implement the same deterministic naming contract for otherwise-unlabelled Input, ComboBox, ListBox and Tabs controls and add group context to Radio options. Button/Checkbox native visible-label semantics are preserved.

AOT backend 0.8, sealed runtime 0.8 and the current sealed runtime 0.9 write/read names through the platform accessibility API:

- Windows: Microsoft Active Accessibility `IAccPropServices` / `IAccessible`;
- macOS: AppKit accessibility labels;
- Linux: GTK3/ATK accessible names.

The executable smoke path fails when a platform API exposes a different name from the Patch naming contract. This is an automated engineering baseline, not a WCAG conformance claim. Manual Narrator/VoiceOver/Orca testing remains open.

## Token-free sealed native runtimes

Patch Studio can build native GUI downloads in the browser by sealing checked Native GUI IR into the `PCHGUI01` executable envelope.

Current sealed payload **v8** carries the v7 GUI contract plus two bytes of explicit layout policy per control. The payload contains:

- Forms and simple state;
- ordinary and selection controls;
- source-backed fixed/Anchor/Dock layout policy;
- Tabs page titles and implementation-only parent/page placement metadata;
- per-Form structural menus and MenuItem event sources;
- informational dialogs;
- Confirm/Open/Save actions and their transient result event sources.

The current runtime releases are:

- `native-win32-runtime-v0.9`;
- `native-linux-runtime-v0.9`;
- `native-macos-runtime-v0.9`.

Runtime v0.9 consumes payload v8, preserves the v0.8 accessibility contract and applies the source-backed layout policy during real platform window/content resizing: Win32 `WM_SIZE`, AppKit window-resize notification handling and GTK `size-allocate`.

Payload v7 and runtime v0.8 remain an explicit compatibility/reproducibility line. The compatibility sealer scripts still default to v7 unless a v0.9 workflow explicitly requests v8, so the old runtime release workflows continue to test their original contract.

The v0.9 tags are published from `main` only after Windows/macOS/Linux compile the runtime, seal `responsive-window.patch` with payload v8, execute the normal semantic/accessibility plus responsive smoke and upload the runtime. Pages pins those published v0.9 assets.

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

CI exercises AOT, token-free runtime and offline-linked paths separately.

The unified AOT matrix builds and executes Forms, ComboBox, ListBox, Tabs, Radio, Menu/Dialog and Result Dialog applications on Windows, macOS and Linux. The accessibility layer adds platform-native readback assertions to that executable smoke path. Responsive AOT tests additionally compile the native resize handlers.

The dedicated responsive-runtime workflow independently:

1. compiles the generic Win32/AppKit/GTK runtime v0.9;
2. encodes payload v8;
3. seals `examples/responsive-window.patch`;
4. executes it under `--patch-smoke` on the real target runner/toolkit;
5. checks accessibility behavior inherited from v0.8;
6. checks runtime Anchor/Dock geometry;
7. publishes the three v0.9 runtime assets only after all platform jobs pass.

The offline compiler matrix then downloads those published v0.9 runtimes and proves that its downloadable compiler can link and execute the same responsive Window contract on Windows, Linux, Apple Silicon macOS and Intel macOS. FreeBSD remains Console-only.

Smoke mode suppresses only blocking user interaction. Normal applications use the real OS dialogs.

## Research boundary

Native product GUI work does not make Patch an end-to-end verified compiler and does not expand the current formal fragment. Runtime capture, independent validator/frame reconstruction, parser/extractor correctness, JavaScript-to-Wasm lowering, native toolkit/compiler behavior and the Wasm engine remain explicit trust/proof-free boundaries where applicable.

The beta.32 invocation-frame research evidence remains independently reproducible through `formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean`; native GUI product milestones do not replace or broaden that certificate boundary.

## Remaining product work

The next native stages are versioned separately:

- manual assistive-technology validation;
- Menu separators, shortcuts and source-backed enabled/checked state;
- Table/Grid;
- ListBox multi-selection with an explicit list-valued event contract;
- signing/notarization evidence and install/update packaging;
- more self-contained Linux distribution packaging;
- FreeBSD native GUI support.
