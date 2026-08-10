# Patch Native GUI backend preview

Status: **experimental backend preview**

Patch is beginning to lower the same source-backed Forms syntax used by Patch Studio into operating-system-native GUI code. The first backend is Win32 on Windows.

## User syntax stays simple

Native output does not introduce a second GUI language or framework API. Existing Patch source remains the input:

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

No `Form.Create`, widget handles, message-loop code or framework imports are required in Patch source.

## Native Windows pipeline

```text
.patch source
  -> Patch compiler
  -> validated Native GUI IR 0.1
  -> Win32 C++ generation
  -> MSVC compile + link (/SUBSYSTEM:WINDOWS, static CRT)
  -> native Windows .exe
```

The generated Win32 application uses native `HWND` Forms and Windows `STATIC`, `BUTTON`, `EDIT` and auto-checkbox controls. Events are dispatched through the Windows message loop and `WM_COMMAND`. The generated application does not embed Electron, Chromium, Node.js or an HTML/DOM renderer.

Build metadata explicitly records `shell: native-win32` and `electron: false` together with the Native GUI IR version, Change IR version and SHA-256 of the Patch build input.

## v0.1 supported subset

The preview intentionally fails closed outside the subset it can lower faithfully. Native GUI v0.1 supports:

- simple `number`, `text` and `boolean` persistent state with literal initial values;
- source-backed Form size and control geometry;
- Text, Button, Input and Checkbox controls;
- Button `clicked` and Input/Checkbox `changed` events;
- scalar `change` operations supported for the target type;
- event-local `value` with type checking;
- named Form `open` / `close` lifecycle;
- simple `{state}` interpolation in Text/Button/Checkbox labels.

Unsupported event behavior, object/thing state, unsupported expressions or unsupported mutations stop native lowering with an error rather than being silently omitted.

## Executable evidence

The focused Windows CI gate builds `examples/forms-navigation.patch` into a real native `.exe` with MSVC and executes its built-in smoke path. The smoke verifies that Main starts visible, Settings starts hidden, the native Settings button opens the second Form, the native Checkbox event commits its Patch Boolean change, and the Close button hides Settings again.

The gate also checks that the output does not contain an Electron/Node runtime tree and keeps the executable below a conservative size ceiling.

## Compatibility backend

The existing Electron desktop backend remains available while the native backend is incomplete. It is a compatibility/reference backend, not the intended final GUI architecture.

Windows native output should become the default only after the native backend covers the normal Patch Studio GUI surface without semantic fallback. macOS AppKit and a native Linux backend should reuse the same Native GUI IR so user-facing Patch syntax remains identical across platforms.

## Claim boundary

This preview is direct native GUI code generation and native Windows linking, but it is not yet a full native implementation of every Patch language feature. It also does not change Change IR 0.10 or the beta.32 research assurance claims.
