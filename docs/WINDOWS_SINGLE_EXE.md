# Windows Single EXE

Patch now has two native Windows single-EXE modes plus one legacy compatibility path.

## Native single EXE without a token

This is the recommended Patch Studio path for the Native GUI IR 0.1 subset.

A Patch Forms program is built entirely from the public Studio as:

```text
.patch source
  -> Patch compiler in the browser
  -> Native GUI IR 0.1
  -> binary sealed-GUI payload
  -> precompiled native Win32 runtime
  -> AppName.exe
```

The precompiled runtime is a small native Win32 executable built with MSVC and static CRT. Patch Studio downloads that public runtime asset, appends the checked Native GUI IR payload plus an integrity footer, and downloads the result directly as `AppName.exe`.

The finished application:

- is one Windows PE `.exe`;
- uses native Win32 windows and controls;
- contains no `patch-app.json`;
- contains no Electron, Chromium or Node.js runtime;
- needs no sidecar application file;
- needs no GitHub token and no local compiler.

This no-token path is **not per-project AOT machine-code generation**. The Win32 runtime machine code is precompiled, while the specific Patch Forms/state/event program is embedded as checked Native GUI IR and executed by that native runtime. The distinction is explicit in Studio.

The sealed payload has versioned binary format `PCHGUI01`, payload version 1, a payload length and CRC32 integrity check. The native runtime reads the payload from its own executable overlay at startup and fails closed for malformed or unsupported payloads.

## Native AOT EXE

Patch also retains the direct project-specific code-generation path:

```text
.patch source
  -> Patch compiler
  -> Native GUI IR 0.1
  -> generated Win32 C++
  -> MSVC /O2 /MT /SUBSYSTEM:WINDOWS
  -> AppName.exe
```

This generates project-specific native machine code and is available locally with Visual Studio C++ Build Tools:

```powershell
patch-app myapp.patch
```

or directly:

```powershell
node scripts/build-native-win32.js myapp.patch MyApp dist
```

Patch Studio exposes the same path as **Native AOT EXE (GitHub Actions)**. Because GitHub requires authentication to dispatch an Actions workflow from a static site, this optional route still needs a user-supplied GitHub token. The token is not needed for the recommended sealed-runtime build.

## Patch Studio Windows GUI selector

For **Windows + Window / GUI**, the build-mode selector shows:

- **Native single EXE (no token, recommended)**: browser compilation to Native GUI IR plus sealing into the public native Win32 runtime; downloads `AppName.exe` directly.
- **Native AOT EXE (GitHub Actions)**: project-specific Win32 C++/MSVC code generation; GitHub transports the one-EXE artifact inside a ZIP and this route requires an Actions token.
- **Compatibility package (Electron, no token)**: older browser-only runtime-template path for GUI features not yet covered by Native GUI IR; can contain `patch-app.json` and multiple Electron runtime files.
- **Local compatibility kit (advanced)**: older local desktop packager. For direct native local compilation, use `patch-app`.

When the Studio profile changes to Windows + Window / GUI, **Native single EXE (no token, recommended)** is selected automatically.

## Native runtime publication

`.github/workflows/native-win32-runtime.yml` builds `native-runtime/win32-sealed-gui.cpp` with MSVC, seals `examples/forms-navigation.patch` into the compiled runtime and runs the resulting application with `--patch-smoke`.

The smoke verifies native Main/Settings Form lifecycle and Checkbox state behavior. Only after that test passes is the unsealed runtime template published under release tag `native-win32-runtime-v0.1` as:

```text
patch-windows-native-gui-runtime.exe
```

The Pages deployment copies that public runtime into `runtimes/` so Studio can fetch it without authentication. The runtime asset itself is not an application project until Studio seals a GUI payload into it.

## GitHub Actions AOT single-EXE build

The **Patch Windows Single EXE** workflow remains the compiler-service path for AOT builds. It verifies that:

- the generated file has a Windows PE `MZ` header;
- the native GUI smoke executes successfully;
- build metadata says `shell: native-win32`, `electron: false` and `crt: static`;
- no `patch-app.json` exists;
- no Electron/Chromium/Node runtime tree exists;
- the staged user deliverable contains exactly one `.exe`.

On `main`, the canonical AOT Forms demo is also uploaded under release tag `native-win32-preview-v0.1` as `PatchFormsDemo.exe`.

## Legacy compatibility package

The Electron compatibility mechanism remains a different architecture. It links a compiled Patch Window artifact into a generic desktop runtime and can contain `patch-app.json` and multiple runtime files.

That compatibility package is not a native single-EXE build and is labeled accordingly in Studio.

## Signing

Both Windows native modes currently produce unsigned executables. Windows may therefore show SmartScreen warnings. Trusted Authenticode signing requires a code-signing certificate and is separate from whether the application is a genuine single native executable.
