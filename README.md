# Patch

**A change-oriented programming language and source-backed RAD IDE for building explainable applications across Web, Windows, macOS and Linux.**

Patch makes persistent mutation explicit. After creation, application state changes through semantic `change` blocks instead of being modified invisibly by ordinary assignment.

```patch
create number score = 0

change score called bonus:
  add 10

show score
why score
```

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Patch Studio](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)

**Development beta `0.2.0-beta.36+`** · **Change IR `0.10`** · **Native GUI IR `1.4`** · **payload `v14`** · **desktop runtime `v1.5`**

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Documentation](https://minh.systems/Patch/docs.html) · [Paper](https://minh.systems/Patch/paper.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html)

## Why Patch

Patch combines a small language with a visual development environment while keeping the source code authoritative.

- **Explicit semantic mutation**: persistent post-creation state changes are represented by `change`.
- **Change IR**: compiler-visible change operations, signatures, provenance and capability analysis.
- **Magnitude-aware capabilities**: policies can constrain operations such as `score may increase up to 10`.
- **Source-backed RAD**: Forms, controls, geometry, events and responsive layout stay in ordinary `.patch` files. There is no hidden `.frm` or `.dfm` project state.
- **Visual Studio-style workflow, simple language**: edit, design, Run and Build from Patch Studio.
- **Token-free desktop builds**: current Ready builds seal verified native runtime templates locally in Studio. No GitHub token or local C++ toolchain is required for the normal Windows, macOS or Linux path.
- **Versioned native contracts**: newer GUI work does not silently reinterpret older payload or runtime formats.
- **Research evidence**: formal models, differential tests, reproducibility bundles and explicit claim boundaries live in the repository beside the implementation.

## Patch Studio

Patch Studio is a browser-first visual IDE and PWA. The Designer rewrites visible Patch source rather than maintaining a second hidden UI model.

Current source-backed component families include:

| Category | Components |
|---|---|
| Basic | Text, Button, Input, Checkbox |
| Choices | Radio, ComboBox, ListBox, Slider |
| Data | Table, TreeView |
| Containers | Tabs, Panel Stage 1 |
| Graphics | Picture |
| Chrome | StatusBar |
| Nonvisual | Timer Stage 1 |

RAD authoring includes multi-selection, 8 px grid snapping, edge and center alignment, same-size operations, equal spacing, z-order actions, anchors and docking, Focus Order Stage 1, Object Inspector Properties/Events, source-backed handler creation, a searchable Component Palette, project outline, command palette and multi-file project bundles.

Panel Stage 1 intentionally uses source-order flow layout for children. Timer is represented in the nonvisual tray. StatusBar owns its bottom-docked contract. These are explicit staged contracts rather than claims of complete Delphi/VB component parity.

See [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md), [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) and [`docs/BETA36.md`](docs/BETA36.md).

## Harbor Desk showcase

[`examples/harbor-desk.patch`](examples/harbor-desk.patch) is the current large Window example. It is a small repair-counter application rather than a synthetic control gallery.

It exercises:

- two source-backed Forms and Tabs;
- Things and ordinary scalar/list state;
- bounded recipe parameters and a magnitude-aware change capability;
- ComboBox, Radio, Checkbox, Slider, Input and ListBox events;
- Table and TreeView transient selections;
- an embedded PNG Picture;
- a bottom-docked, state-bound StatusBar;
- explicit application-state updates through `change`.

The example has regression gates for parsing/interpreter execution, Standalone Window Web generation and the current Native GUI 1.4 lowering path.

## Picture and project resources

Patch Studio has a source-backed Resource Manager with logical project resource IDs, deterministic hashes and bounded image-resource sizes.

Web/Studio project resources may use PNG, JPEG, WebP or SVG. The portable current native Picture contract is deliberately narrower and deterministic:

- **Windows**: Windows Imaging Component;
- **macOS**: `NSImage`;
- **Linux**: `GdkPixbuf`;
- **guaranteed embedded native formats**: PNG and JPEG;
- logical WebP/SVG Picture resources fail before native sealing instead of inheriting platform-specific decoder behavior;
- embedded image decoding follows the same 2 MiB per-resource bound used by the Studio resource model.

Picture `clicked` events remain available on the current desktop runtime while ordinary source-less Picture controls retain the compatibility placeholder/caption path.

## GUI event model

Toolkit interaction is transient until Patch source commits persistent application state through `change`.

| Control | Event-local value |
|---|---|
| Input, ComboBox, Radio | text |
| Checkbox | Boolean |
| Slider | bounded finite number |
| text-backed ListBox | text |
| list-backed ListBox | text-list |
| Table | selected row as text-list |
| TreeView | selected root-to-node path as text-list |
| Picture | `clicked`, no value |
| Timer | `ticked`, no value |

This separation lets controls deliver ordinary UI interaction without creating an implicit mutation path around Change IR.

## Native desktop contract

The product-facing current contract is **Native GUI IR 1.4 / sealed payload v14 / runtime v1.5**. Older lines remain frozen compatibility evidence.

| Line | IR / payload / runtime | Role |
|---|---|---|
| Current Ready/offline | Native GUI IR 1.4 / payload v14 / runtime v1.5 | Table, menus, TreeView, multi-select ListBox, Slider, Panel, Timer, Picture and StatusBar, including embedded PNG/JPEG Picture decoding |
| Slider compatibility | Native GUI IR 1.3 / payload v13 / runtime v1.4 | Frozen Slider-capable line using Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale` |
| TreeView compatibility | Native GUI IR 1.2 / payload v12 / runtime v1.3 | Frozen TreeView line; later Slider/Chrome features fail closed |

Current product code imports [`src/native-current-contract.js`](src/native-current-contract.js). Frozen compatibility consumers use [`src/native-frozen-contract.js`](src/native-frozen-contract.js).

Ready/offline Windows, macOS and Linux builds are token-free. Patch Studio downloads SHA-256 verified runtime templates and seals the current payload locally. FreeBSD remains Console-only through portable C99.

See [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md), [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md) and [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md).

## Offline compiler

The rolling offline line is `offline-compiler-v0.2`.

Supported kits:

- Windows x64;
- Linux x64;
- macOS Apple Silicon;
- macOS Intel;
- FreeBSD Console through the portable C99 subset.

Window kits use the current runtime v1.5 and sealed payload v14 path. The repository keeps older versioned runtime contracts for regression and compatibility evidence rather than silently replacing them.

## Language and Change IR

Patch values include numbers, text, booleans, lists and prototype-free Things. Thing fields are application data. `__proto__`, `prototype` and `constructor` are rejected, runtime records stay prototype-free, and equality compares own fields.

Direct Wasm and portable C99 intentionally remain smaller Console subsets. Unsupported features fail closed rather than being approximated silently.

Example capability:

```patch
create thing player:
  score = 0

allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..10):
  change player:
    add bonus to score

