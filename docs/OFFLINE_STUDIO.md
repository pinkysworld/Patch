# Patch Studio Offline IDE

Status: **Stage 1 multi-platform release channel implemented; Stage 2 R0.2 host-native Build integrated for Windows x64, macOS Apple Silicon and Linux x64, including bounded project-v4 image resources and complete Linux desktop artifacts**

Patch Studio is intended to work as a real offline IDE rather than merely a cached website. The installed product uses the same generated Studio modules as the public site and keeps normal authoring, Designer, Run and supported Build workflows local.

## Download

The rolling beta release channel is **`offline-studio-v0.2`**.

Stable release assets:

- Windows x64: `PatchStudio-windows-x64.exe`
- Windows ARM64: `PatchStudio-windows-arm64.exe`
- macOS Apple Silicon: `PatchStudio-macos-arm64`
- macOS Intel runtime kit: `PatchStudio-macos-x64.tar.gz`
- Linux x64: `PatchStudio-linux-x64`
- Linux ARM64: `PatchStudio-linux-arm64`
- Portable Node 18+ compatibility bundle: `PatchStudio-portable-node18.tar.gz`
- generated-site manifest: `offline-studio-manifest.json`
- release checksums: `SHA256SUMS`

The human-facing download page is `https://minh.systems/Patch/downloads.html`.

## Platform contract

Patch currently publishes three Offline Studio distribution classes:

1. self-contained SEA executables on Windows x64/ARM64, macOS Apple Silicon and Linux x64/ARM64;
2. a macOS Intel embedded-runtime kit with its own Intel Node runtime;
3. a portable Node 18+ compatibility bundle, including the FreeBSD 15 x64 CI path.

All classes carry the same generated Patch Studio site closure.

### Installed host-native Build availability

Stage 2 R0.2 packages a matching SHA-256-pinned Patch Offline Compiler into these distributions:

| Offline Studio host | Installed native Build |
|---|---|
| Windows x64 | Yes, Windows Window apps |
| macOS Apple Silicon | Yes, macOS Window apps |
| Linux x64 | Yes, Linux Window apps |
| Windows ARM64 | Not yet, fail-closed |
| Linux ARM64 | Not yet, fail-closed |
| macOS Intel runtime kit | Not yet, fail-closed |
| Portable Node bundle / FreeBSD path | Not yet, fail-closed |

Windows ARM64, Linux ARM64, macOS Intel and the portable Node bundle remain Stage 1/browser-local only until matching host-native compiler/runtime distributions exist.

## Release integrity and signing boundary

Every host-specific distribution is launched and self-smoked on its target CI architecture before publication. The generated-site `offline-studio-manifest.json` remains platform-neutral and byte-identical across the host-specific distributions.

Compiler platform, architecture and compiler SHA-256 live only in the executable's embedded runtime manifest. The publish job generates `SHA256SUMS` for the exact release bytes.

This is still a beta/development channel:

- Windows binaries are currently unsigned by Authenticode;
- Linux binaries are unsigned;
- macOS Apple Silicon is ad-hoc signed for local execution, not Developer ID notarized;
- the macOS Intel kit and portable Node bundle are integrity-checked archives rather than notarized application packages.

## Product contract

The offline workflow is:

1. launch Patch Studio locally;
2. create/import/export Patch projects and project-v4 resources;
3. edit source and use the Form Designer/Object Inspector;
4. Run locally;
5. build Standalone Web, portable Patch bundles and WebAssembly locally;
6. on a supported Stage 2 host, build a native Window application with the bundled compiler;
7. keep project data and diagnostics local unless the user explicitly exports or chooses an online action.

Normal local workflows do not need a GitHub account or token.

## Stage 1 foundation

The Stage 1 release foundation includes:

- generated Studio site closure embedded in every distribution;
- deterministic `patch-offline-studio-manifest` v1 with SHA-256 evidence;
- loopback-only serving on `127.0.0.1` with a random URL prefix;
- restrictive CSP and traversal rejection;
- local Designer/Run and browser-local build targets;
- Windows x64/ARM64, macOS Apple Silicon, Linux x64/ARM64 executable smoke coverage;
- Intel macOS runtime-kit coverage;
- portable Node coverage and a real FreeBSD 15 x64 VM gate;
- deterministic release-bundle verification before publication.

## Stage 2 R0.2: installed host-native Build

The current Stage 2 slice uses:

- `patch-offline-build-bridge/0.2`;
- `patch-offline-workspace-snapshot/0.2`;
- explicit `--workspace <directory>` authority;
- a separate random per-launch bridge bearer token;
- exact local Studio origin restriction;
- project snapshots under `.patch-studio/snapshots/<requestId>`;
- native outputs under `.patch-build/native/<requestId>`;
- a bundled current Patch Offline Compiler whose bytes are SHA-256 recorded and reverified before execution;
- fixed host-side `patch link` invocation with no browser-controlled executable, argv, environment or output directory;
- authenticated opaque artifact downloads with artifact SHA-256 evidence.

Installed Studio now sends its existing canonical **project-v4 bundle** rather than a separate ad-hoc resource protocol. The host independently validates the project and materializes exactly one `project.patchproject`. The existing Offline Compiler then reads that file through the normal project-v4 input path.

That means current project-v4 image resources are supported in the installed native Build path on Windows x64, Linux x64 and macOS Apple Silicon, including:

- Picture resources already supported by the Current Ready native line;
- ImageList/Button images;
- application and Form Window icons.

The bridge validates resource ids, project-relative paths, supported image media types, canonical base64, byte sizes and SHA-256 digests before accepting the snapshot. It does not accept arbitrary browser-selected resource filesystem paths.

### Linux desktop artifact packaging

