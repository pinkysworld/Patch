# Application builds

Status: **0.2.0-beta.34** · Change IR **0.10**

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

The local `patch-app` command and optional AOT cloud path instead compile a project-specific native application with the host toolkit backend.

## Versioned native layers

The native stack deliberately keeps semantic, generator and sealed-runtime contracts separate:

- **Native GUI IR 0.7**: stable base control surface for Forms, Text/Button/Input/Checkbox, ComboBox/ListBox/Radio, Tabs, menus and dialogs.
- **Native GUI IR 0.8**: Table extension carrying source-backed columns/rows and transient `text-list` Table `changed` events without adding persistent native list state.
- **AOT backend 0.8**: stable Win32/AppKit/GTK generator for Native GUI IR 0.7 with accessibility and responsive Anchor/Dock handling.
- **AOT backend 0.9**: direct Table extension using real native Table widgets on Win32/AppKit/GTK while retaining the v0.8 accessibility and responsive layout behavior.
- **sealed payload v9 / runtime v1.0**: current token-free Ready/offline Window contract. It carries Native GUI IR 0.8 Table columns/rows, transient `text-list` event typing and the v8 responsive layout metadata.
- **sealed payload v8 / runtime v0.9**: frozen responsive compatibility line for the Native GUI IR 0.7 control surface.
- **sealed payload v7 / runtime v0.8**: older frozen compatibility/reproducibility line.

A runtime or backend version therefore does not silently redefine an older payload or IR format.

## Responsive Window layout

Visual layout remains source-backed. Patch Studio writes ordinary comments next to controls, for example:

```patch
# @layout anchor left right top
button "Save" as save at 24, 24 size 120, 36

# @layout dock bottom
text "Ready" at 24, 380 size 200, 30
```

The parser still treats these as comments. The compiler extracts them into Window layout metadata; persistent application semantics and Change IR stay unchanged.

The same policy is honored by Standalone Web, direct Win32/AppKit/GTK AOT, direct AOT Table backend 0.9, token-free sealed runtime v1.0 and supported Window apps linked by the downloadable offline compiler. Anchor rules preserve selected margins or stretch a control when opposite edges are anchored. Dock supports `top`, `bottom`, `left`, `right` and `fill`.

## Direct AOT Window path

Stable controls use:

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> Native GUI IR 0.7
  -> Win32 / AppKit / GTK3 backend 0.8
  -> finished native application
```

Table uses:

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> Native GUI IR 0.8
  -> Win32 / AppKit / GTK3 backend 0.9
  -> finished native application
```

Native Table mappings are:

- Win32: report-mode `WC_LISTVIEWW`;
- AppKit: multi-column `NSTableView` inside `NSScrollView`;
- GTK3: `GtkTreeView` + `GtkListStore` inside `GtkScrolledWindow`.

The dedicated direct-AOT Table workflow compiles and executes the same Table example on Windows/MSVC, macOS/AppKit and Linux/GTK3 and checks columns, rows, native selection dispatch, accessibility and responsive layout.

## Native UI semantics

GUI interaction alone does not persist Patch state.

- Input `changed` exposes transient text `value`.
- Checkbox `changed` exposes transient Boolean `value`.
- ComboBox/ListBox/Radio `changed` expose transient text `value`.
- Table `changed` exposes the selected row as transient list-valued `value` in Studio App Preview, Standalone Web, direct AOT backend 0.9, sealed Ready runtime v1.0 and supported offline-linked Window apps.
- MenuItem `clicked` has no value.
- Tabs page selection is renderer/toolkit-local and exposes no Patch event.
- Confirm emits `confirmed` or `cancelled`.
- Open/Save emit `chosen` with transient text `value`, or `cancelled`.

Patch source must execute an ordinary semantic `change` to persist a value and create Change History. Runtime layout reflow likewise creates no Patch state or history. Native GUI IR 0.8 and payload v9 do not introduce persistent list state merely because a Table event carries a row list.

## Table support matrix

| Surface | Table display | Row selection / `changed` | Status |
| --- | --- | --- | --- |
| Designer | yes | Designer selection only | implemented |
| Standalone Web | yes | transient row list | implemented |
| Studio App preview | yes | transient row list through shared Window event adapter | implemented |
| Direct Win32 AOT | `WC_LISTVIEWW` | transient row list | backend 0.9 smoke-tested |
| Direct AppKit AOT | `NSTableView` | transient row list | backend 0.9 smoke-tested |
| Direct GTK3 AOT | `GtkTreeView` | transient row list | backend 0.9 smoke-tested |
| Token-free sealed Ready app | real native Table | transient row list | payload v9/runtime v1.0 smoke-tested |
| Offline `patch link` Window | real native Table | transient row list | payload v9/runtime v1.0 smoke-tested |
| FreeBSD Window | no | no | unsupported |

## Token-free sealed native runtimes

Patch Studio builds native GUI downloads in the browser by sealing checked Native GUI IR into the `PCHGUI01` executable envelope.

### Payload v9 / runtime v1.0

Current Ready Window builds use **payload v9** and **runtime v1.0** on Windows, macOS and Linux. Payload v9 preserves the v8 state/Form/menu/dialog/layout contract and adds:

- Table control kind `9`;
- source-backed Table columns and rows;
- transient Table event value type `text-list`;
- Native GUI IR 0.8 Table metadata alongside the existing responsive Anchor/Dock policy.

Runtime v1.0 validates payload v9 and keeps Table selection renderer/toolkit-local. It reuses the established v0.9/v0.8 base parser path through a validated internal adapter, while the visible Table itself is a real platform widget. The adapter's synthetic shadow state is implementation-only and is not application-visible persistent Table state.

