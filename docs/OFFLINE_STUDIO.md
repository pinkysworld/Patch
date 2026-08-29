# Patch Studio Offline IDE

Status: **Stage 1 release channel implemented; Stage 2 local native-build integration remains open**

Patch Studio is intended to be usable as a real offline IDE, not merely as a website that happens to remain in a browser cache. The offline product keeps Patch's local-first model and uses the same source-backed Studio modules as the public site.

## Download

The rolling beta release channel is **`offline-studio-v0.2`**. The cross-platform workflow builds and self-smokes every executable before the release assets are refreshed.

Stable download URLs:

- Windows x64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-windows-x64.exe`
- macOS Apple Silicon: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-macos-arm64`
- Linux x64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-linux-x64`
- Embedded-site manifest: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/offline-studio-manifest.json`
- SHA-256 checksums: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/SHA256SUMS`

The public Patch Downloads page links the same release contract: `https://minh.systems/Patch/downloads.html`.

### Release integrity and signing boundary

Every platform executable is self-smoked in CI. The three platform builds must also produce the same deterministic embedded-site manifest before publication. The publish job generates `SHA256SUMS` for the exact release bytes and verifies that every required asset exists on the GitHub Release.

This is a development/beta release channel, not a claim of commercial code signing:

- Windows development binaries are currently unsigned by Authenticode;
- Linux development binaries are unsigned;
- macOS executables are ad-hoc signed for local execution but are not Developer ID signed or notarized.

Signing/notarization remains a separate production-distribution gate and must not be inferred from successful CI or SHA-256 verification.

## Product contract

The offline IDE is being built toward this workflow with no GitHub account, token or network connection:

1. launch Patch Studio from a local executable;
2. create/import/export Patch projects and resources;
3. edit source and use the Form Designer/Object Inspector;
4. Run locally;
5. build Standalone Web, portable Patch bundles and WebAssembly locally;
6. build Windows/macOS/Linux applications locally from the embedded offline compiler/runtime set;
7. keep project data and diagnostics local unless the user explicitly exports or chooses an online action.

Stage 1 covers items 1-5 for browser-local targets already implemented by Patch Studio. Item 6 is the explicit Stage 2 gap. Online services are optional accelerators for updates, remote builds and publishing; they are not part of the core IDE execution contract.

## Stage 1: self-contained Offline Studio executable

The implemented Stage 1 foundation includes:

- `npm run build:offline-studio`;
- deterministic `patch-offline-studio-manifest` v1 with SHA-256 for every embedded Studio file and a closure hash;
- a Node SEA executable containing the complete generated Patch Studio site;
- an ephemeral loopback server bound only to `127.0.0.1`;
- a random per-launch URL prefix so unrelated local pages cannot guess the Studio endpoint;
- GET/HEAD-only serving with traversal rejection and restrictive security headers;
- CSP `connect-src 'self'` so this offline executable does not silently depend on remote network resources;
- automatic browser launch with a printed local URL as fallback;
- an executable self-smoke mode that serves the embedded Studio, requests it over loopback, validates HTTP/CSP and exits;
- Windows, macOS and Linux CI jobs that build and self-smoke their own platform executable;
- rolling `offline-studio-v0.2` GitHub Release publication after all three platform jobs succeed;
- deterministic cross-platform manifest equality check before publication;
- release `SHA256SUMS` plus post-upload asset-name verification;
- fail-closed build validation if critical Studio assets are missing.

Stage 1 is useful offline for Studio authoring, Designer/Run, Standalone Web, portable bundle and browser-side targets already implemented by Patch Studio.

The executable deliberately uses the same generated site closure as the hosted Studio. The offline IDE is therefore not a forked second IDE implementation.

### Running the downloaded executable

Windows:

```text
PatchStudio-windows-x64.exe
```

macOS Apple Silicon:

```text
chmod +x PatchStudio-macos-arm64
./PatchStudio-macos-arm64
```

Because the macOS beta binary is ad-hoc signed rather than Developer ID notarized, macOS may require an explicit local trust/open action depending on Gatekeeper policy.

Linux x64:

```text
chmod +x PatchStudio-linux-x64
./PatchStudio-linux-x64
```

Patch Studio starts a private loopback endpoint and opens the local Studio URL in the default browser. The application UI itself does not need the public Patch website after launch.

### Verify a release download

Place `SHA256SUMS` beside the downloaded asset.

Linux:

```text
sha256sum -c SHA256SUMS --ignore-missing
```

macOS:

```text
shasum -a 256 PatchStudio-macos-arm64
```

Windows PowerShell:

```text
Get-FileHash .\PatchStudio-windows-x64.exe -Algorithm SHA256
```

Compare the resulting digest with the corresponding line in `SHA256SUMS`.

### Build requirement for contributors

The self-contained executable builder uses Node's direct `--build-sea` support and therefore requires **Node 25.5.0 or newer**. Normal Patch development may continue on the repository's broader supported Node range. `npm run check:offline-studio` only builds and verifies the deterministic site/manifest closure and does not require SEA support.

The release workflow pins Node 26 instead of depending on whichever runtime happens to be installed on a developer machine.

## Stage 2: fully local native build path

Stage 2 closes the remaining distinction between the current Stage 1 executable and a Delphi/VB-style installed development environment:

- embed or install the current Patch offline compiler beside the Studio runtime;
- embed the sealed Win32/AppKit/GTK runtime templates for the host platform;
- expose a localhost-only authenticated build bridge;
- Windows host builds Windows apps locally;
- macOS host builds macOS apps locally;
- Linux host builds Linux apps locally;
- no GitHub token or Actions workflow is required;
- native output, diagnostics and SHA-256 evidence appear in the Studio artifact pane;
- remote/fresh CI build remains an optional separate target.

Cross-compiling every desktop platform from every host is not required for Stage 2. Patch should first provide a predictable host-native local build contract.

## Stage 3: installed IDE integration

After the local build bridge is stable:

- native file-open/save/project-folder integration instead of browser download/upload as the primary workflow;
- recent projects and workspace persistence;
- OS file associations for Patch project formats;
- packaged Windows/macOS/Linux IDE distributions;
- application icon and installer integration;
- optional update checks that are disabled or harmless when offline;
- production signing/notarization when credentials are available.

A custom shell such as Tauri/Electron should only be introduced if it materially improves filesystem/window integration. The core Studio must remain browser-module compatible and testable as the same application.

## Security boundary

The installed IDE will eventually have more authority than the hosted Studio because local native builds require filesystem/process access. Therefore:

- the browser UI must never receive a general shell-execution API;
- local build endpoints must accept only versioned Patch build requests;
- a per-launch secret/token must protect any privileged localhost endpoint;
- project paths must be canonicalized and restricted to explicitly opened workspaces;
- native runtime/compiler binaries must be versioned and integrity checked;
- online URLs must never be required to run an existing local project.

## Current commands

```text
npm run build:offline-studio
npm run check:offline-studio
```

`check:offline-studio` performs the deterministic site/manifest closure step on the normal development runtime. `build:offline-studio` additionally requires Node >=25.5.0 to produce the self-contained executable.

## Definition of Offline IDE Ready

Patch Studio can advertise a **fully offline IDE** only when the installed product can be launched after network disconnection and complete authoring, Run and host-native Build for an already installed toolchain without fetching code, modules, compiler files or runtime templates.

Stage 1 may be advertised more narrowly as the **Patch Studio Offline IDE beta** for offline authoring, Designer/Run and current browser-local build targets. The Stage 1 wording must not imply that host-native desktop builds are already performed inside the IDE.
