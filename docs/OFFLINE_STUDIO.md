# Patch Studio Offline IDE

Status: **Stage 1 multi-platform release channel implemented; Stage 2 R0.1 authenticated host-native build bridge implemented in source; installed Build integration remains open**

Patch Studio is intended to be usable as a real offline IDE, not merely as a website that happens to remain in a browser cache. The offline product keeps Patch's local-first model and uses the same source-backed Studio modules as the public site.

## Download

The rolling beta release channel is **`offline-studio-v0.2`**. The release workflow builds, self-smokes and verifies the complete distribution matrix before publication.

Published assets:

- Windows x64: `PatchStudio-windows-x64.exe`
- Windows ARM64: `PatchStudio-windows-arm64.exe`
- macOS Apple Silicon: `PatchStudio-macos-arm64`
- macOS Intel embedded-runtime kit: `PatchStudio-macos-x64.tar.gz`
- Linux x64: `PatchStudio-linux-x64`
- Linux ARM64: `PatchStudio-linux-arm64`
- Portable Node 18+ compatibility bundle: `PatchStudio-portable-node18.tar.gz`
- Embedded-site manifest: `offline-studio-manifest.json`
- SHA-256 checksums: `SHA256SUMS`

Stable release base URL:

`https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/`

The human-facing download page is `https://minh.systems/Patch/downloads.html`.

## Platform contract

Patch currently uses three distribution classes:

1. **Self-contained SEA executables** for Windows x64, Windows ARM64, macOS Apple Silicon, Linux x64 and Linux ARM64.
2. **macOS Intel embedded-runtime kit** built and executed on an Intel macOS CI host. It carries its own Intel Node runtime because the current direct Node 26 `--build-sea` path is not reliable on macOS x64. A separate Node installation is not required for this kit.
3. **Portable Node 18+ compatibility bundle** for generic Unix/POSIX-style hosts and other systems without a host-specific self-contained distribution. It is built/self-smoked on Linux and executed in a real FreeBSD 15 x64 VM in CI.

All distribution classes carry the same generated Patch Studio site contract. The release workflow compares deterministic manifests across host-specific distributions before publication. Portable/runtime-kit runners verify bundled files before serving them.

The FreeBSD gate proves the portable Node/browser IDE path. It does **not** claim a native FreeBSD SEA or native FreeBSD Window runtime.

## Release integrity and signing boundary

Every published host-specific distribution is launched and self-smoked on its target CI architecture. Publication additionally requires the portable and FreeBSD gates, deterministic manifest equality and release-asset verification.

`SHA256SUMS` covers the exact release bytes. SHA-256 verifies integrity, not publisher identity.

Current beta signing status:

- Windows development binaries are unsigned by Authenticode.
- Linux development binaries are unsigned.
- macOS Apple Silicon is ad-hoc signed for local execution, not Developer ID signed or notarized.
- macOS Intel is an integrity-checked embedded-runtime archive, not a Developer ID notarized app.
- the portable Node bundle is integrity-checked but is not an OS-signed app package.

Production signing/notarization remains a separate release gate.

## Product contract

The intended offline workflow, without GitHub account, token or network access, is:

1. launch Patch Studio locally;
2. create/import/export Patch projects and resources;
3. edit source and use the source-backed Form Designer/Object Inspector;
4. Run locally;
5. build Standalone Web, portable Patch bundles and supported browser-local targets;
6. build a host-native Windows/macOS/Linux desktop application from the installed compiler/runtime set;
7. keep source, resources, build diagnostics and artifacts local unless the user explicitly exports or chooses an online action.

Stage 1 covers items 1-5. **Stage 2 R0.1 now provides the narrow privileged bridge needed for item 6, but the distributed IDE does not yet wire the full installed Build workflow to it.**

## Stage 1: Offline Studio distribution

The implemented Stage 1 foundation includes:

- `npm run build:offline-studio` for supported current-host SEA builds;
- `node scripts/build-offline-studio-runtime-kit.js` for embedded-runtime distributions;
- `node scripts/build-portable-offline-studio.js` for the Node 18+ compatibility bundle;
- deterministic `patch-offline-studio-manifest` v1 with SHA-256 for every Studio file and a closure hash;
- the complete generated Patch Studio module closure in every distribution class;
- ephemeral loopback serving bound only to `127.0.0.1`;
- random per-launch URL prefix, GET/HEAD-only routing, traversal rejection and restrictive security headers;
- CSP `connect-src 'self'` so the offline UI does not silently depend on remote resources;
- bundled-byte length/SHA-256 verification before portable/runtime-kit assets are served;
- automatic browser launch with a printed local URL fallback;
- host self-smokes for Windows x64/ARM64, macOS Apple Silicon, macOS Intel, Linux x64/ARM64;
- portable self-smoke on Linux and a real FreeBSD 15 x64 VM;
- release `SHA256SUMS` plus post-upload required-asset verification;
- fail-closed validation if a critical Studio module is missing.

The Offline Studio is not a forked IDE. It packages the same generated browser-module closure as the hosted Studio.

### Running the distributions

Windows x64:

```text
PatchStudio-windows-x64.exe
```

Windows ARM64:

```text
PatchStudio-windows-arm64.exe
```

macOS Apple Silicon:

```text
chmod +x PatchStudio-macos-arm64
./PatchStudio-macos-arm64
```

macOS Intel:

```text
tar -xzf PatchStudio-macos-x64.tar.gz
chmod +x patch-studio runtime/node
./patch-studio
```

