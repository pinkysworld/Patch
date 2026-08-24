# Patch

> **A small change-oriented programming language with a browser-first IDE, explicit semantic mutation and versioned desktop runtimes.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Patch Studio](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/pages.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)

**Development beta `0.2.0-beta.35`** · **Change IR `0.10`** · **Native GUI IR `1.3`** · **payload `v13`** · **desktop runtime `v1.4`**

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Documentation](https://minh.systems/Patch/docs.html) · [Paper](https://minh.systems/Patch/paper.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html) · [Roadmap](docs/ROADMAP.md) · [Paper sources](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0
change score:
  add 1
show score
```

The same mandatory mutation substrate is reused for Change History, undo/redo, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and generated Lean certificates.

Values are numbers, text, booleans, lists and Things. Thing fields are application data: `__proto__`, `prototype` and `constructor` are rejected fail-closed, runtime records stay prototype-free, and equality compares own fields independent of insertion order. Direct Wasm and portable C99 remain the numeric Console subset and fail closed on Things; that stays outside the beta.32 formal claim.

## Current product

| Area | Current status |
|---|---|
| Language | Working interpreter/compiler frontend with Change IR 0.10; numbers, text, booleans, lists and prototype-free Things |
| Patch Studio | Browser IDE, multi-file project bundle v3, Project Outline, source-backed Designer, recovery, diagnostics and **Ctrl/Cmd+K Command Palette** with file/symbol quick-open |
| Designer | Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, Slider, Table, TreeView and Tabs with source-backed layout/structure editing |
| Native desktop | Two live contracts: current Native GUI IR 1.3 / payload v13 / runtime v1.4, frozen TreeView IR 1.2 / payload v12 / runtime v1.3 |
| Ready builds | Token-free Windows, macOS and Linux paths with SHA-256 verified runtime templates |
| Web delivery | One service-worker owner, type-safe offline fallback and a real Chrome responsiveness gate on every public deployment |
| Formal milestone | beta.32 invocation-frame-aware direct-Wasm correspondence for the supported finite safe-integer call-tree fragment |
| Paper | Working manuscript with architecture figure, ablation/application tables and a fail-closed no-performance-claim boundary |
| Backlog | Native two-contract collapse is complete (current IR 1.3 + frozen TreeView IR 1.2). Remaining repository work is spec/docs/CI maintenance; external signing/manual validation and research-evidence gates are tracked separately |

## Patch Studio

Patch Studio keeps visual application structure in ordinary `.patch` source. Form dimensions, control geometry, Slider ranges, Table rows, TreeView hierarchy and Tabs pages are not stored in a second hidden form document.

The Studio includes source-backed Forms and controls, pointer/keyboard movement and resizing, alignment/layout actions, structural Table/TreeView/Tabs editors, multi-file project state, recovery and privacy-redacted diagnostics that name owning `file:line`.

Press **Ctrl/Cmd+K** for the Command Palette. It delegates to the existing Run, Build, Editor, Designer, result views, Recovery, Documentation, Paper, Downloads and Help actions and also exposes the current project files and parser-derived Project Tree symbols, including Thing fields as `player.score` and recipe parameters as `reward.bonus`. File results activate the canonical project file; symbol results select the exact source line. Palette state and its quick-open result set are transient IDE state and do not create another project, persistent index or mutation model.

See [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md), [`docs/STUDIO_COMMAND_PALETTE.md`](docs/STUDIO_COMMAND_PALETTE.md) and [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md).

## Browser reliability

Patch Studio's delivery path is fail-closed:

- `studio-bootstrap.js` is the single service-worker registration/refresh owner;
- activation can request at most one recovery reload per site revision;
- code and runtime requests bypass stale HTTP cache while preserving exact offline cache entries;
- missing JavaScript, CSS or runtime assets are never replaced with `index.html`; only document navigation may use the cached Studio shell;
- CI opens Studio in real Headless Chrome, runs a Window app and verifies that the main thread remains responsive after the delayed-freeze window; Windows CI isolates that smoke so a hung `chrome.exe` cannot pin the job, profile cleanup is best-effort so leftover file locks cannot fail the job, and first-paint CDP evaluates retry instead of failing a single stalled round-trip;
- the same browser test runs against the deployed `https://minh.systems/Patch/` site before the public deployment is reported healthy.

This sits on top of deterministic site revisioning, transitive module-closure validation and HTTP asset checks.

## GUI event semantics

Toolkit interaction remains transient until Patch source commits it through `change`:

- Input, ComboBox, Radio and text-backed ListBox expose text `value`;
- Checkbox exposes Boolean `value`;
- Slider exposes a bounded finite numeric `value`;
- list-backed ListBox exposes a transient text-list;
- Table exposes the selected row as a transient text-list;
- TreeView exposes the selected root-to-node path as a transient text-list.

Renderer selection itself never becomes hidden persistent Patch state.

## Native desktop contract

The current Ready/offline line is **Native GUI IR 1.3 / sealed payload v13 / runtime v1.4**. It preserves Table, persistent list state, multi-select ListBox, Menu and TreeView compatibility while adding native Slider through Win32 `TRACKBAR`, AppKit `NSSlider` and GTK3 `GtkScale`. Product JavaScript imports that line through `src/native-current-contract.js`.

The frozen TreeView line is Native GUI IR 1.2 / payload v12 / runtime v1.3 and stays Slider fail-closed. Product JavaScript for that line imports `src/native-frozen-contract.js`. Studio, Ready/offline linking and the public site bundle import only those two live contracts. Unversioned `native-gui-ir.js` / `native-runtime/*-sealed-gui.cpp` files are the labeled historical include-chain base (IR 0.7 / payload v6), not the Ready runtime; historical v0.8 workflows and payload-v7/v8 sealers do not gate Pages. See [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md).

Unsupported behavior on an older selected contract fails closed. FreeBSD remains Console-only through portable C99.

## Compiler and assurance

Patch keeps Change IR at **0.10** while the assurance layer includes exact call binding, structured and guard-aware traces, finite transitive call trees, raw-source call-site validation and beta.32 invocation frames for repeated calls.

The assurance claim remains scoped. Patch does **not** claim full compiler/runtime verification. Native GUI/runtime and later Studio product work do not widen the beta.32 formal claim.

See [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md), [`docs/RUNTIME_CORRESPONDENCE.md`](docs/RUNTIME_CORRESPONDENCE.md) and [`docs/REPRODUCIBILITY_BUNDLE.md`](docs/REPRODUCIBILITY_BUNDLE.md).

## Research boundary

The repository contains reproducible assurance tooling, semantic-authority security cases, controlled-measurement infrastructure and structured related-work comparisons. It does not invent missing evidence: fixed-hardware paper-quality measurements, statistical results over that future dataset and a genuine external integration study remain open research gates.

The primary candidate contribution remains:

> **ordinary persistent mutation is factored through a mandatory semantic Change representation, and operation-/magnitude-aware semantic authority is derived from that same mutation substrate.**

See [`docs/NOVELTY.md`](docs/NOVELTY.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Quick commands

```bash
npm test
npm run check:site
npm run check:project
npm run build:site
```

Offline compiler examples:

```bash
patch check app.patch --json
patch build app.patch --target web
patch link app.patch --out App
patch doctor --json
```

`patch doctor` reports environment probes and self-checks the interpreter, direct Wasm and C99 numeric subset, including that Things fail closed on those backends. On Unix hosts with a C compiler it also compiles and runs the numeric C99 program.

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md) · language specification
- [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) · browser IDE and build paths
- [`docs/STUDIO_COMMAND_PALETTE.md`](docs/STUDIO_COMMAND_PALETTE.md) · keyboard-first Studio commands and project quick-open
- [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) · visual authoring inventory
- [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md) · native contracts and frozen compatibility lines
- [`docs/NATIVE_COMPATIBILITY.md`](docs/NATIVE_COMPATIBILITY.md) · two live native product contracts, labeled historical include-chain bases, and the completed collapse rule
- [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md) · downloadable compiler/linker
- [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) · operational boundaries
- [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md) · mechanized assurance scope
- [`docs/ROADMAP.md`](docs/ROADMAP.md) · active backlog and evidence gates

## Status

Patch is an active research/prototype language and IDE. Version labels and compatibility lines are explicit so product progress does not silently broaden older runtime or formal claims.
