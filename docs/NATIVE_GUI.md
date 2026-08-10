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

Patch Studio exposes the same direct native GUI contract without changing Patch source:

- **Windows Window / GUI:** the recommended no-token path compiles Native GUI IR in the browser and seals it into the prebuilt native Win32 runtime, producing one `.exe`. An optional GitHub Actions route performs project-specific MSVC AOT code generation.
- **Linux Window / GUI:** the recommended no-token path compiles the same Native GUI IR in the browser and seals it into a prebuilt native GTK3 ELF runtime. Studio downloads a ZIP containing one executable with its Unix executable mode preserved. An optional GitHub Actions route performs project-specific g++ AOT code generation.
- **macOS Window / GUI:** the recommended no-token path compiles the same Native GUI IR in the browser, seals it into a universal AppKit Mach-O runtime containing `arm64` and `x86_64` slices, and creates a minimal `.app` bundle ZIP. An optional GitHub Actions route performs project-specific clang AOT code generation.

All three sealed-runtime builds use the same `PCHGUI01` checked payload format. The platform runtime differs, but Forms, controls, state, events and change actions are encoded once in platform-neutral Native GUI IR. Studio also performs Native GUI IR preflight before dispatching any direct native Window AOT build, so unsupported native behavior fails before a cloud build is submitted.

The token-free macOS bundle is intentionally **unsigned**. Studio appends the project payload in the browser, which changes the executable after the runtime template was compiled and would invalidate a pre-existing Apple code signature. Gatekeeper may therefore require Control-click -> Open on first launch. Signing/notarization remains a separate packaging stage rather than being falsely implied by the no-token path.

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

For token-free Studio builds, Native GUI IR is instead appended to a precompiled platform runtime:

```text
Native GUI IR 0.1 -> PCHGUI01 payload -> native runtime template -> user download
                         |                       |
                         +-- same format --------+
                          Windows / macOS / Linux
```

Native GUI IR is the platform-neutral contract. Backend implementations fail closed when the source uses behavior the current native subset cannot lower faithfully. Patch does not silently switch an unsupported native build back to Electron.

## Windows: direct Win32 and sealed runtime

The Windows AOT backend emits C++17 using native `HWND` Forms and Windows `STATIC`, `BUTTON`, `EDIT` and auto-checkbox controls. Events use the Windows message loop and `WM_COMMAND`. MSVC compiles and links a `/SUBSYSTEM:WINDOWS` executable with the C/C++ runtime statically linked using `/MT`.

The exact-head CI application built from `examples/forms-navigation.patch` was **132,096 bytes** and executed the full Main -> open Settings -> Checkbox change -> close Settings smoke. Build metadata records `shell: native-win32`, `electron: false` and `crt: static`.

The separate generic Win32 sealed runtime reads the `PCHGUI01` payload from its own executable overlay and implements the same Native GUI IR v0.1 semantics. This is the runtime Patch Studio uses for its token-free single-EXE path.

## macOS: direct AppKit and sealed runtime

The macOS AOT backend emits Objective-C++ against Cocoa/AppKit. It creates native `NSWindow`, `NSButton` and `NSTextField` objects, uses target/action events plus the text-field delegate, and translates Patch top-left geometry to AppKit coordinates. `clang++` links a normal `.app` bundle.

The project-specific AOT CI executable passes the Forms/Checkbox lifecycle smoke and links Apple platform frameworks/libraries rather than Electron/Chromium.

The token-free Studio path uses a generic AppKit runtime. It reads the same `PCHGUI01` payload used by Windows and Linux, creates native controls, dispatches typed events, applies Patch changes and Form lifecycle actions, and refreshes bound controls. The release workflow builds the runtime as a universal Mach-O with both `arm64` and `x86_64` slices and smoke-runs the sealed canonical application on the Apple Silicon GitHub runner.

The validated universal AppKit runtime is **209,008 bytes**, and the canonical sealed Forms executable is **209,531 bytes**. `file` verifies both x86_64 and arm64 Mach-O slices. These are engineering artifact sizes from CI, not benchmark or research-performance claims.

## Linux: direct GTK3 and sealed runtime

The Linux AOT backend emits C++17 using native GTK3 `GtkWindow`, `GtkLabel`, `GtkButton`, `GtkEntry` and `GtkCheckButton` controls. GTK signals implement clicked/toggled/changed events, while Patch geometry maps directly into the current `GtkFixed` v0.1 layout backend.

The exact-head AOT CI executable was **22,832 bytes** and passed the Forms/Checkbox smoke under Xvfb. Build metadata records `shell: native-gtk3`, `toolkit: GTK3` and `electron: false`.

The token-free Studio path uses a generic GTK3 runtime rather than emitting project-specific C++ in the browser. The runtime reads `PCHGUI01`, constructs native GTK controls, dispatches typed UI events, applies Patch changes and Form lifecycle actions, and refreshes bound controls. Its CI gate seals `examples/forms-navigation.patch` into the runtime and runs the full lifecycle smoke under Xvfb.

The validated generic GTK runtime is **73,552 bytes**, and the canonical sealed Forms executable is **74,075 bytes** on the Ubuntu CI runner. Linux remains dynamically linked to GTK3 and normal system libraries, so these small ELF sizes do not mean a self-contained distribution bundle.

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

Each AOT platform has a focused CI gate that compiles and links the canonical `examples/forms-navigation.patch` with the real platform toolchain and then executes the generated GUI program:

- Windows: MSVC + Win32 `.exe`;
- macOS: clang/Cocoa + AppKit `.app`;
- Linux: g++/GTK3 + ELF under Xvfb.

The native smoke requires Main to start visible, Settings to start hidden, the native Settings button to open the second Form, the native Checkbox event to commit its Patch Boolean change, and Close to hide Settings again. Each gate rejects Electron/Node runtime content in the produced native output.

Windows, macOS and Linux also have generic sealed-runtime gates. Each compiles the platform runtime, appends the canonical checked Native GUI IR payload, and executes the resulting user-shaped binary. This guards the token-free Studio route independently from the project-specific AOT backend.

## Compatibility backend

The existing Electron desktop backend remains available as an explicit compatibility/reference backend while Native GUI IR coverage is incomplete. It is no longer the recommended Window path on Windows, macOS or Linux, and it is not the macOS/Linux cloud AOT path. It remains useful as an explicit fallback when a future native feature is not yet covered.

The next parity work should add richer controls through Native GUI IR once, then implement the same contract in all three native backends and sealed runtimes. High-value controls are ComboBox/ListBox, radio buttons, tabs, dialogs, menus and tables/grids. Packaging work should focus on macOS signing/notarization and a more portable Linux distribution bundle.

## Claim boundary

This is real direct native GUI code generation and native platform linking on Windows, macOS and Linux. It is **not yet** a full native implementation of every Patch language or Studio feature. Linux is not yet a self-contained distribution bundle. The token-free macOS app is unsigned. None of this native GUI work changes Change IR 0.10 or the beta.32 research assurance claims.
