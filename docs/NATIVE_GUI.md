# Patch Native GUI

Status: **experimental native backend preview, working on Windows, macOS and Linux**

Patch lowers the same source-backed Forms syntax used by Patch Studio into operating-system-native GUI code. User-facing Patch syntax is independent of Win32, AppKit and GTK.

## One simple build command

After installing Patch, a GUI program can use:

```bash
patch-app myapp.patch
```

Patch selects the backend from the host operating system:

```text
Windows  -> Win32  -> .exe
macOS    -> AppKit -> .app
Linux    -> GTK3   -> ELF executable
```

Optional arguments are only needed for a custom name or output folder:

```bash
patch-app myapp.patch MyApp dist-native
```

The backend names are implementation details. Normal Patch programs do not import or mention Win32, Cocoa/AppKit or GTK.

## Patch Studio native builds

Patch Studio exposes the same direct native GUI contract without changing Patch source:

- **Windows Window / GUI:** the recommended no-token path compiles Native GUI IR in the browser and seals it into the prebuilt native Win32 runtime, producing one `.exe`. An optional GitHub Actions route performs project-specific MSVC AOT code generation.
- **Linux Window / GUI:** the recommended no-token path compiles the same Native GUI IR in the browser and seals it into a prebuilt native GTK3 ELF runtime. Studio downloads a ZIP containing one executable with its Unix executable mode preserved. An optional GitHub Actions route performs project-specific g++ AOT code generation.
- **macOS Window / GUI:** the recommended no-token path compiles the same Native GUI IR in the browser, seals it into a universal AppKit Mach-O runtime containing `arm64` and `x86_64` slices, and creates a minimal `.app` bundle ZIP. An optional GitHub Actions route performs project-specific clang AOT code generation.

All three sealed-runtime builds use the same `PCHGUI01` envelope. Native GUI payload **version 4** carries Forms, controls, state, events, change actions, selection-option arrays and Tabs hierarchy metadata in one platform-neutral binary contract. The platform runtime differs, but Patch semantics are encoded once.

The token-free macOS bundle is intentionally **unsigned**. Studio appends the project payload in the browser, which changes the executable after the runtime template was compiled and would invalidate a pre-existing Apple code signature. Gatekeeper may therefore require Control-click -> Open on first launch. Signing/notarization remains a separate packaging stage.

## Native GUI IR 0.4

```text
.patch source
     |
Patch compiler
     |
validated Native GUI IR 0.4
     |
     +-------------------+------------------+
     |                   |                  |
 Win32 C++          AppKit ObjC++        GTK3 C++
     |                   |                  |
   MSVC             clang + Cocoa       g++ + GTK
     |                   |                  |
Windows .exe          macOS .app        Linux ELF
```

For token-free Studio builds:

```text
Native GUI IR 0.4 -> PCHGUI01 payload v4 -> native runtime template -> user download
                              |                       |
                              +-- same contract ------+
                               Windows / macOS / Linux
```

Native GUI IR is the platform-neutral contract. Backends fail closed when source uses behavior the current native subset cannot lower faithfully. Patch does not silently switch an unsupported native build back to Electron.

Native GUI IR 0.4 currently supports:

- simple `number`, `text` and `boolean` persistent state with literal initial values;
- source-backed Form size and top-level control geometry;
- Text, Button, Input, Checkbox, ComboBox, ListBox and Tabs controls;
- Button `clicked` and Input/Checkbox/ComboBox/ListBox `changed` events;
- scalar `change` operations supported for the target type;
- typed event-local `value`;
- named Form `open` / `close` lifecycle;
- simple `{state}` interpolation in Text/Button/Checkbox labels;
- quoted text-literal ComboBox/ListBox options;
- Tabs with two or more source-backed pages and flow-layout child controls.

Unsupported event behavior, object/thing state, unsupported expressions, nested Tabs or unsupported mutations stop native lowering with a clear error rather than being silently omitted.

## Selection controls

ComboBox and ListBox share one semantic rule:

```text
native selection -> transient text value -> when <id> changed -> explicit Patch change
```

Platform mappings are:

| Patch | Win32 | AppKit | GTK3 |
|---|---|---|---|
| ComboBox | `COMBOBOX` / `CBN_SELCHANGE` | `NSPopUpButton` | `GtkComboBoxText` |
| ListBox | `LISTBOX` / `LBN_SELCHANGE` | `NSTableView` in `NSScrollView` | `GtkListBox` |

Refresh maps persistent Patch text state back to the selected native option. Selection alone does not create hidden persistent mutation.

## Tabs parity

Tabs is a real native container in Native GUI IR 0.4, not a dressed-up selection control. The neutral IR keeps the page hierarchy and its ordinary child controls. Backends may flatten native handles internally with `parentTabIndex` and `pageIndex` placement metadata, but those fields are backend/runtime metadata only.

