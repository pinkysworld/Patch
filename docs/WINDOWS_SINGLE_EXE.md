# Windows Single EXE

Patch has two native Windows single-EXE modes plus one explicit Electron compatibility path.

## Native single EXE without a token

This is the recommended Patch Studio path for supported Window projects.

A Patch Window program is built entirely from the public Studio as:

```text
.patch source
  -> Patch compiler in the browser
  -> Native GUI IR 0.8
  -> sealed GUI payload v9
  -> precompiled native Win32 runtime v1.0
  -> AppName.exe
```

The precompiled runtime is a native Win32 executable built with MSVC and static CRT. Patch Studio downloads that public runtime asset, appends the checked Native GUI IR payload plus the versioned integrity footer, and downloads the result directly as `AppName.exe`.

The finished application:

- is one Windows PE `.exe`;
- uses native Win32 windows and controls;
- supports the documented Native GUI IR 0.8 surface, including report-mode `WC_LISTVIEWW` Table/Grid;
- preserves source-backed Anchor/Dock behavior through native `WM_SIZE` handling;
- contains no `patch-app.json`;
- contains no Electron, Chromium or Node.js GUI runtime;
- needs no sidecar application file;
- needs no GitHub token and no local compiler.

This no-token path is **not per-project AOT machine-code generation**. The Win32 runtime machine code is precompiled, while the project-specific Patch Forms/state/event program is embedded as checked Native GUI IR and executed by that native runtime. The distinction is explicit in Studio.

The sealed executable uses the `PCHGUI01` envelope. Current Ready Window output is payload **v9** consumed by runtime **v1.0**. The footer carries the payload version, length and CRC32. The runtime fails closed on malformed or unsupported input. Payload v9 extends the older v8 responsive contract with explicit Table columns, rows and transient `text-list` event typing; payload v8/runtime v0.9 remains a compatibility line rather than being redefined.

## Table / Grid

The no-token single-EXE path supports the same transient Table row-selection contract as Studio Preview, Standalone Web and direct native AOT:

```patch
window "People" as main size 520, 320:
  table "Name", "Role" as people at 24, 64 size 440, 180:
    row "Ada", "Engineer"
    row "Grace", "Scientist"

when people changed:
  show value
```

Runtime v1.0 reconstructs this as a real report-mode `WC_LISTVIEWW`. `changed` exposes the selected row as a transient list of display strings. Selection alone does not persist Patch state or create Change History.

The dedicated sealed-runtime CI compiles the v1.0 runtime, seals this Table example as payload v9, executes the resulting `.exe` with `--patch-smoke`, validates columns/rows/accessibility/responsive behavior and triggers a real native selection notification. The same workflow separately proves the ordinary offline `patch link` path.

## Native AOT EXE

Patch also retains direct project-specific code generation:

```text
.patch source
  -> Patch compiler
  -> Native GUI IR 0.7 / 0.8
  -> Win32 backend 0.8 / Table backend 0.9
  -> generated Win32 C++
  -> MSVC /O2 /MT /SUBSYSTEM:WINDOWS
  -> AppName.exe
```

This generates project-specific native machine code and is available locally with Visual Studio C++ Build Tools through `patch-app`, or through Patch Studio's **Native AOT EXE (GitHub Actions)** route.

The optional GitHub Actions AOT route requires a user-supplied Actions-capable GitHub token because the static Studio cannot dispatch a workflow anonymously. The token is not needed for the recommended sealed-runtime build and is not persisted by Studio.

## Patch Studio Windows GUI selector

For **Windows + Window / GUI**, the build-mode selector exposes:

- **Native single EXE (no token, recommended)**: browser compilation to Native GUI IR 0.8 plus payload-v9 sealing into Win32 runtime v1.0; downloads `AppName.exe` directly.
- **Native AOT EXE (GitHub Actions)**: project-specific Win32 C++/MSVC generation; the artifact ZIP contains the generated `.exe` and requires an Actions token.
- **Compatibility package (Electron, no token)**: explicit older compiled-Window compatibility path and not a native single-EXE claim.
- **Local compatibility kit (advanced)**: older local desktop packager. Direct native local compilation uses `patch-app`; ordinary local sealed linking is also available through the downloadable offline compiler's `patch link` command.

When the Studio profile changes to Windows + Window / GUI, **Native single EXE (no token, recommended)** is selected automatically.

## Native runtime publication

`.github/workflows/native-sealed-table-runtime.yml` builds `native-runtime/win32-sealed-gui-v10.cpp` with MSVC in Unicode mode, seals `examples/table-native-v09.patch` as payload v9 and executes the resulting application with `--patch-smoke`.

Only after the Windows, macOS and Linux runtime-v1.0 jobs succeed does the `main` publication job publish the Win32 runtime under release tag:

```text
native-win32-runtime-v1.0
```

with asset:

```text
patch-windows-native-gui-runtime.exe
```

The Pages deployment waits for all three v1.0 platform releases before replacing the deployed Studio runtime set. This prevents a new browser compiler from being paired with an older payload-v8 template during release ordering.

The runtime asset itself is not a project until Studio or `patch link` seals a project-specific payload into it.

## Offline compiler

The Windows offline compiler builds/embeds the same Win32 runtime v1.0 contract. Its CI links the Table example through the ordinary CLI:

```text
patch link examples/table-native-v09.patch --name OfflineTable --out OfflineTable
```

and executes `OfflineTable.exe --patch-smoke`, verifying that the produced application contains payload v9 and the native Table contract works without Studio, GitHub or a local C++ toolchain after the compiler has been downloaded.

## Compatibility lines

Payload **v8** / runtime **v0.9** remains the frozen responsive Native GUI IR 0.7 compatibility line. Payload **v7** / runtime **v0.8** remains the older accessibility/reproducibility line. Their existing workflows continue to exercise those formats independently.

## Signing

The Windows native modes are not claimed to have real credentialed Authenticode signing evidence yet. Windows may therefore show SmartScreen warnings. Signing machinery is separate from whether the application is a genuine single native executable and remains an explicit distribution milestone.
