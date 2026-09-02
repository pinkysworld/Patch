# Patch Studio Offline IDE

Status: **Stage 1 multi-platform release channel implemented; Stage 2 local native-build integration remains open**

Patch Studio is intended to be usable as a real offline IDE, not merely as a website that happens to remain in a browser cache. The offline product keeps Patch's local-first model and uses the same source-backed Studio modules as the public site.

## Download

The rolling beta release channel is **`offline-studio-v0.2`**. The cross-platform workflow builds and self-smokes every self-contained executable before release assets are refreshed. It also builds and self-smokes a portable Node compatibility bundle for other desktop Unix/POSIX systems.

Stable download URLs:

- Windows x64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-windows-x64.exe`
- Windows ARM64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-windows-arm64.exe`
- macOS Apple Silicon: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-macos-arm64`
- macOS Intel: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-macos-x64`
- Linux x64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-linux-x64`
- Linux ARM64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-linux-arm64`
- Portable Node 18+ compatibility bundle: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-portable-node18.tar.gz`
- Embedded-site manifest: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/offline-studio-manifest.json`
- SHA-256 checksums: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/SHA256SUMS`

The public Patch Downloads page links the same release contract: `https://minh.systems/Patch/downloads.html`.

### Platform contract

Patch distinguishes two Stage 1 distribution classes:

1. **Self-contained SEA executables**, built and executed in CI on Windows x64, Windows ARM64, macOS Apple Silicon, macOS Intel, Linux x64 and Linux ARM64.
2. **Portable Node compatibility bundle**, for systems where Patch does not publish a self-contained executable. This path is intended for compatible Unix/POSIX environments such as FreeBSD when Node.js 18+ and a modern local browser are available.

The portable bundle is deliberately not described as a native FreeBSD executable. It carries the same generated Patch Studio site and manifest, serves only over loopback, verifies every bundled asset against the manifest before serving it, and uses small Unix/Windows launchers around the Node runtime.

### Release integrity and signing boundary

Every self-contained platform executable is self-smoked in CI. All six executable builds must produce the same deterministic embedded-site manifest before publication. The portable compatibility bundle is built from that same generated site contract and is self-smoked separately. The publish job generates `SHA256SUMS` for the exact release bytes and verifies every required release asset.

This is a development/beta release channel, not a claim of commercial code signing:

- Windows development binaries are currently unsigned by Authenticode;
- Linux development binaries are unsigned;
- macOS executables are ad-hoc signed for local execution but are not Developer ID signed or notarized;
- the portable Node compatibility bundle is integrity-checked but is not an OS-signed application package.

Signing/notarization remains a separate production-distribution gate and must not be inferred from successful CI or SHA-256 verification.

## Product contract

The offline IDE is being built toward this workflow with no GitHub account, token or network connection:

1. launch Patch Studio from a local executable or portable compatibility bundle;
2. create/import/export Patch projects and resources;
3. edit source and use the Form Designer/Object Inspector;
4. Run locally;
5. build Standalone Web, portable Patch bundles and WebAssembly locally;
6. build Windows/macOS/Linux applications locally from the embedded offline compiler/runtime set;
7. keep project data and diagnostics local unless the user explicitly exports or chooses an online action.

Stage 1 covers items 1-5 for browser-local targets already implemented by Patch Studio. Item 6 is the explicit Stage 2 gap. Online services are optional accelerators for updates, remote builds and publishing; they are not part of the core IDE execution contract.

## Stage 1: self-contained and portable Offline Studio

The implemented Stage 1 foundation includes:

