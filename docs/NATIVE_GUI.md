# Patch Native GUI

Status: **experimental native backend preview, working on Windows, macOS and Linux**

Patch can lower the same source-backed Forms syntax used by Patch Studio into operating-system-native GUI code. User-facing Patch syntax is independent of Win32, AppKit and GTK.

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

Patch Studio exposes the same direct native backends without changing Patch source:

- **Windows Window / GUI:** the recommended no-token path compiles Native GUI IR in the browser and seals it into the prebuilt native Win32 runtime, producing one `.exe`. An optional GitHub Actions route performs project-specific MSVC AOT code generation.
- **macOS Window / GUI:** the GitHub Actions **Native AOT app** route compiles the current editor source through the direct AppKit backend and returns a project-specific `.app` bundle. Electron/Chromium is excluded from this artifact.
- **Linux Window / GUI:** the GitHub Actions **Native AOT app** route compiles through the direct GTK3 backend and returns a project-specific ELF executable plus build metadata. Electron/Chromium/Node and `patch-app.json` are excluded from this artifact.
- **macOS/Linux no-token Window package:** this remains the explicit Electron compatibility route for now. Token-free native runtime sealing on these two platforms is separate follow-on work.

Studio performs Native GUI IR preflight before dispatching any direct native Window AOT build, so unsupported native behavior fails before a cloud build is submitted.

## User syntax stays simple

The same Patch source is accepted by every current native backend:

```patch
create boolean notifications = false

window "Main" as main size 560, 340:
  text "My App" at 24, 24 size 220, 30
  button "Settings" as open_settings at 24, 72 size 120, 36

window "Settings" as settings size 480, 300:
  checkbox "Notifications" as notifications at 24, 72 size 220, 36
  button "Close" as close_settings at 24, 124 size 100, 36

when open_settings clicked:
  open settings

when close_settings clicked:
  close settings

when notifications changed:
  change notifications:
    set = value
```

No `Form.Create`, widget handles, message-loop code, framework imports or backend conditionals are required in Patch source.

## Shared architecture

```text
.patch source
     |
Patch compiler
     |
validated Native GUI IR 0.1
     |
     +-------------------+------------------+
     |                   |                  |
 Win32 C++          AppKit ObjC++        GTK3 C++
     |                   |                  |
   MSVC             clang + Cocoa       g++ + GTK
     |                   |                  |
Windows .exe          macOS .app        Linux ELF
```

Native GUI IR is the platform-neutral contract. Backend implementations fail closed when the source uses behavior the current native subset cannot lower faithfully. Patch does not silently switch an unsupported native build back to Electron.

## Windows: direct Win32

The Windows backend emits C++17 using native `HWND` Forms and Windows `STATIC`, `BUTTON`, `EDIT` and auto-checkbox controls. Events use the Windows message loop and `WM_COMMAND`. MSVC compiles and links a `/SUBSYSTEM:WINDOWS` executable with the C/C++ runtime statically linked using `/MT`.

The exact-head CI application built from `examples/forms-navigation.patch` was **132,096 bytes** and executed the full Main -> open Settings -> Checkbox change -> close Settings smoke. Build metadata records `shell: native-win32`, `electron: false` and `crt: static`.

## macOS: direct AppKit

The macOS backend emits Objective-C++ against Cocoa/AppKit. It creates native `NSWindow`, `NSButton` and `NSTextField` objects, uses target/action events plus the text-field delegate, and translates Patch top-left geometry to AppKit coordinates. `clang++` links a normal `.app` bundle.

The exact-head CI executable inside the generated `.app` was **56,784 bytes** and passed the same Forms/Checkbox lifecycle smoke. `otool` showed Apple system frameworks/libraries such as Cocoa, AppKit and Foundation, with no Electron/Chromium framework. Build metadata records `shell: native-appkit`, `framework: AppKit` and `electron: false`.

## Linux: direct GTK3

The Linux backend emits C++17 using native GTK3 `GtkWindow`, `GtkLabel`, `GtkButton`, `GtkEntry` and `GtkCheckButton` controls. GTK signals implement clicked/toggled/changed events, while Patch geometry maps directly into the current `GtkFixed` v0.1 layout backend.

The exact-head Ubuntu CI executable was **22,832 bytes** and passed the same Forms/Checkbox smoke under Xvfb. Build metadata records `shell: native-gtk3`, `toolkit: GTK3` and `electron: false`.

The current Linux binary is **dynamically linked**. A compatible GTK3 runtime and its system libraries must be present on the target Linux installation. The tiny ELF size therefore must not be interpreted as a fully self-contained Linux package. Packaging GTK dependencies or a portable Linux bundle is later work.

## v0.1 supported subset

Native GUI v0.1 currently supports:

- simple `number`, `text` and `boolean` persistent state with literal initial values;
- source-backed Form size and control geometry;
- Text, Button, Input and Checkbox controls;
- Button `clicked` and Input/Checkbox `changed` events;
- scalar `change` operations supported for the target type;
- typed event-local `value`;
- named Form `open` / `close` lifecycle;
- simple `{state}` interpolation in Text/Button/Checkbox labels.

Unsupported event behavior, object/thing state, unsupported expressions or unsupported mutations stop native lowering with a clear error rather than being silently omitted.

## Executable evidence

Each platform has a focused CI gate that compiles and links the canonical `examples/forms-navigation.patch` with the real platform toolchain and then executes the generated GUI program:

- Windows: MSVC + Win32 `.exe`;
- macOS: clang/Cocoa + AppKit `.app`;
- Linux: g++/GTK3 + ELF under Xvfb.

The native smoke requires Main to start visible, Settings to start hidden, the native Settings button to open the second Form, the native Checkbox event to commit its Patch Boolean change, and Close to hide Settings again. Each gate also rejects an Electron/Node runtime tree in the produced output.

Patch Studio additionally has a dedicated macOS/Linux AOT workflow that exercises this same direct native builder and preserves Studio artifact naming for dispatched builds.

## Compatibility backend

The existing Electron desktop backend remains available as an explicit compatibility/reference backend while Native GUI IR coverage is incomplete. It is no longer the macOS/Linux **cloud AOT** path, but it still backs the current no-token ready Window package on those two platforms.

The next parity work should add richer controls through Native GUI IR once, then implement the same contract in all three backends. High-value controls are ComboBox/ListBox, radio buttons, tabs, dialogs, menus and tables/grids. A separate packaging milestone should bring the Windows-style token-free native sealed-runtime path to macOS and Linux.

## Claim boundary

This is real direct native GUI code generation and native platform linking on Windows, macOS and Linux. It is **not yet** a full native implementation of every Patch language or Studio feature. Linux is not yet a self-contained distribution bundle. macOS/Linux token-free GUI downloads still use the compatibility runtime until native sealed-runtime templates are implemented for those platforms. The native GUI work does not change Change IR 0.10 or the beta.32 research assurance claims.
