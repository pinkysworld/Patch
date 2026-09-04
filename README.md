# Patch

Patch is a small **change-oriented programming language** with a source-backed RAD IDE, standalone Web output, offline tooling, versioned native desktop runtimes, and formal-assurance experiments.

**Existing persistent state does not mutate invisibly.** Ordinary post-creation mutation is an explicit semantic `change`.

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Patch Studio](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml)
[![Offline Studio](https://github.com/pinkysworld/Patch/actions/workflows/offline-studio.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/offline-studio.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Docs](https://minh.systems/Patch/docs.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html)

## Current status

| Surface | Current status |
|---|---|
| Patch | **0.2.0-beta.36** |
| Change IR | **0.10** |
| Studio project format | **v4** |
| Current native Ready line | **Native GUI IR 1.9 / payload v19 / runtime v1.10** |
| Offline Studio | rolling **`offline-studio-v0.2`** with Windows x64/ARM64, Linux x64/ARM64, macOS Apple Silicon/Intel, and portable Node 18+ |
| Offline compiler | rolling **`offline-compiler-v0.2`**, defaulting Window links to payload v19/runtime v1.10 |
| Offline native Build in Studio | **Stage 2 R0.1 secure localhost bridge implemented in source; installed UI/toolchain integration still in progress** |

## A tiny Patch program

```patch
create number score = 0

change score:
  add 1

show score
```

Patch also supports text, booleans, lists, prototype-free Things, recipes, GUI Forms, controls, events, Web output, direct WebAssembly for the supported numeric subset, and portable C99.

## Patch Studio

Patch Studio is moving toward a Delphi / Visual Basic style RAD workflow while keeping ordinary Patch source authoritative. Forms, controls, layout, handlers, and structural component data remain reviewable instead of being hidden in a parallel form graph.

Current Studio highlights:

- source-backed **multi-Form Designer** and searchable Component Palette;
- Object Inspector with Properties and Events;
- project bundle **v4**, Project Tree, recovery, resources, and `file:line` diagnostics;
- Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer, ImageList, and Menu authoring;
- **Table exposes the selected row as a transient text-list**; persistent application state still changes only through ordinary Patch `change` semantics;
- Anchors/Dock, grid snap, alignment, sizing, distribution, z-order, and Focus Order Stage 1;
- source-backed Undo/Redo;
- source-backed **Copy/Cut/Paste across Forms and projects**, with collision-safe id/event remapping, semantic clipboard validation, Designer shortcuts and Command Palette integration;
- structural editors for Table, TreeView, Tabs, and Panel;
- active-Form Designer materialization and keyed incremental runtime rendering;
- standalone Web builds, token-free native Ready builds, Offline Compiler kits, and the downloadable Offline Studio beta.

Open **Workshop desk** from Examples for the main RAD showcase and stress fixture.

See [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) and [`docs/RAD_STUDIO_MASTER_BACKLOG.md`](docs/RAD_STUDIO_MASTER_BACKLOG.md) for the full IDE contract and backlog.

## Native desktop status

The product-facing native contract is **Native GUI IR 1.9 / sealed payload v19 / desktop runtime v1.10**.

The Current Ready line is the token-free Ready/offline path for Windows, macOS, and Linux. It includes the established native component surface plus Shape, PaintBox Stage 1, bounded PNG/JPEG `draw image`, Button `ImageList` images, and application/Form icons.

Versioned compatibility remains explicit:

- **IR 1.8 / payload v18 / runtime v1.9** is the Button/ImageList underlay;
- **IR 1.9 / payload v19 / runtime v1.10** adds application/Form icon transport and is the Current Ready line;
- explicit payload v17/runtime v1.8 remains available for Offline Compiler compatibility;
- PNG/JPEG are the current Ready native Picture/paint image formats; WebP/SVG remain deferred and fail closed on native targets.

See [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md), [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md), and [`docs/WINDOW_ICONS.md`](docs/WINDOW_ICONS.md).

## Offline Studio

`offline-studio-v0.2` currently publishes the complete verified release matrix:

- Windows x64: `PatchStudio-windows-x64.exe`
- Windows ARM64: `PatchStudio-windows-arm64.exe`
- macOS Apple Silicon: `PatchStudio-macos-arm64`
- macOS Intel embedded-runtime kit: `PatchStudio-macos-x64.tar.gz`
- Linux x64: `PatchStudio-linux-x64`
- Linux ARM64: `PatchStudio-linux-arm64`
- Portable Node 18+: `PatchStudio-portable-node18.tar.gz`
- Release manifest: `offline-studio-manifest.json`
- Release checksums: `SHA256SUMS`

The portable bundle is also executed in a real FreeBSD 15 x64 VM in CI. The macOS Intel archive carries its own Intel Node runtime.

### Offline native Build status

Stage 2 R0.1 includes a narrow authenticated localhost bridge using protocol `patch-offline-build-bridge/0.1`. It binds to `127.0.0.1`, accepts only versioned native-build requests, uses a per-launch capability token, canonicalizes workspace/source paths, rejects traversal and symlink escapes, fixes output beneath `.patch-build/native/<requestId>`, and exposes no general shell/argv/environment API.

The installed Offline Studio distributions do **not** yet expose host-native desktop Build as a completed user-facing workflow. Remaining work includes packaging the compiler/current host runtime beside Studio, explicit workspace-open authority, capability delivery to the UI, visible Build wiring, structured artifact diagnostics, and real installed-distribution native-build self-smokes.

See [`docs/OFFLINE_STUDIO.md`](docs/OFFLINE_STUDIO.md).

## Offline Compiler

`offline-compiler-v0.2` provides token-free compiler/linker kits for Windows, Linux, macOS Apple Silicon, macOS Intel, and a FreeBSD Console path. Current Ready Window linking defaults to **payload v19/runtime v1.10** and preserves explicit `--gui-payload-version 17` compatibility.

See [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md).

## CLI examples

```bash
patch check app.patch --json
patch build app.patch --target web
patch link app.patch --out App
patch doctor --json
patch components --json
```

Useful repository commands:

```bash
npm test
npm run check:site
npm run check:project
npm run check:offline-studio
npm run build:site
```

## Design principles

1. **Source-backed by default.** Designer edits round-trip through Patch source or explicit versioned project/resource data.
2. **Explicit persistent change.** Existing persistent state changes through semantic `change` operations.
3. **Fail closed.** Unsupported target behavior is diagnosed rather than silently omitted.
4. **Versioned native contracts.** GUI capabilities move through explicit IR, payload, and runtime versions.
5. **Offline core.** Normal authoring and token-free Ready builds must not depend on a user-supplied GitHub token.
6. **Reproducible evidence.** CI, release digests, compatibility tests, and formal experiments remain inspectable.

## Formal assurance boundary

Patch includes Lean-backed and runtime-correspondence experiments for defined language subsets. The current formal milestone remains **beta.32** and does **not** claim full compiler, runtime, Studio, or native-GUI verification.

See [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md).

## Documentation map

| Document | Purpose |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Language surface |
| [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) | IDE, project, Designer, and build contracts |
| [`docs/RAD_STUDIO_MASTER_BACKLOG.md`](docs/RAD_STUDIO_MASTER_BACKLOG.md) | Long-term RAD execution backlog |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Product priorities and evidence gates |
| [`docs/STUDIO_PROJECTS.md`](docs/STUDIO_PROJECTS.md) | Project bundle v4 and resources |
| [`docs/COMPONENT_CAPABILITY_MATRIX.md`](docs/COMPONENT_CAPABILITY_MATRIX.md) | Generated component/target matrix |
| [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md) | Native GUI contracts |
| [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md) | Current and preserved native lines |
| [`docs/OFFLINE_STUDIO.md`](docs/OFFLINE_STUDIO.md) | Offline IDE channel and local-build plan |
| [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md) | Offline compiler/linker kits |
| [`AGENTS.md`](AGENTS.md) / [`docs/GPT.md`](docs/GPT.md) | Development handoff/current contract notes |

Patch is an active research/prototype language and IDE. Capability and version labels are kept explicit so experiments do not silently become product claims.

## License

MIT. See [`LICENSE`](LICENSE).
