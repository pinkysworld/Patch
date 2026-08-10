# Windows Single EXE

Patch has two different Windows GUI delivery paths. They should not be confused.

## Direct native Win32 build

This is the preferred native Windows path for the Native GUI IR 0.1 subset.

A Patch Forms program is compiled as:

```text
.patch source
  -> Patch compiler
  -> Native GUI IR 0.1
  -> generated Win32 C++
  -> MSVC /O2 /MT /SUBSYSTEM:WINDOWS
  -> AppName.exe
```

The application state, Forms, controls and supported event behavior are compiled into the executable. It does not require `patch-app.json`, Electron, Chromium, Node.js, a `resources` folder or a second Patch runtime file.

Locally on Windows with Visual Studio C++ Build Tools installed:

```powershell
patch-app myapp.patch
```

or directly:

```powershell
node scripts/build-native-win32.js myapp.patch MyApp dist
```

The direct backend currently supports the Native GUI IR 0.1 subset documented in `docs/NATIVE_GUI.md`.

## GitHub Actions single-EXE build

The **Patch Windows Single EXE** workflow provides a compiler without requiring Visual Studio on the developer's PC.

From the GitHub Actions page:

1. Open **Patch Windows Single EXE**.
2. Choose **Run workflow**.
3. Enter a `.patch` file already committed to the repository, for example `examples/forms-navigation.patch`.
4. Enter the application name.
5. Download the completed workflow artifact.

GitHub wraps Actions artifacts in a ZIP for transport, but the artifact itself contains exactly one application file: `AppName.exe`.

The workflow verifies that:

- the file has a Windows PE `MZ` header;
- the native GUI smoke executes successfully;
- build metadata says `shell: native-win32`, `electron: false` and `crt: static`;
- no `patch-app.json` exists;
- no Electron/Chromium/Node runtime tree exists;
- the staged user deliverable contains exactly one `.exe`.

On `main`, the canonical Forms demo is also uploaded directly to the GitHub release tag `native-win32-preview-v0.1` as `PatchFormsDemo.exe`.

## Legacy Ready compatibility package

Patch Studio's older no-token Window "Ready app" mechanism is a different architecture. It downloads a generic Electron-based runtime and links a compiled Patch payload into that runtime. Such packages can contain a `patch-app.json` payload and multiple runtime files.

That compatibility package is **not** the direct native Win32 single-EXE build. It remains useful only while the native backend does not cover every Patch GUI feature.

A static browser page cannot perform a fresh MSVC link for arbitrary local source by itself. For arbitrary source, use one of these direct-native routes:

- local `patch-app` with Windows C++ Build Tools;
- the GitHub Actions compiler workflow for source committed to the repository;
- Patch Studio cloud build once its Window target is switched to the direct native compiler path.

The compatibility package should not be described as a native single-EXE application.

## Signing

The generated `.exe` is a real native executable but is currently unsigned. Windows may therefore show SmartScreen warnings. Trusted Authenticode signing requires a code-signing certificate. Signing is separate from whether the application is a genuine single native executable.