Platform mappings are:

- **Win32:** `WC_TABCONTROLW` with `TCN_SELCHANGE` and Windows common controls;
- **AppKit:** `NSTabView` with `NSTabViewItem` page views;
- **GTK3:** `GtkNotebook` with a native page container per Patch tab page.

The selected page is deliberately **not Patch state**. It is transient platform UI state and therefore:

- switching pages does not create a Change History entry;
- Tabs itself exposes no Patch `changed` event in this stage;
- no selected-page value is serialized into payload v4;
- controls inside pages still use their ordinary Button/Input/Checkbox/ComboBox/ListBox event semantics;
- persistent application state still changes only through explicit Patch `change` blocks.

Example:

```patch
create text name = "Mia"
create boolean notifications = false

window "Settings" as main size 620, 380:
  tabs as settings at 24, 24 size 540, 280:
    tab "General":
      text "Welcome {name}"
      input name
    tab "Advanced":
      checkbox "Notifications" as notifications
      button "Reset name" as reset_name

when name changed:
  change name:
    set = value

when notifications changed:
  change notifications:
    set = value
```

## Windows: direct Win32 and sealed runtime

The Windows AOT backend emits C++17 using native `HWND` Forms and Windows controls. Tabs uses the Windows common-controls tab class and the normal `WM_NOTIFY` path. Nested controls remain ordinary HWND controls; visibility follows the transient selected page. MSVC links `/SUBSYSTEM:WINDOWS` with the C/C++ runtime statically linked using `/MT` and links `comctl32` for Tabs.

The generic Win32 sealed runtime reads payload v4 from its own executable overlay and reconstructs the same Tabs hierarchy. Its Tabs smoke edits a nested Input, switches pages through the actual tab control, and exercises a nested Checkbox mutation.

## macOS: direct AppKit and sealed runtime

The macOS AOT backend emits Objective-C++ against Cocoa/AppKit. Tabs uses `NSTabView`; each Patch page becomes an `NSTabViewItem` with a real page view containing its child controls. Patch top-left page geometry is translated to AppKit coordinates without introducing persistent tab-selection state.

The generic AppKit runtime reads the same payload v4 used by Windows and Linux. The release workflow builds a universal Mach-O with both `arm64` and `x86_64` slices.

## Linux: direct GTK3 and sealed runtime

The Linux AOT backend emits C++17 using GTK3. Tabs uses `GtkNotebook`; each Patch page owns a `GtkFixed` page container and nested controls retain their existing GTK signal handling.

The generic GTK3 runtime reads payload v4 and reconstructs the same hierarchy. Linux remains dynamically linked to GTK3 and normal system libraries, so the runtime is not yet a self-contained distribution bundle.

## Executable evidence

Each platform has two independent native paths under CI:

1. **project-specific AOT**, which generates and compiles native source for the Patch project;
2. **generic sealed runtime**, which compiles the platform runtime once and appends checked Native GUI IR in the same form Patch Studio uses.

The unified AOT matrix builds and executes Forms, ComboBox, ListBox and Tabs applications on Windows, macOS and Linux. The sealed-runtime workflows independently seal and execute the same control progression and verify payload v4. Tabs smoke tests verify native page switching plus nested control behavior rather than only checking that a tab header was drawn.

Windows, macOS and Linux gates also reject Electron/Chromium/Node runtime content from the direct native artifacts.

## Runtime publication

The token-free Studio runtime templates are versioned separately from the Patch language package because browser-side sealing requires the runtime and payload schema to agree exactly:

- `native-win32-runtime-v0.4`;
- `native-macos-runtime-v0.4`;
- `native-linux-runtime-v0.4`.

Patch Pages downloads those v0.4 release assets under stable runtime filenames. The explicit Electron compatibility runtime remains separately versioned as `studio-runtime-v0.6` and is not the default direct native route.

## Compatibility backend

The Electron desktop backend remains available as an explicit compatibility/reference backend while Native GUI IR coverage is incomplete. It is not the recommended Window path on Windows, macOS or Linux and is not used by the direct native AOT or sealed-runtime paths.

Likely next native controls are radio buttons, dialogs, menus and tables/grids. Packaging work should also continue on macOS signing/notarization and a more portable Linux distribution bundle.

## Claim boundary

This is real direct native GUI code generation and native platform linking on Windows, macOS and Linux. It is **not yet** a full native implementation of every Patch language or Studio feature. Linux is not yet a self-contained distribution bundle. The token-free macOS app is unsigned. None of this native GUI work changes Change IR 0.10 or the beta.32 research assurance claims.
