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

## Patch Studio Windows GUI build

For **Windows + Window / GUI**, Patch Studio now treats the direct native compiler as the recommended cloud path.

The build-mode selector shows:

- **Native single EXE (GitHub Actions, recommended)**: sends the current editor source to the dedicated Windows compiler workflow, generates Win32 C++, links it with MSVC, executes the native GUI smoke and downloads a GitHub artifact ZIP containing exactly `AppName.exe`.
- **Compatibility package (Electron, no token)**: keeps the older browser-only runtime-template path for GUI features not yet covered by Native GUI IR. This path can contain `patch-app.json` and multiple Electron runtime files and is not a single-EXE build.
- **Local compatibility kit (advanced)**: retains the older local desktop packager. For direct native local compilation, use `patch-app` on Windows with the C++ Build Tools installed.

When the Studio profile changes to Windows + Window / GUI, the native single-EXE cloud mode is selected by default. The GitHub token is used only to dispatch and retrieve the Actions build and is not saved by Patch Studio.

The Studio request uses the same `Patch Windows Single EXE` workflow as the repository build. The editor source is Base64-encoded in memory and sent through the workflow-dispatch input; it does not need to be committed to the repository first.

GitHub wraps Actions artifacts in a ZIP for transport, but the Windows native artifact contains exactly one user deliverable: `AppName.exe`.

## GitHub Actions single-EXE build

The **Patch Windows Single EXE** workflow also provides a compiler directly from the GitHub Actions page without requiring Visual Studio on the developer's PC.

A manual workflow run can either receive Studio `source_b64` or use a `.patch` file already committed to the repository. For a repository source:

1. Open **Patch Windows Single EXE**.
2. Choose **Run workflow**.
3. Enter the `.patch` source path, for example `examples/forms-navigation.patch`.
4. Enter the application name.
5. Download the completed workflow artifact.

The workflow verifies that:

- the file has a Windows PE `MZ` header;
- the native GUI smoke executes successfully;
- build metadata says `shell: native-win32`, `electron: false` and `crt: static`;
- no `patch-app.json` exists;
- no Electron/Chromium/Node runtime tree exists;
- the staged user deliverable contains exactly one `.exe`.

On `main`, the canonical Forms demo is also uploaded directly to the GitHub release tag `native-win32-preview-v0.1` as `PatchFormsDemo.exe`.

## Legacy compatibility package

Patch Studio's no-token Window compatibility mechanism is a different architecture. It downloads a generic Electron-based runtime and links a compiled Patch payload into that runtime. Such packages can contain a `patch-app.json` payload and multiple runtime files.

That compatibility package is **not** the direct native Win32 single-EXE build. It remains available only while the native backend does not cover every Patch GUI feature.

A static browser page cannot perform a fresh MSVC link by itself, which is why Studio's recommended native Windows GUI path uses the GitHub Actions compiler service. The direct local alternative is `patch-app` with Windows C++ Build Tools installed.

## Signing

The generated `.exe` is a real native executable but is currently unsigned. Windows may therefore show SmartScreen warnings. Trusted Authenticode signing requires a code-signing certificate. Signing is separate from whether the application is a genuine single native executable.