The Current Ready Linux linker can emit three files for an application-icon project: the native executable, a hicolor PNG and a `.desktop` entry. Offline Studio now preserves that complete output contract.

When those Linux desktop sidecars are present, the installed Linux x64 Build returns one deterministic `<stem>-linux.tar.gz` artifact containing:

```text
<stem>
share/icons/hicolor/<size>x<size>/apps/<stem>.png
share/applications/<stem>.desktop
```

The archive is produced by the privileged Node adapter with fixed, safe relative entry names. It does not invoke a general shell or depend on a system archive command. Gzip timestamp and OS-header fields are normalized so the same input bytes produce the same bundle bytes.

For Linux projects without application-icon sidecars, Offline Studio preserves the existing direct executable download instead of wrapping every build in an archive. Windows remains a direct `.exe` artifact and macOS remains a `.app.zip` artifact.

### Resource limits

The privileged snapshot boundary is deliberately bounded:

- at most 64 Patch source files;
- at most 2 MiB per source file;
- at most 8 MiB aggregate Patch source;
- at most 128 resources;
- at most 2 MiB decoded bytes per resource;
- at most 8 MiB aggregate decoded resource bytes;
- at most 22 MiB serialized project snapshot;
- accepted resource media types remain the canonical Studio image types: PNG, JPEG, WebP and SVG.

The downstream native runtimes may support a narrower image decode set for individual controls. Unsupported target/resource combinations still fail closed.

### Current Stage 2 limitations

The installed privileged path remains narrow:

- only Window host-native builds are exposed;
- no cross-compilation contract is implied;
- Windows ARM64, Linux ARM64, macOS Intel and generic portable distributions do not expose installed host-native Build yet;
- Console installed Build is not yet exposed through a separate narrow action;
- richer structured compiler diagnostics remain future work.

## Running supported Stage 2 builds

Windows x64:

```text
PatchStudio-windows-x64.exe --workspace C:\path\to\project
```

macOS Apple Silicon:

```text
chmod +x PatchStudio-macos-arm64
./PatchStudio-macos-arm64 --workspace /path/to/project
```

Linux x64:

```text
chmod +x PatchStudio-linux-x64
./PatchStudio-linux-x64 --workspace /path/to/project
```

The browser receives only the per-launch capability for the versioned snapshot/build/artifact endpoints. It receives no general filesystem or process API.

## Portable and Intel compatibility paths

macOS Intel:

```text
tar -xzf PatchStudio-macos-x64.tar.gz
chmod +x patch-studio runtime/node
./patch-studio
```

Portable Node 18+:

```text
chmod +x patch-studio
./patch-studio
```

or on Windows with Node installed:

```text
PatchStudio.cmd
```

These compatibility distributions remain Stage 1/browser-local only until matching host-native compiler/runtime packaging is promoted.

## CI proof

For Windows x64, Linux x64 and macOS Apple Silicon, CI builds the matching Offline Compiler from the same repository revision and Current Ready v1.10 runtime. It then verifies two paths.

The executable self-smoke verifies the installed Studio capability and a normal source-only host-native Build.

A second real resource-backed smoke verifies:

```text
canonical project-v4 with application icon + ImageList/Button image
  -> authenticated workspace project snapshot
  -> independent resource size/SHA-256 validation
  -> bundled Offline Compiler
  -> Current Ready native resource packaging
  -> host-native artifact
  -> authenticated artifact download
  -> artifact SHA-256 equality
```

On Linux x64 this path now passes through the complete desktop `.tar.gz` artifact rather than discarding the linker-generated icon and `.desktop` sidecars. Dedicated tests also verify deterministic gzip bytes, tar entry modes/content and fail-closed handling of incomplete or unsafe bundle entries.

This is stronger than checking only that the bridge starts.

## Security boundary

The installed IDE has more authority than the hosted Studio, so the privileged boundary remains intentionally small:

- no general shell endpoint;
- no browser-selected executable or arbitrary argv;
- no browser-selected environment map;
- no absolute browser-selected source/resource/output path;
- loopback-only authenticated bridge;
- exact Studio origin restriction;
- canonical workspace confinement and symlink-escape rejection;
- bounded project-v4 validation before writing a snapshot;
- independent resource SHA-256 verification;
- output confinement under `.patch-build/native/<requestId>`;
- artifact regular-file and SHA-256 verification;
- fixed safe Linux desktop archive entries when sidecar packaging is required.

See `docs/OFFLINE_BUILD_BRIDGE.md` for the exact protocol boundary.

## Current commands

```text
npm run build:offline-studio
npm run check:offline-studio
node scripts/build-portable-offline-studio.js
node scripts/check-portable-offline-studio.js
node scripts/build-offline-studio-runtime-kit.js
node scripts/check-offline-studio-runtime-kit.js
node scripts/build-offline-studio.js --offline-compiler /path/to/matching/compiler
node scripts/check-offline-studio-resource-build.js
```

## Next Stage 2 work

1. add richer structured compiler diagnostics to the Studio artifact/output pane;
2. add Windows ARM64, Linux ARM64 and macOS Intel installed Build when matching compiler/runtime distributions are published and verified;
3. decide whether Console installed Build needs a separate narrow bridge action;
4. keep remote/fresh CI Build as an optional separate target.

## Definition of Offline IDE Ready

For the supported Stage 2 hosts, Patch Studio can launch without network access and complete authoring, Designer, Run and a host-native Window Build using only the installed toolchain, including current project-v4 image resources. Linux application-icon builds preserve their executable plus desktop/icon sidecars in one deterministic download artifact.

The broader fully-offline claim across every published architecture remains open until the unsupported Stage 2 host/compiler combinations are closed.
