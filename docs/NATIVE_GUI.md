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

Optional arguments are only needed when a custom name or output folder is wanted:

```bash
patch-app myapp.patch MyApp dist-native
```

The backend names are implementation details. Normal Patch programs do not import or mention Win32, Cocoa/AppKit or GTK.

## Patch Studio native builds

Patch Studio exposes the same direct native GUI contract without changing Patch source:

- **Windows Window / GUI:** the recommended no-token path compiles Native GUI IR in the browser and seals it into the prebuilt native Win32 runtime, producing one `.exe`. An optional GitHub Actions route performs project-specific MSVC AOT code generation.
- **Linux Window / GUI:** the recommended no-token path compiles the same Native GUI IR in the browser and seals it into a prebuilt native GTK3 ELF runtime. Studio downloads a ZIP containing one executable with its Unix executable mode preserved. An optional GitHub Actions route performs project-specific g++ AOT code generation.
- **macOS Window / GUI:** the recommended no-token path compiles the same Native GUI IR in the browser, seals it into a universal AppKit Mach-O runtime containing `arm64` and `x86_64` slices, and creates a minimal `.app` bundle ZIP. An optional GitHub Actions route performs project-specific clang AOT code generation.

All three sealed-runtime builds use the same `PCHGUI01` envelope. Native GUI payload **version 2** carries Forms, controls, state, events, change actions and ComboBox option arrays in one platform-neutral binary contract. The platform runtime differs, but Patch semantics are encoded once.

The token-free macOS bundle is intentionally **unsigned**. Studio appends the project payload in the browser, which changes the executable after the runtime template was compiled and would invalidate a pre-existing Apple code signature. Gatekeeper may therefore require Control-click -> Open on first launch. Signing/notarization remains a separate packaging stage.

## User syntax stays simple

```patch
create text size = "Medium"
create boolean notifications = false

window "Main" as main size 560, 340:
  text "My App" at 24, 24 size 220, 30
  combo "Small", "Medium", "Large" as size at 24, 72 size 220, 36
  checkbox "Notifications" as notifications at 24, 124 size 220, 36

when size changed:
  change size:
    set = value

when notifications changed:
  change notifications:
    set = value
```

No widget handles, message-loop code, framework imports or backend conditionals are required in Patch source.

## Shared architecture

```text
.patch source
     |
Patch compiler
     |
validated Native GUI IR 0.2
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
Native GUI IR 0.2 -> PCHGUI01 payload v2 -> native runtime template -> user download
                              |                       |
                              +-- same contract ------+
                               Windows / macOS / Linux
```

Native GUI IR is the platform-neutral contract. Backends fail closed when source uses behavior the current native subset cannot lower faithfully. Patch does not silently switch an unsupported native build back to Electron.

## Native GUI v0.2 supported subset

Native GUI v0.2 currently supports:

- simple `number`, `text` and `boolean` persistent state with literal initial values;
- source-backed Form size and control geometry;
- Text, Button, Input, Checkbox and ComboBox controls;
- Button `clicked` and Input/Checkbox/ComboBox `changed` events;
- scalar `change` operations supported for the target type;
- typed event-local `value`;
- named Form `open` / `close` lifecycle;
- simple `{state}` interpolation in Text/Button/Checkbox labels;
- quoted text-literal ComboBox options.

Unsupported event behavior, object/thing state, unsupported expressions or unsupported mutations stop native lowering with a clear error rather than being silently omitted.

## ComboBox parity

ComboBox is the first richer selection control added through the shared Native GUI IR rather than independently per platform. Native GUI IR stores the evaluated text options, binding and geometry once. Each backend implements the same semantic event:

```text
native selection -> transient text value -> when <id> changed -> explicit Patch change
```

Platform mappings are:

- **Win32:** `COMBOBOX`, `CBS_DROPDOWNLIST`, `CBN_SELCHANGE`;
- **AppKit:** `NSPopUpButton` target/action;
- **GTK3:** `GtkComboBoxText` `changed` signal.

