# Patch Studio Offline IDE

Status: **Stage 1 multi-platform release channel implemented; Stage 2 R0.2 host-native Build integrated for Windows x64, macOS Apple Silicon and Linux x64**

Patch Studio is intended to be usable as a real offline IDE, not merely as a website that happens to remain in a browser cache. The offline product keeps Patch's local-first model and uses the same source-backed Studio modules as the public site.

## Download

The rolling beta release channel is **`offline-studio-v0.2`**. The cross-platform workflow builds and self-smokes every published platform distribution before release assets are refreshed.

Stable download URLs:

- Windows x64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-windows-x64.exe`
- Windows ARM64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-windows-arm64.exe`
- macOS Apple Silicon: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-macos-arm64`
- macOS Intel runtime kit: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-macos-x64.tar.gz`
- Linux x64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-linux-x64`
- Linux ARM64: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-linux-arm64`
- Portable Node 18+ compatibility bundle: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/PatchStudio-portable-node18.tar.gz`
- Generated-site manifest: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/offline-studio-manifest.json`
- SHA-256 checksums: `https://github.com/pinkysworld/Patch/releases/download/offline-studio-v0.2/SHA256SUMS`

The public Patch Downloads page is the human-facing entry point: `https://minh.systems/Patch/downloads.html`.

## Platform contract

Patch currently publishes three Offline Studio distribution classes:

1. **Self-contained SEA executables**, built and executed in CI on Windows x64, Windows ARM64, macOS Apple Silicon, Linux x64 and Linux ARM64.
2. **macOS Intel embedded-runtime kit**, built and executed on an Intel macOS CI host. It carries its own Intel Node runtime because the current Node 26 direct `--build-sea` path is not reliable on macOS x64.
3. **Portable Node compatibility bundle**, for systems where Patch does not publish a host-specific self-contained distribution. This path requires Node.js 18+ and a modern local browser. The same bundle is executed inside a FreeBSD 15 x64 VM in CI.

All three classes carry the same generated Patch Studio site contract. Portable and runtime-kit runners verify bundled Studio assets before serving them.

### Installed host-native Build availability

Stage 2 R0.2 packages a matching SHA-256-pinned Patch Offline Compiler into these self-contained distributions:

| Offline Studio host | Installed native Build |
|---|---|
| Windows x64 | Yes, Windows Window apps |
| macOS Apple Silicon | Yes, macOS Window apps |
| Linux x64 | Yes, Linux Window apps |
| Windows ARM64 | Not yet, fail-closed |
| Linux ARM64 | Not yet, fail-closed |
| macOS Intel runtime kit | Not yet, fail-closed |
| Portable Node bundle / FreeBSD path | Not yet, fail-closed |

Unsupported host/compiler combinations retain Stage 1 authoring, Designer/Run and browser-local build targets. Patch does not pretend that a matching native compiler exists where it does not.

## Release integrity and signing boundary

Every host-specific distribution is launched and self-smoked on its target CI architecture before publication. The generated-site `offline-studio-manifest.json` remains platform-neutral and byte-identical across the six host-specific distributions.

Compiler platform, architecture and compiler SHA-256 are deliberately not written into that public cross-platform site manifest. They live in the executable's embedded runtime manifest instead. This preserves both properties:

- deterministic equality of the generated Studio site closure across platforms;
- exact host-specific evidence for the compiler actually embedded into a Stage 2 executable.

The publish job generates `SHA256SUMS` for the exact release bytes and verifies every required release asset.

This remains a development/beta release channel, not a claim of commercial code signing:

- Windows development binaries are currently unsigned by Authenticode;
- Linux development binaries are unsigned;
- the macOS Apple Silicon SEA is ad-hoc signed for local execution but is not Developer ID signed or notarized;
- the macOS Intel runtime kit is an integrity-checked archive, not a Developer ID notarized application bundle;
- the portable Node compatibility bundle is integrity-checked but is not an OS-signed application package.

## Product contract

The offline IDE is being built toward this workflow with no GitHub account, token or network connection:

1. launch Patch Studio from a local executable, embedded-runtime kit or portable compatibility bundle;
2. create/import/export Patch projects and resources;
3. edit source and use the Form Designer/Object Inspector;
4. Run locally;
5. build Standalone Web, portable Patch bundles and WebAssembly locally;
6. build a host-native Windows/macOS/Linux Window application locally when that distribution carries a matching compiler/runtime set;
7. keep project data and diagnostics local unless the user explicitly exports or chooses an online action.

