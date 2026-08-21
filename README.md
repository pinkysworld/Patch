# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![Sealed TreeView Runtime](https://github.com/pinkysworld/Patch/actions/workflows/native-sealed-tree-runtime-v13.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-sealed-tree-runtime-v13.yml)

**Current development beta: `0.2.0-beta.35`** · **Change IR: `0.10`** · **Native GUI IR: `1.2`** · **sealed desktop runtime: `v1.3`**

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Documentation](https://minh.systems/Patch/docs.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0
change score:
  add 1
show score
```

That mandatory mutation substrate is reused for Change History, undo/redo, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and generated Lean certificates.

## Current product snapshot

| Area | Current status |
|---|---|
| Language | Working interpreter/compiler frontend; Change IR 0.10 |
| Patch Studio | Browser IDE with **canonical multi-file project bundle v3**, Project Tree, Console/Window Run, source-backed Designer, recovery, diagnostics and ready desktop builds |
| Designer controls | Text, Button, Input, Checkbox, Radio, ComboBox, ListBox, **Slider Stage 1**, Table, TreeView and Tabs |
| Slider | Source-backed numeric range control in Studio and Standalone Window Web; bounded finite numeric transient `value`; native v1.3 intentionally fails closed |
| Table | Source-backed grid, structural Properties editing and transient selected-row value |
| ListBox | Text-backed single-select plus list-backed native/browser multi-select with transient text-list value |
| TreeView | Source-backed hierarchy with transient root-to-node path; current native line includes **hierarchical TreeView** |
| Native desktop GUI | Native GUI IR 1.2 / sealed **payload v12 / runtime v1.3** on Win32, AppKit and GTK3 |
| Runtime integrity | Pages verifies GitHub Release SHA-256 asset digests; Studio re-hashes runtime templates before token-free sealing |
| Formal milestone | beta.32 invocation-frame-aware direct-Wasm correspondence for the supported finite safe-integer call-tree fragment |
| Product backlog | Current repository-controlled beta.35+ Studio/compiler backlog closed; credential/manual/research evidence gates are tracked separately in `docs/ROADMAP.md` |

## Patch Studio

Patch Studio keeps visual application structure in ordinary `.patch` source. Form dimensions, control geometry, Slider ranges, Table rows, TreeView hierarchy, Tabs pages and Menu structure are not stored in a hidden second form document.

The current Designer includes:

- source-backed Forms and controls;
- resizable/collapsible Properties;
- categorized Add Control discovery;
- pointer and keyboard movement/resizing;
- alignment and layout actions;
- source-backed Table/TreeView/Tabs structural editors;
- top-level and nested duplication/reorder workflows;
- structural keyboard accessibility and focus restoration;
- multi-file projects, recovery and local privacy-redacted diagnostics.

The public Studio now surfaces the current contract and quick-start shortcuts directly above the IDE workspace. The Documentation page provides a categorized, locally filterable index without telemetry or an external search service.

See [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) and [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md).

## Slider Stage 1

Slider Stage 1 adds a numeric range control without changing Change IR 0.10:

```patch
create number volume = 50

window "Mixer" as main size 560, 300:
  text "Volume: {volume}"
  slider 0..100 as volume step 5 at 24, 80 size 300, 44

when volume changed:
  change volume:
    set = value
```

The event-local `value` is a finite number inside the declared range. The control does not persist that number by itself. Persistence happens only because source executes the ordinary semantic `change`.

Slider Stage 1 works in Patch Studio App Preview, source-backed Designer authoring, Tabs insertion and Standalone Window Web. The frozen Native GUI IR 1.2 / payload v12 / runtime v1.3 line intentionally remains Slider-free and fails closed rather than silently dropping the control or falling back to Electron.

See [`docs/SLIDER_STAGE1.md`](docs/SLIDER_STAGE1.md).

## ListBox, Table and TreeView event semantics

GUI input remains transient until source commits it:

- Input, ComboBox, Radio and text-backed ListBox: transient text `value`;
- Checkbox: transient Boolean `value`;
- Slider: bounded finite numeric `value`;
- list-backed ListBox: transient text-list of selected display strings;
- Table: transient text-list for the selected row;
- TreeView: transient text-list for the selected root-to-node display path.

Renderer or native-toolkit selection itself never becomes hidden Patch state.

## Native desktop contract

The desktop path is explicitly versioned rather than redefining older formats in place:

- Native GUI IR 0.7: frozen base-control compatibility surface;
- Native GUI IR 0.8 / payload v9 / runtime v1.0: Table compatibility line;
- payload v10 / runtime v1.1: persistent list-state compatibility line;
- payload v11 / runtime v1.2: Menu + list compatibility line;
- **Native GUI IR 1.2 / payload v12 / runtime v1.3:** current TreeView-capable Ready/offline line.

Windows, macOS and Linux default to **Ready app download (no token)**. Browser-consumed runtime assets are SHA-256 verified before packaging. The offline compiler independently links and smoke-runs current Window artifacts on the supported hosts. FreeBSD remains Console-only through portable C99.

Unsupported new native behavior fails closed. There is no implicit Electron fallback; the explicitly labelled compatibility package is separate.

## Project format and local-first behavior

Patch Studio uses project bundle **version 3** with bounded multi-file sources, deterministic composition/provenance, project name, Console/Window kind, selected build target and native build mode. Older project versions migrate explicitly and unknown future versions fail closed.

Recovery snapshots preserve the complete project. Diagnostics are privacy-redacted and local. No diagnostics upload path exists in Studio.

## Compiler and formal assurance

Patch keeps Change IR at **0.10** while the assurance layer has advanced through exact call binding, structured/guard-aware traces, finite transitive call trees and beta.32 invocation frames.

Beta.32 independently reconstructs concrete call frames from validated execution transitions and distinguishes repeated identical calls. The standard evidence set includes:

```text
formal/GeneratedTransitiveRuntimeCertificate.lean
formal/GeneratedRepeatedTransitiveRuntimeCertificate.lean
formal/GeneratedMixedGuardTransitiveRuntimeCertificate.lean
```

`GeneratedRepeatedTransitiveRuntimeCertificate.lean` is checked in standard Formal CI together with the other generated evidence.

The assurance claim remains intentionally scoped. Runtime trace capture, correctness/completeness of the independent JavaScript validator/frame reconstruction, remaining parser/extractor correctness, JavaScript-to-Wasm lowering and the Wasm engine remain explicit proof-free/trust boundaries. Patch does **not** claim full compiler/runtime verification.

See [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md), [`docs/RUNTIME_CORRESPONDENCE.md`](docs/RUNTIME_CORRESPONDENCE.md) and [`docs/REPRODUCIBILITY_BUNDLE.md`](docs/REPRODUCIBILITY_BUNDLE.md).

## Research and evaluation boundary

The repository already contains:

- semantic-authority security ablations;
- internally authored checkout/loyalty and usage/quota extension cases;
- process-isolated assurance-overhead measurement tooling;
- a fixed-machine controlled-measurement procedure;
- commit-bound reproducibility bundles;
- structured related-work comparisons.

It does **not** invent missing evidence. Controlled paper-quality measurements, statistical analysis over that future dataset and a genuine external/third-party integration study remain open research gates. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Core candidate contribution

Patch does not claim novelty for effects, capabilities, procedure semantics, call graphs, invocation frames, runtime validation, proof-carrying evidence, WebAssembly or GUI packaging.

The primary candidate contribution remains:

> **ordinary persistent mutation is factored through a mandatory semantic Change representation, and operation-/magnitude-aware semantic authority is derived from that same mutation substrate.**

Expressibility is not the novelty claim. Rich refinement/effect systems can express stronger relations. Patch's candidate distinction is the mandatory/default mutation architecture and the reuse of the same semantic mutation substrate for authority, history and assurance.

## Quick commands

```bash
npm test
npm run check:site
npm run check:project-surface
npm run build:site
```

Offline compiler examples:

```bash
patch check app.patch --json
patch build app.patch --target web
patch link app.patch --out App
patch doctor --json
```

## Documentation map

- [`docs/SPEC.md`](docs/SPEC.md) – language specification
- [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) – browser IDE and build paths
- [`docs/STUDIO_AUTHORING_SURFACE.md`](docs/STUDIO_AUTHORING_SURFACE.md) – current visual authoring inventory
- [`docs/SLIDER_STAGE1.md`](docs/SLIDER_STAGE1.md) – Slider syntax/event/native boundary
- [`docs/NATIVE_GUI.md`](docs/NATIVE_GUI.md) – current native contract
- [`docs/OFFLINE_COMPILER.md`](docs/OFFLINE_COMPILER.md) – downloadable compiler/linker
- [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) – release and operational boundaries
- [`docs/FORMAL_MODEL.md`](docs/FORMAL_MODEL.md) – mechanized assurance scope
- [`docs/EVALUATION.md`](docs/EVALUATION.md) – measurement harness
- [`docs/ROADMAP.md`](docs/ROADMAP.md) – closed core backlog plus external/research gates

## License and status

Patch is an active research/prototype language and IDE. Version labels and compatibility lines are explicit so product progress does not silently broaden older runtime or formal claims.