Refresh maps persistent Patch text state back to the selected native option. Selection alone does not create hidden persistent mutation.

## Windows: direct Win32 and sealed runtime

The Windows AOT backend emits C++17 using native `HWND` Forms and Windows `STATIC`, `BUTTON`, `EDIT`, auto-checkbox and `COMBOBOX` controls. Events use the Windows message loop and `WM_COMMAND`. MSVC links a `/SUBSYSTEM:WINDOWS` executable with the C/C++ runtime statically linked using `/MT`.

The generic Win32 sealed runtime reads payload v2 from its own executable overlay. The runtime validates ComboBox option arrays, populates them with `CB_ADDSTRING`, dispatches `CBN_SELCHANGE`, and refreshes selection from bound Patch text state.

## macOS: direct AppKit and sealed runtime

The macOS AOT backend emits Objective-C++ against Cocoa/AppKit. It creates native `NSWindow`, `NSButton`, `NSTextField` and `NSPopUpButton` objects, uses target/action events plus the text-field delegate, and translates Patch top-left geometry to AppKit coordinates.

The generic AppKit runtime reads the same payload v2 used by Windows and Linux. ComboBox options are installed into `NSPopUpButton`, selected titles become typed text event values, and refresh selects the item matching bound Patch state. The release workflow builds a universal Mach-O with both `arm64` and `x86_64` slices.

## Linux: direct GTK3 and sealed runtime

The Linux AOT backend emits C++17 using native GTK3 `GtkWindow`, `GtkLabel`, `GtkButton`, `GtkEntry`, `GtkCheckButton` and `GtkComboBoxText` controls. GTK signals implement clicked/toggled/changed events, while Patch geometry maps into the current `GtkFixed` layout backend.

The generic GTK3 runtime reads payload v2, populates ComboBox options, dispatches selected text, applies explicit Patch changes, and refreshes the active option from bound state. Linux remains dynamically linked to GTK3 and normal system libraries, so the runtime is not yet a self-contained distribution bundle.

## Executable evidence

Each platform has two independent native paths under CI:

1. **project-specific AOT**, which generates and compiles native source for the Patch project;
2. **generic sealed runtime**, which compiles the platform runtime once and appends checked Native GUI IR in the same form Patch Studio uses.

The AOT gates compile and execute native apps with the real platform toolchain. The sealed-runtime gates compile the runtime, smoke the existing multi-form/Checkbox lifecycle example, then seal and smoke `examples/combo-window.patch` as a second application. The ComboBox smoke selects the final option through the actual native control, dispatches its native change notification, and verifies the explicit Patch change persisted the selected text.

Windows, macOS and Linux gates also reject Electron/Chromium/Node runtime content from these native artifacts.

## Runtime publication

The token-free Studio runtime templates are versioned separately from the Patch language package because browser-side sealing requires the runtime and payload schema to agree exactly:

- `native-win32-runtime-v0.2`;
- `native-macos-runtime-v0.2`;
- `native-linux-runtime-v0.2`.

Patch Pages downloads those v0.2 release assets under stable runtime filenames. This prevents a payload-v2 Studio build from being paired with an older payload-v1 runtime template.

## Compatibility backend

The Electron desktop backend remains available as an explicit compatibility/reference backend while Native GUI IR coverage is incomplete. It is not the recommended Window path on Windows, macOS or Linux and is not used by the direct native AOT or sealed-runtime paths.

Likely next native controls are ListBox, radio buttons, tabs, dialogs, menus and tables/grids. Packaging work should also continue on macOS signing/notarization and a more portable Linux distribution bundle.

## Claim boundary

This is real direct native GUI code generation and native platform linking on Windows, macOS and Linux. It is **not yet** a full native implementation of every Patch language or Studio feature. Linux is not yet a self-contained distribution bundle. The token-free macOS app is unsigned. None of this native GUI work changes Change IR 0.10 or the beta.32 research assurance claims.