Stage 1 covers items 1-5 across the release channel. Stage 2 R0.2 now implements item 6 for Windows x64, macOS Apple Silicon and Linux x64.

Online services remain optional accelerators for updates, remote builds and publishing. They are not part of the core installed IDE execution contract.

## Stage 1 foundation

The implemented Stage 1 foundation includes:

- current-host SEA builds where Node's direct SEA path is supported;
- an embedded-runtime kit builder;
- a Node 18+ portable compatibility bundle;
- deterministic `patch-offline-studio-manifest` v1 with SHA-256 for every Studio file and a closure hash;
- the complete generated Patch Studio site in every distribution class;
- an ephemeral loopback server bound only to `127.0.0.1`;
- a random per-launch URL prefix;
- traversal rejection and restrictive security headers;
- portable/runtime-kit byte-length and SHA-256 verification before a bundled asset is served;
- automatic browser launch with a printed local URL as fallback;
- self-smoke modes that request the IDE over loopback and validate HTTP/CSP;
- verified self-contained builds for Windows x64/ARM64, macOS Apple Silicon and Linux x64/ARM64;
- a verified embedded-runtime Intel macOS kit;
- a generic Node 18+ portable compatibility bundle;
- a real FreeBSD 15 x64 VM gate for the portable bundle;
- rolling `offline-studio-v0.2` publication only after the complete matrix succeeds;
- platform-neutral six-way generated-site manifest equality before publication;
- release `SHA256SUMS` plus post-upload asset verification;
- fail-closed validation if critical Studio assets are missing.

The distributions use the same generated site closure as the hosted Studio. The offline IDE is not a forked second IDE implementation.

## Stage 2 R0.2: installed host-native Build

The current Stage 2 slice adds:

- `patch-offline-build-bridge/0.1`;
- `patch-offline-workspace-snapshot/0.1`;
- an explicit `--workspace <directory>` authority;
- a separate random per-launch bridge bearer token;
- exact local Studio origin restriction for browser bridge access;
- source snapshots under `.patch-studio/snapshots/<requestId>`;
- native outputs under `.patch-build/native/<requestId>`;
- a bundled current Patch Offline Compiler whose bytes are SHA-256 recorded and reverified before execution;
- fixed host-side `patch link` invocation with no browser-controlled executable path, argv, environment or output directory;
- artifact metadata containing filename, MIME type, byte size and SHA-256;
- authenticated opaque artifact download URLs;
- Studio Build UI integration that appears only when the selected native target matches the installed host capability;
- end-to-end CI self-smoke for the supported Stage 2 hosts.

The CI smoke is intentionally stronger than checking that the bridge starts. It exercises:

```text
current Studio source
  -> workspace snapshot
  -> bundled offline compiler
  -> host-native linked artifact
  -> authenticated artifact download
  -> SHA-256 equality verification
```

See `docs/OFFLINE_BUILD_BRIDGE.md` for the privileged boundary.

### Current Stage 2 limitations

The initial installed path intentionally remains narrow:

- only Window host-native builds are exposed;
- no cross-compilation contract is implied;
- project-v4 binary resources are not materialized through the host bridge yet;
- resource-backed Picture, ImageList and application-icon projects fail closed in installed-host mode rather than silently losing resources;
- Windows ARM64, Linux ARM64, macOS Intel and generic portable distributions do not expose installed host-native Build until matching compiler/runtime artifacts exist.

The existing Ready native build path remains available for resource-backed projects while the bounded resource snapshot contract is implemented.

## Running the host-specific distributions

Normal launch remains unchanged.

Windows x64:

```text
PatchStudio-windows-x64.exe
```

macOS Apple Silicon:

```text
chmod +x PatchStudio-macos-arm64
./PatchStudio-macos-arm64
```

Linux x64:

```text
chmod +x PatchStudio-linux-x64
./PatchStudio-linux-x64
```

To authorize Stage 2 host-native Build, launch a supported distribution with an explicit workspace.

Windows x64:

```text
PatchStudio-windows-x64.exe --workspace C:\path\to\project
```

macOS Apple Silicon:

```text
./PatchStudio-macos-arm64 --workspace /path/to/project
```

Linux x64:

```text
./PatchStudio-linux-x64 --workspace /path/to/project
```