Linux x64:

```text
chmod +x PatchStudio-linux-x64
./PatchStudio-linux-x64
```

Linux ARM64:

```text
chmod +x PatchStudio-linux-arm64
./PatchStudio-linux-arm64
```

Portable Node 18+:

```text
tar -xzf PatchStudio-portable-node18.tar.gz
chmod +x patch-studio
./patch-studio
```

or directly:

```text
node PatchStudio.cjs
```

The portable bundle requires Node.js 18+ and a modern local browser. On FreeBSD this is the supported Offline Studio compatibility path today; native FreeBSD Window/GUI linking is not claimed.

### Verify a release download

Place `SHA256SUMS` beside the downloaded asset and compare its digest.

Linux/Unix:

```text
sha256sum -c SHA256SUMS --ignore-missing
```

macOS:

```text
shasum -a 256 PatchStudio-macos-arm64
shasum -a 256 PatchStudio-macos-x64.tar.gz
```

Windows PowerShell:

```text
Get-FileHash .\PatchStudio-windows-x64.exe -Algorithm SHA256
Get-FileHash .\PatchStudio-windows-arm64.exe -Algorithm SHA256
```

## Stage 2 R0.1: secure host-native build bridge

Stage 2 R0.1 is implemented in `src/offline-studio-build-bridge.js` and covered by dedicated security tests.

Protocol contract:

- protocol: `patch-offline-build-bridge/0.1`
- endpoint: `POST /v1/build`
- action: `build-native-window`
- loopback binding only: `127.0.0.1`
- authenticated by a per-launch Bearer capability token of at least 24 random bytes;
- timing-safe token comparison;
- JSON-only request body, bounded to 64 KiB by default;
- closed request schema, unknown fields rejected;
- source paths must be relative `.patch` paths;
- absolute, traversal, drive-relative and colon path forms are rejected;
- workspace and source are realpath-canonicalized and containment checked;
- source symlink escapes are rejected;
- output is fixed under `.patch-build/native/<requestId>`;
- output path components reject symlinks and non-directory collisions before the builder runs;
- there is no general shell, command, argv, environment or arbitrary output-path API;
- the bridge invokes `buildNativeGuiForHost()` directly.

Example request shape:

```json
{
  "protocol": "patch-offline-build-bridge/0.1",
  "action": "build-native-window",
  "requestId": "build-001",
  "source": "src/app.patch",
  "appName": "PatchApp"
}
```

This bridge is deliberately a narrow capability boundary. It does not turn the browser UI into a general local process controller.

## Stage 2 remaining work

The **installed distributions do not yet expose host-native desktop Build as a completed user-facing workflow**. The remaining Stage 2 integration is:

1. package/install the Patch compiler and current sealed host runtime beside Offline Studio;
2. add explicit user-authorized workspace-open authority;
3. generate the per-launch build capability in the privileged host process;
4. pass only the bridge origin/token capability to the local Studio;
5. wire the visible Studio Build UI to the versioned bridge;
6. return structured diagnostics and artifact metadata without arbitrary filesystem authority;
7. self-smoke a real host-native application build from the installed Windows, macOS and Linux distributions.

The first target is host-native build, not arbitrary cross-host compilation:

- Windows host builds Windows apps locally;
- macOS host builds macOS apps locally;
- Linux host builds Linux apps locally.

Until that integration is completed, use the separate `offline-compiler-v0.2` channel for host-native `patch link` output.

## Stage 3: installed IDE integration

After the local Build workflow is stable:

- native file-open/save/project-folder integration rather than browser upload/download as the primary workflow;
- recent projects and workspace persistence;
- OS file associations for Patch project formats;
- application icon and installer integration;
- optional update checks that remain harmless when offline;
- production signing/notarization when credentials are available.

A custom shell such as Tauri/Electron should only be introduced if it materially improves filesystem/window integration. The core Studio must remain browser-module compatible and testable as the same application.

## Security boundary

The installed IDE will have more authority than the hosted Studio, so the privileged surface stays intentionally small:

- never expose a general shell-execution API to browser code;
- accept only versioned Patch build requests;
- protect the privileged localhost endpoint with a per-launch capability;
- canonicalize project paths and restrict them to an explicitly opened workspace;
- keep compiler/runtime binaries versioned and integrity checked;
- make online services optional rather than necessary for an existing local project.

Stage 2 R0.1 establishes the build-request half of that boundary. Explicit workspace authorization and installed capability delivery remain required before the browser UI is connected to it.

## Contributor commands

```text
npm run build:offline-studio
npm run check:offline-studio
node scripts/build-portable-offline-studio.js
node scripts/check-portable-offline-studio.js
node scripts/build-offline-studio-runtime-kit.js
node scripts/check-offline-studio-runtime-kit.js
```

The self-contained SEA builder uses Node's direct `--build-sea` support and requires Node 25.5.0 or newer. The release workflow currently pins Node 26. The portable compatibility bundle requires Node 18+ and does not use `node:sea`.

## Definition of Offline IDE Ready

Patch Studio can advertise a **fully offline IDE** only when an installed distribution can launch after network disconnection and complete authoring, Run and host-native Build with its already installed toolchain, without fetching source modules, compiler files or runtime templates.

The current release may accurately be described as the **Patch Studio Offline IDE beta** for offline authoring, Designer/Run and browser-local build targets, with **Stage 2 R0.1 secure local-build bridge implemented in source**. It must not imply that the installed desktop Build workflow is already complete.