- `npm run build:offline-studio` for the current-host self-contained SEA executable;
- `node scripts/build-portable-offline-studio.js` for the Node 18+ compatibility bundle;
- deterministic `patch-offline-studio-manifest` v1 with SHA-256 for every Studio file and a closure hash;
- a Node SEA executable containing the complete generated Patch Studio site;
- a filesystem-backed portable runner carrying the same generated Studio site;
- an ephemeral loopback server bound only to `127.0.0.1`;
- a random per-launch URL prefix so unrelated local pages cannot guess the Studio endpoint;
- GET/HEAD-only serving with traversal rejection and restrictive security headers;
- CSP `connect-src 'self'` so the Offline IDE does not silently depend on remote network resources;
- portable-runner byte-length and SHA-256 verification before a bundled asset is served;
- automatic browser launch with a printed local URL as fallback;
- executable and portable self-smoke modes that request the IDE over loopback, validate HTTP/CSP and exit;
- CI builds for Windows x64/ARM64, macOS Apple Silicon/Intel and Linux x64/ARM64;
- a generic Node 18+ portable compatibility bundle for other supported Node/browser hosts;
- rolling `offline-studio-v0.2` GitHub Release publication only after the complete executable and portable matrix succeeds;
- deterministic six-way executable-manifest equality check before publication;
- release `SHA256SUMS` plus post-upload asset-name verification;
- fail-closed build validation if critical Studio assets are missing.

Stage 1 is useful offline for Studio authoring, Designer/Run, Standalone Web, portable bundle and browser-side targets already implemented by Patch Studio.

The executable and portable distributions deliberately use the same generated site closure as the hosted Studio. The offline IDE is therefore not a forked second IDE implementation.

### Running the downloaded executable

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
chmod +x PatchStudio-macos-x64
./PatchStudio-macos-x64
```

Because the macOS beta binaries are ad-hoc signed rather than Developer ID notarized, macOS may require an explicit local trust/open action depending on Gatekeeper policy.

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

Patch Studio starts a private loopback endpoint and opens the local Studio URL in the default browser. The application UI itself does not need the public Patch website after launch.

### Running the portable Unix/POSIX compatibility bundle

Extract `PatchStudio-portable-node18.tar.gz` on a system with Node.js 18+ and a modern browser.

Unix, Linux, macOS or BSD-style host:

```text
chmod +x patch-studio
./patch-studio
```

Windows with an installed Node runtime:

```text
PatchStudio.cmd
```

Direct launch on any supported Node host:

```text
node PatchStudio.cjs
```

The Unix launcher uses `/bin/sh` and avoids GNU-specific shell requirements. Browser discovery tries common desktop openers and browsers. If none is available, Patch Studio prints the local loopback URL instead of failing the IDE server.

For FreeBSD and other Unix variants this is a compatibility contract, not a claim that Patch CI currently boots a native FreeBSD runner for the IDE. The portable runner itself remains OS-neutral Node code and its served Studio assets are integrity checked against the deterministic manifest.

### Verify a release download

Place `SHA256SUMS` beside the downloaded asset.

Linux and many Unix systems:

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

The portable compatibility bundle requires Node.js 18 or newer and does not use `node:sea`.

The release workflow pins Node 26 instead of depending on whichever runtime happens to be installed on a developer machine.

## Stage 2: fully local native build path

Stage 2 closes the remaining distinction between the current Stage 1 Offline IDE and a Delphi/VB-style installed development environment:

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

The current Stage 1 server is intentionally less privileged: it serves the verified Studio application over loopback but does not expose a general filesystem or process bridge to browser code.

## Current commands

```text
npm run build:offline-studio
npm run check:offline-studio
node scripts/build-portable-offline-studio.js
node scripts/check-portable-offline-studio.js
```

`check:offline-studio` performs the deterministic site/manifest closure step on the normal development runtime. `build:offline-studio` additionally requires Node >=25.5.0 to produce the self-contained executable. The portable build/check commands exercise the Node 18+ compatibility distribution without SEA.

## Definition of Offline IDE Ready

Patch Studio can advertise a **fully offline IDE** only when the installed product can be launched after network disconnection and complete authoring, Run and host-native Build for an already installed toolchain without fetching code, modules, compiler files or runtime templates.

Stage 1 may be advertised more narrowly as the **Patch Studio Offline IDE beta** for offline authoring, Designer/Run and current browser-local build targets. The Stage 1 wording must not imply that host-native desktop builds are already performed inside the IDE.