The browser receives only the per-launch capability for the versioned snapshot/build/artifact endpoints. It does not receive general filesystem or process authority.

Windows ARM64, Linux ARM64 and macOS Intel continue to launch normally but currently do not advertise the `offline-installed` native Build mode.

### macOS Intel

```text
tar -xzf PatchStudio-macos-x64.tar.gz
chmod +x patch-studio runtime/node
./patch-studio
```

The Intel archive includes the Intel Node runtime used by CI. A separate Node installation is not required.

Because the macOS beta distributions are not Developer ID notarized, macOS may require an explicit local trust/open action depending on Gatekeeper policy.

## Portable Unix/POSIX compatibility bundle

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

Direct launch:

```text
node PatchStudio.cjs
```

The generic portable archive intentionally does not bundle one platform's compiler and then claim that compiler on every Node host. It therefore remains Stage 1/browser-local only. Platform-specific portable/runtime-kit packaging may add Stage 2 later when the matching host compiler contract exists.

The portable distribution is exercised in a real FreeBSD 15 x64 VM. That verifies the Node/browser compatibility path, not a native FreeBSD SEA or Window runtime.

## Verify a release download

Place `SHA256SUMS` beside the downloaded asset.

Linux and many Unix systems:

```text
sha256sum -c SHA256SUMS --ignore-missing
```

macOS Apple Silicon:

```text
shasum -a 256 PatchStudio-macos-arm64
```

macOS Intel archive:

```text
shasum -a 256 PatchStudio-macos-x64.tar.gz
```

Windows PowerShell:

```text
Get-FileHash .\PatchStudio-windows-x64.exe -Algorithm SHA256
```

Compare the resulting digest with the corresponding line in `SHA256SUMS`.

## Build requirement for contributors

The self-contained executable builder uses Node's direct `--build-sea` support and requires **Node 25.5.0 or newer**. Normal Patch development may continue on the repository's broader supported Node range.

The portable compatibility bundle requires Node.js 18 or newer and does not use `node:sea`. The embedded-runtime kit packages the exact host Node executable used to build the kit.

For Stage 2-capable SEA builds, pass a matching host-native Offline Compiler to the builder:

```text
node scripts/build-offline-studio.js --offline-compiler /path/to/patch-offline-compiler
```

The release workflow builds that compiler from the same repository revision and Current Ready v1.10 runtime for Windows x64, Linux x64 and macOS Apple Silicon before building/self-smoking Offline Studio.

The published generic site manifest remains platform-neutral even in Stage 2 builds. Host-specific compiler metadata is embedded only into the executable runtime manifest.

## Security boundary

The installed IDE has more authority than the hosted Studio because native Build requires local process/filesystem access. Therefore:

- the browser UI never receives a general shell-execution API;
- local build endpoints accept only versioned Patch operations;
- a per-launch secret protects the privileged localhost bridge;
- bridge browser access is restricted to the exact local Studio origin;
- project paths are canonicalized and restricted to the explicitly opened workspace;
- snapshot/output path components reject symbolic-link escapes;
- runtime/compiler binaries are versioned and integrity checked;
- online URLs are never required to run/build an already installed supported project;
- unsupported host/compiler combinations fail closed.

## Current commands

```text
npm run build:offline-studio
npm run check:offline-studio
node scripts/build-portable-offline-studio.js
node scripts/check-portable-offline-studio.js
node scripts/build-offline-studio-runtime-kit.js
node scripts/check-offline-studio-runtime-kit.js
node scripts/build-offline-studio.js --offline-compiler /path/to/matching/compiler
```

## Next Stage 2 work

1. add a bounded project-v4 binary-resource snapshot/materialization contract;
2. integrate richer structured compiler diagnostics into the Studio artifact pane;
3. add Windows ARM64, Linux ARM64 and macOS Intel installed builds when matching compiler/runtime distributions are published and verified;
4. decide whether Console installed Build needs a separate narrow bridge action;
5. keep remote/fresh CI Build as an optional separate target.

Cross-compiling every desktop platform from every host is not required. Patch should first provide a predictable host-native local build contract everywhere it claims support.

## Definition of Offline IDE Ready

For a supported Stage 2 host, Patch Studio can now launch after network disconnection and complete authoring, Run and a Window host-native Build using only the installed toolchain for source-only projects.

The broader **fully offline IDE** claim across all published architectures and project-v4 resource-backed projects remains open until the remaining Stage 2 gaps above are closed.
