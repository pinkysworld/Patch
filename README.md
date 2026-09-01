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
| Button/ImageList layer | **IR 1.8 / payload v18 / runtime v1.9**, preserved inside the Current Ready compatibility stack |
| Window/application icons | **Current Ready** on Windows, macOS, and Linux through IR 1.9 / payload v19 / runtime v1.10 |
| Offline Studio | rolling **`offline-studio-v0.2`** channel |
| Offline compiler | rolling **`offline-compiler-v0.2`** channel, defaulting Window links to payload v19/runtime v1.10 |

Native capabilities are promoted only after cross-platform runtime, packaging, release-integrity, and Offline Compiler evidence passes. Older payload lines remain explicit compatibility contracts rather than being silently reinterpreted.

## A tiny Patch program

```patch
create number score = 0

change score:
  add 1

show score
```

Patch also supports text, booleans, lists, prototype-free Things, recipes, GUI Forms, controls, events, Web output, direct WebAssembly for the supported numeric subset, and portable C99.

## Patch Studio

Patch Studio aims for a Delphi / Visual Basic style RAD workflow while keeping ordinary Patch source authoritative. Forms, controls, layout, handlers, and structural component data remain visible and reviewable instead of being hidden in a separate form graph.

### What is already there

- source-backed **multi-Form Designer** and searchable Component Palette;
- Object Inspector with Properties and Events;
- project bundle **v4**, Project Tree, recovery, resources, and `file:line` diagnostics;
- Resource Manager with deterministic SHA-256 metadata;
- Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer, ImageList, and Menu authoring;
- Table exposes the selected row as a transient text-list; persistent state still changes only through ordinary Patch `change` semantics;
- nonvisual component tray for Timer and ImageList;
- Anchors/Dock, grid snap, alignment, sizing, distribution, z-order, and Focus Order Stage 1;
- source-backed Undo/Redo for editor and Designer changes;
- structural editors for Table, TreeView, Tabs, and Panel;
- active-Form Designer materialization for larger projects;
- keyed incremental runtime rendering with bounded transient Table/Tree selection restoration;
- Command Palette and project/symbol navigation;
- standalone Web builds, token-free native Ready builds, Offline Compiler kits, and the downloadable Offline Studio beta.

Open **Workshop desk** from Examples for the main RAD showcase and stress fixture.

For the full IDE contract and long-term backlog, see [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) and [`docs/RAD_STUDIO_MASTER_BACKLOG.md`](docs/RAD_STUDIO_MASTER_BACKLOG.md).

## Native desktop status

The product-facing native contract is:

**Native GUI IR 1.9 / sealed payload v19 / desktop runtime v1.10**

[`src/native-current-contract.js`](src/native-current-contract.js) owns the product-facing Current Ready boundary. [`src/native-frozen-contract.js`](src/native-frozen-contract.js) preserves the explicit frozen compatibility line. The v1.10 promotion is backed by cross-platform runtime smoke, immutable release/digest checks, application-icon packaging, and dual-runtime Offline Compiler tests on Windows, Linux, macOS Apple Silicon, and macOS Intel.

The Current Ready line is the token-free Ready/offline path for Windows, macOS, and Linux. It includes the established native component surface plus Shape, PaintBox Stage 1, bounded PNG/JPEG `draw image`, Button `ImageList` images, and application/Form icons.

The versioned stack remains intentionally layered:

- **IR 1.8 / payload v18 / runtime v1.9** introduced Button `ImageList` image transport and Win32/AppKit/GTK consumers. It is now the compatibility underlay inside Current Ready v1.10.
- **IR 1.9 / payload v19 / runtime v1.10** adds bounded, deduplicated application/Form icon transport over that complete Button/ImageList layer. Windows supports runtime icons plus project-specific PE application-icon embedding, macOS packages `.icns` with `CFBundleIconFile`, and Linux packages hicolor PNG plus `.desktop` metadata.
- Explicit payload v17/runtime v1.8 remains available for compatibility in the Offline Compiler. It is not the default Current Ready output.
- Native Picture and paint-image decoding currently treat PNG/JPEG as Ready formats. WebP/SVG remain deferred under `native-picture-formats/1.0` and fail closed on native targets.