do reward(player, 7)
```

The compiler emits Change IR, change signatures, capability metadata and formal-extraction evidence for the supported analysis boundary.

## Formal boundary

The repository does **not** claim full compiler/runtime verification.

The beta.32 formal claim is invocation-frame-aware direct-Wasm correspondence for the supported finite safe-integer call-tree fragment. Native GUI, Patch Studio and later RAD work do not silently widen that theorem boundary.

See [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md), [`docs/RUNTIME_CORRESPONDENCE.md`](docs/RUNTIME_CORRESPONDENCE.md), [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) and [`docs/RESEARCH_PLAN.md`](docs/RESEARCH_PLAN.md).

## Quick start

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
```

`patch doctor` reports environment probes and self-checks the interpreter, direct Wasm and C99 numeric subset. On Unix hosts with a C compiler it also compiles and runs the numeric C99 program.

## Repository map

| Path | Purpose |
|---|---|
| [`src/`](src/) | parser, compiler, interpreter, Change IR, Web/native build contracts |
| [`web/`](web/) | Patch Studio and public website |
| [`native-runtime/`](native-runtime/) | versioned Win32, AppKit and GTK sealed runtimes |
| [`examples/`](examples/) | language, formal, GUI and cross-target examples |
| [`tests/`](tests/) | unit, regression, parity and product-contract gates |
| [`formal/`](formal/) | formalization and proof artifacts |
| [`paper/`](paper/) | research paper sources |
| [`docs/`](docs/) | language, runtime, Studio, security and research documentation |

## Key documentation

| Document | Scope |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | language contract |
| [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) | IDE and build workflow |
| [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) | Designer/component inventory |
| [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md) | native GUI architecture |
| [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md) | current and frozen native lines |
| [`docs/BETA36.md`](docs/BETA36.md) | beta.36 RAD integration milestone |
| [`docs/GROK_REVIEW_2026-08-25.md`](docs/GROK_REVIEW_2026-08-25.md) | implementation audit and remaining gaps |
| [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md) | formal assurance scope |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | backlog and evidence gates |
| [`paper/README.md`](paper/README.md) | paper sources |

## Project status

Patch is an active research and product prototype. Public version labels, native payload versions and formal claims are intentionally explicit. New RAD components are added in staged, testable slices so the IDE, source format, Web target and native runtimes do not drift into separate product models.