The v1.0 runtime release tags are:

- `native-win32-runtime-v1.0`;
- `native-linux-runtime-v1.0`;
- `native-macos-runtime-v1.0`.

The dedicated **Patch Native Sealed Table Runtime** matrix builds each runtime from source, seals `examples/table-native-v09.patch` as payload v9, runs the finished application and separately runs the normal `patch link` path against the same runtime. Windows, macOS and Linux all execute real row-selection smokes.

Pages waits until all three v1.0 release assets exist before deploying the Studio version that consumes them. If the initial source push reaches Pages first, that deployment exits successfully without replacing the current site; successful runtime publication triggers the later deployment. This avoids a browser-compiler/runtime mismatch and avoids turning release ordering into a failing Pages run.

### Beta.34 runtime-template integrity

The browser Ready path now verifies the native runtime bytes before sealing a project into them.

During Pages deployment:

1. GitHub Release supplies each exact runtime-v1.0 asset and its recorded `sha256:` digest.
2. `scripts/runtime-integrity-manifest.js` independently hashes the downloaded bytes and fails when they do not match that release digest.
3. Pages writes `runtimes/runtime-manifest.json` containing only the verified runtime file name, release tag and SHA-256 digest.

In Patch Studio, `web/runtime-integrity.js` intercepts only the three same-origin native runtime-template fetches. It fetches the runtime manifest with `no-store`, hashes the runtime bytes using Web Crypto SHA-256 and fails closed on mismatch before `native-build.js` receives those bytes.

The service worker treats all same-origin `/runtimes/` requests as fresh-first while online, including the manifest and native `.exe`/`.bin` templates. Successful responses remain available as offline fallback.

This validates byte consistency across the existing GitHub Release -> Pages -> browser path. It does not claim Authenticode, Developer ID/notarization, an independent transparency log or a separate signing trust root.

### Compatibility lines

Payload **v8** / runtime **v0.9** remains the frozen responsive Native GUI IR 0.7 line. Payload **v7** / runtime **v0.8** remains the older compatibility/reproducibility line. Existing workflows continue to exercise those contracts independently.

The macOS browser-sealed bundle remains unsigned because project sealing changes the executable after the generic runtime template was compiled. Final-artifact Developer ID signing/notarization remains separate distribution work.

## Offline compiler

The Windows, Linux, Apple Silicon macOS and Intel macOS offline compiler paths embed or package native Window runtime v1.0. The compiler lowers Window projects through Native GUI IR 0.8 and seals payload v9 locally. Its platform matrix links and executes:

1. a Console application;
2. a responsive Window application;
3. the Table/Grid example with native row-selection smoke.

The Intel macOS kit bundles its own Intel Node runtime for the CLI. FreeBSD remains Console-only through portable C99 + local `cc`.

The rolling `offline-compiler-v0.1` release publishes a `SHA256SUMS` file beside its platform assets. The public Downloads page documents verification commands and explicitly separates checksum integrity from platform code-signing/notarization claims.

## Native accessibility baseline

The direct and sealed native paths implement deterministic naming for otherwise-unlabelled Input, ComboBox, ListBox and Tabs controls and add group context to Radio options. Table backend 0.9 and sealed runtime v1.0 assign the source-derived accessible Table name while keeping real native table/grid semantics.

- Windows: Microsoft Active Accessibility `IAccPropServices` / `IAccessible`;
- macOS: AppKit accessibility labels;
- Linux: GTK3/ATK accessible names.

Executable smokes fail when the platform API exposes a different name from the Patch naming contract. This is an automated engineering baseline, not a WCAG conformance claim. Manual Narrator/VoiceOver/Orca testing remains open.

## Explicit compatibility Window path

Patch retains the Electron-based compatibility backend as an explicit fallback, not as a silent native fallback:

```text
.patch source
  -> Patch parser/compiler
  -> Window support validation
  -> patch-compiled-window-program 0.2 / Change IR 0.10
  -> sandboxed compatibility runtime
  -> Windows/macOS/Linux application
```

The compatibility runtime template remains **`studio-runtime-v0.6`** with Ready payload **v0.4**. Native GUI IR/payload/backend evolution does not redefine that format.

## Cross-platform executable evidence

CI exercises the major paths separately:

- stable AOT backend 0.8 / Native GUI IR 0.7;
- direct Table AOT backend 0.9 / Native GUI IR 0.8;
- sealed responsive compatibility payload v8/runtime v0.9;
- sealed Table payload v9/runtime v1.0;
- ordinary offline `patch link` using runtime v1.0;
- downloadable offline compiler matrices including Table linking on Windows, Linux, Apple Silicon macOS and Intel macOS.

Smoke mode suppresses only blocking user interaction. Normal applications use the real OS dialogs.

## Research boundary

Native product GUI work does not make Patch an end-to-end verified compiler and does not expand the current formal fragment. Runtime capture, independent validator/frame reconstruction, parser/extractor correctness, JavaScript-to-Wasm lowering, native toolkit/compiler behavior and the Wasm engine remain explicit trust/proof-free boundaries where applicable.

The beta.32 invocation-frame research evidence remains independently reproducible through `formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean`; native GUI product milestones do not replace or broaden that certificate boundary.

## Remaining product work

The next native stages include:

- manual assistive-technology validation;
- Menu separators, shortcuts and source-backed enabled/checked state;
- ListBox multi-selection with an explicit list-valued event contract;
- signing/notarization evidence and install/update packaging;
- broader installer/update integrity verification once those channels exist;
- more self-contained Linux distribution packaging;
- FreeBSD native GUI support.