See [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md), [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md), and [`docs/WINDOW_ICONS.md`](docs/WINDOW_ICONS.md) for contract details.

## Offline Studio and compiler

Patch has two rolling offline channels:

### Patch Studio Offline IDE

`offline-studio-v0.2` currently publishes:

- Windows x64: `PatchStudio-windows-x64.exe`
- macOS Apple Silicon: `PatchStudio-macos-arm64`
- Linux x64: `PatchStudio-linux-x64`

Stage 1 provides offline authoring, Designer/Run, and existing browser-local build targets. Host-native desktop compilation directly from inside the installed IDE is still the Stage 2 goal.

### Offline Compiler

`offline-compiler-v0.2` provides token-free compiler/linker kits for Windows, Linux, macOS Apple Silicon, and macOS Intel. Current Ready Window linking defaults to **payload v19/runtime v1.10** and carries a separate runtime-v1.8 underlay for explicit `--gui-payload-version 17` compatibility. FreeBSD remains Console-only through portable C99.

See [`docs/OFFLINE_STUDIO.md`](docs/OFFLINE_STUDIO.md) and [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md).

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

`patch components` prints the canonical Designer registry and target matrix. `patch doctor` runs environment and backend self-checks.

## Design principles

Patch development follows a few strict rules:

1. **Source-backed by default.** Designer edits round-trip through Patch source or explicit versioned project/resource data.
2. **Explicit persistent change.** Existing persistent state changes through semantic `change` operations.
3. **Fail closed.** Unsupported target behavior is diagnosed rather than silently omitted.
4. **Versioned native contracts.** New GUI capabilities move through explicit IR, payload, and runtime versions.
5. **Offline core.** Normal authoring and token-free Ready builds must not depend on a user-supplied GitHub token.
6. **Reproducible evidence.** CI, release digests, compatibility tests, and formal experiments are kept inspectable.

## Formal assurance boundary

Patch includes Lean-backed and runtime-correspondence experiments for defined language subsets. The current formal milestone remains **beta.32** and does **not** claim full compiler, runtime, Studio, or native-GUI verification. Later RAD and native work does not silently widen that claim.

See [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md) for the exact scope.

## Documentation map

| Document | Purpose |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Language surface |
| [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) | IDE, project, Designer, and build contracts |
| [`docs/RAD_STUDIO_MASTER_BACKLOG.md`](docs/RAD_STUDIO_MASTER_BACKLOG.md) | Long-term RAD execution backlog |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Current product priorities and evidence gates |
| [`docs/STUDIO_PROJECTS.md`](docs/STUDIO_PROJECTS.md) | Project bundle v4 and resources |
| [`docs/COMPONENT_CAPABILITY_MATRIX.md`](docs/COMPONENT_CAPABILITY_MATRIX.md) | Generated component/target matrix |
| [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md) | Native GUI contracts |
| [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md) | Current and preserved native lines |
| [`docs/NATIVE_PICTURE_FORMATS.md`](docs/NATIVE_PICTURE_FORMATS.md) | Native PNG/JPEG vs deferred WebP/SVG policy |
| [`docs/WINDOW_ICONS.md`](docs/WINDOW_ICONS.md) | Form/application icon contract |
| [`docs/OFFLINE_STUDIO.md`](docs/OFFLINE_STUDIO.md) | Installed IDE channel and local-build plan |
| [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md) | Offline compiler/linker kits |
| [`AGENTS.md`](AGENTS.md) / [`docs/GPT.md`](docs/GPT.md) | Development handoff and current contract notes |
| [`paper/README.md`](paper/README.md) | Repository paper sources |

Patch is an active research/prototype language and IDE. Capability and version labels are kept explicit so experiments do not silently become product claims.

## License

MIT. See [`LICENSE`](LICENSE).
