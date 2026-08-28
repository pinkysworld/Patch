# Patch

A small **change-oriented** programming language with a browser-first RAD IDE, formal assurance tooling, standalone Web output and versioned native desktop runtimes.

**Existing persistent state does not mutate invisibly.** Ordinary post-creation mutation is an explicit semantic `change`.

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Patch Studio](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)

**Development beta `0.2.0-beta.36`** · **Change IR `0.10`** · **Native GUI IR `1.4`** · **sealed payload `v14`** · **desktop runtime `v1.5`** · **Studio project bundle `v4`**

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Documentation](https://minh.systems/Patch/docs.html) · [Paper](https://minh.systems/Patch/paper.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html)

```patch
create number score = 0
change score:
  add 1
show score
```

Values are numbers, text, booleans, lists and prototype-free Things. Thing fields are application data: `__proto__`, `prototype` and `constructor` are rejected, runtime records stay prototype-free, and equality compares own fields. Direct Wasm and portable C99 remain the numeric Console subset and fail closed on Things; that stays outside the beta.32 formal claim.

## Patch Studio

Patch Studio follows a Delphi / Visual Basic style RAD loop while keeping ordinary Patch source authoritative. Forms, controls, layout directives, event handlers and structural component data are visible source. Project resources are explicit versioned project data rather than a hidden form file.

Current Studio capabilities include:

- canonical **multi-file project bundle v4** with project resources, explicit v1-v3 migration, Project Tree/Outline, recovery and `file:line` diagnostics;
- project-level image Resource Manager with deterministic SHA-256 metadata and bounded PNG/JPEG/WebP/SVG storage;
- source-backed Designer with named Forms and searchable Component Palette;
- Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView, Tabs, Panel, Picture, Shape, PaintBox, StatusBar, Timer and ImageList authoring;
- a Delphi-style nonvisual component tray for Timer and ImageList;
- Object Inspector Properties / Events, handler creation/navigation and source-backed Anchors/Dock;
- multi-select alignment, sizing, distribution, z-order actions, grid snapping and Focus Order Stage 1;
- structural editors for Table, TreeView, Tabs and Panel;
- `Ctrl/Cmd+K` Command Palette with project files, Thing fields such as `player.score`, and recipe parameters such as `reward.bonus`;
- token-free Ready Windows/macOS/Linux downloads plus offline compiler/linker kits.

ImageList Stage 1 is intentionally authoring-only. It stores ordered named references to project resources and is designed for future ToolBar/Menu/Button/TreeView image consumers. Web/native Window builds fail closed if ImageList is present until that consumer/runtime contract is versioned.

Shape and PaintBox currently advertise Studio authoring plus Standalone Web support. Native Shape/PaintBox parity remains an explicit later gate rather than silently degrading. Picture has real project-resource transport and current desktop PNG/JPEG decoding; unsupported resource formats fail closed on native targets.

Open **Workshop desk** in Example for the current showcase application. See [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md), [`docs/RAD_STUDIO_MASTERPLAN.md`](docs/RAD_STUDIO_MASTERPLAN.md), [`docs/RAD_STUDIO_MASTER_BACKLOG.md`](docs/RAD_STUDIO_MASTER_BACKLOG.md), [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) and [`docs/BETA36.md`](docs/BETA36.md).

## GUI events

Toolkit interaction stays transient until source commits it through `change`:

- Input, ComboBox, Radio and text-backed ListBox expose text `value`;
- Checkbox exposes Boolean `value`;
- Slider exposes a bounded finite numeric `value`;
- list-backed ListBox exposes a transient text-list;
- Table exposes the selected row as a transient text-list;
- TreeView exposes the selected root-to-node path as a transient text-list;
- Timer exposes `ticked` on the current desktop line;
- Picture exposes `clicked`;
- PaintBox exposes the pure rendering event `paint`, whose body cannot commit persistent state;
- ImageList exposes no event in Stage 1.

## Native desktop

The product-facing current contract is **Native GUI IR 1.4 / sealed payload v14 / runtime v1.5**. Versioned older contracts remain compatibility evidence and are not silently reinterpreted.

| Line | IR / payload / runtime | Role |
|---|---|---|
| Current Ready/offline | Native GUI IR 1.4 / payload v14 / runtime v1.5 | Table, menus, TreeView, multi-select ListBox and Slider plus Chrome Stage 1 Panel, Timer, Picture and StatusBar |
| Slider compatibility | Native GUI IR 1.3 / payload v13 / runtime v1.4 | Previous Slider-capable compatibility line |
| Frozen TreeView | Native GUI IR 1.2 / payload v12 / runtime v1.3 | Frozen TreeView line; Slider remains fail-closed |

Product JavaScript imports `src/native-current-contract.js` and `src/native-frozen-contract.js`. Ready/offline Windows, macOS and Linux paths are token-free. See [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md).

Picture resources use deterministic project-v4 resource metadata. Current native Picture decoding is bounded to the explicitly supported formats; WebP/SVG are not silently treated as native-supported. Shape, PaintBox and ImageList have separate target capability metadata and remain fail-closed where runtime support has not been implemented.

## Offline compiler

The rolling offline release is `offline-compiler-v0.2`. Windows x64, Linux x64, macOS Apple Silicon and macOS Intel use the current runtime v1.5 Window path and assert sealed payload v14 in the cross-platform smoke matrix. FreeBSD remains Console-only through portable C99.

See [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md) and the public [Downloads](https://minh.systems/Patch/downloads.html) page.

## Formal boundary

beta.32 is invocation-frame-aware direct-Wasm correspondence for the supported finite safe-integer call-tree fragment. Patch does **not** claim full compiler/runtime verification. Native GUI and Studio/RAD work do not widen that claim.

## Quick commands

```bash
npm test
npm run check:site
npm run check:project
npm run build:site
```

```bash
patch check app.patch --json
patch build app.patch --target web
patch link app.patch --out App
patch doctor --json
patch components --json
```

`patch doctor` reports environment probes and self-checks the interpreter, direct Wasm and C99 numeric subset, including that Things fail closed on those backends. On Unix hosts with a C compiler it also compiles and runs the numeric C99 program.

`patch components` prints the canonical Designer registry/target matrix so product docs and coding agents do not scrape a second catalog.

## Documentation

| Doc | What |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Current language surface |
| [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) | IDE, project and build contracts |
| [`docs/STUDIO_PROJECTS.md`](docs/STUDIO_PROJECTS.md) | Project bundle v4 and resources |
| [`AGENTS.md`](AGENTS.md) / [`docs/GPT.md`](docs/GPT.md) | ChatGPT/Grok handoff: current contracts, RAD R1 status and next slice |
| [`docs/COMPONENT_CAPABILITY_MATRIX.md`](docs/COMPONENT_CAPABILITY_MATRIX.md) | Generated registry target matrix |
| [`docs/RAD_STUDIO_MASTERPLAN.md`](docs/RAD_STUDIO_MASTERPLAN.md) | RAD architecture plan |
| [`docs/RAD_STUDIO_MASTER_BACKLOG.md`](docs/RAD_STUDIO_MASTER_BACKLOG.md) | Long-term RAD backlog |
| [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) | Designer inventory |
| [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md) | Native contracts |
| [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md) | Current + frozen lines |
| [`docs/BETA36.md`](docs/BETA36.md) | beta.36 integration milestone |
| [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md) | Assurance scope |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Current backlog and evidence gates |
| [`paper/README.md`](paper/README.md) | Paper sources |

Patch is an active research/prototype language and IDE. Version labels and capability matrices are explicit so product work does not silently broaden older runtime or formal claims.
