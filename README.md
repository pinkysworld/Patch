# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![Sealed TreeView Runtime](https://github.com/pinkysworld/Patch/actions/workflows/native-sealed-tree-runtime-v13.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-sealed-tree-runtime-v13.yml)

**Current development beta: `0.2.0-beta.35`** · **Change IR: `0.10`** · **Native GUI IR: `1.2`** · **sealed desktop runtime: `v1.3`**

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Documentation](https://minh.systems/Patch/docs.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html) · [Spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Roadmap](docs/ROADMAP.md) · [Beta.35 notes](docs/BETA35.md) · [Paper](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0
change score:
  add 1
show score
```

This mandatory mutation substrate supports history, undo/redo, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and generated Lean certificates.

## Current status

| Area | Status |
|---|---|
| Language | Working interpreter/compiler frontend; Change IR 0.10 |
| Formal core | State-Change Factorization, signature soundness, policy containment, integer range soundness |
| Calls | Exact safe-integer binding, guarded structured traces, finite transitive exact call trees |
| Runtime assurance | Invocation-frame-aware direct-Wasm correspondence, including repeated identical calls |
| Patch Studio | Browser IDE, canonical multi-file project bundle v3, Project Tree, Console/Window Run, source-backed Designer, recovery, diagnostics and ready desktop builds |
| Window UI | Forms, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio/Tabs/Table/TreeView, menus and result-bearing dialogs |
| Browser ListBox | Text-backed ListBox remains single-select; list-backed ListBox is multi-select with transient text-list `value` in Studio Preview and Standalone Web |
| Native desktop GUI | Native GUI IR 1.2 / sealed runtime v1.3 with Win32, AppKit and GTK3 Table, persistent list-backed ListBox, Menu state/shortcuts and hierarchical TreeView |
| TreeView semantics | A TreeView `changed` event exposes the selected root-to-node display path as transient text-list `value`; persistence still requires explicit `change` |
| Ready Window ABI | Sealed payload v12 / runtime v1.3 on Windows, macOS and Linux; v11/runtime v1.2 and earlier contracts remain explicit compatibility lines |
| Ready runtime integrity | Pages verifies release SHA-256 digests and Patch Studio re-hashes every browser-consumed runtime template before packaging |
| Desktop | Ready Windows/macOS/Linux Console and Window downloads; FreeBSD Console via C99 |

## Beta.35: list-backed ListBox multi-select

Beta.35 introduced a browser-first multi-select contract without adding new Patch syntax or changing Change IR 0.10. A ListBox whose `as` id is backed by `create list` is rendered as a multi-select control in Patch Studio App Preview and Standalone Window Web. Its `changed` handler receives a copied list of selected display strings as transient event-local `value`.

```patch
create list fruits = ["Banana", "Mango"]

window "Fruit Picker":
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits

when fruits changed:
  change fruits:
    set = value
```

Selection itself remains UI state. Persistent `fruits` changes only because the handler executes an explicit semantic `change`. A ListBox backed by `create text` remains the existing single-select control and continues to expose a text `value`.

The original beta.35 browser-only boundary has since been closed for supported desktop targets. Native GUI IR 1.1 added persistent list state and native multi-select ListBox semantics, runtime v1.2 carried the Menu/list contract, and the current Native GUI IR 1.2 / payload v12 / runtime v1.3 line preserves those semantics while adding TreeView. Legacy payload/runtime contracts stay frozen and fail closed when a program requires a newer feature.

See [`docs/BETA35.md`](docs/BETA35.md) and [`docs/NATIVE_LIST_STATE.md`](docs/NATIVE_LIST_STATE.md).

## Patch Studio and the current native GUI line

Patch Studio keeps visual UI structure source-backed in `.patch` code. Form dimensions, control geometry, Table columns/rows, TreeView hierarchy, Tabs pages and Menu structure are not stored in a second hidden form format.

Table and TreeView selection follow the same semantic rule as the rest of Patch GUI input. A Table `changed` event exposes the selected row as a transient list-valued `value`. A TreeView `changed` event exposes the selected root-to-node display path as a transient text-list `value`. Toolkit or browser selection itself does not mutate persistent Patch state. Persistent state still changes only through an explicit `change`.

The native desktop path is deliberately versioned instead of silently redefining older formats:

- **Native GUI IR 0.7** remains the frozen base-control compatibility surface;
- **Native GUI IR 0.8** introduced the Table extension;
- **Native GUI IR 1.1 / payload v11 / runtime v1.2** added persistent list state, native multi-select ListBox and source-backed Menu state/shortcuts;
- **Native GUI IR 1.2 / payload v12 / runtime v1.3** is the current Ready/offline contract and adds hierarchical TreeView;
- direct Win32/AppKit/GTK backends expose the same current TreeView-capable semantics;
- older payload/runtime versions remain frozen compatibility lines and do not silently accept newer source constructs.

The dedicated sealed-runtime workflow independently gates the shared payload contract and then compiles, seals, links and smoke-runs the TreeView example on Windows, macOS and Linux. The ordinary offline compiler matrix separately exercises local `patch link` output.

## Beta.34: Studio correctness and runtime integrity

Beta.34 hardened the product layer after the payload-v9/runtime-v1.0 switch. It did not widen the beta.32 formal assurance claim and did not change Change IR 0.10.

A code review found that some programmatic Patch Studio edits, especially sample switching and older Designer add/edit/delete paths, could change visible source while only updating the legacy unversioned browser key. Beta.34 normalized programmatic source and Project Type mutations into the same DOM event path used by manual editing. The canonical project lifecycle, recovery snapshots, Designer refresh, Change Contract refresh and native-build panel therefore observe one consistent project state. The project format has since advanced to multi-file bundle v3 with an explicit Project Tree.

The browser no-token packaging path adds a fail-closed runtime-integrity step for every runtime template it consumes. Pages downloads the exact Console, compatibility Window and native GUI assets used by Patch Studio, reads the SHA-256 digest recorded by GitHub for each asset and independently re-hashes those bytes before publishing a verified runtime manifest. Patch Studio then hashes the selected runtime again with Web Crypto before packaging. A missing manifest entry or mismatch stops the build instead of silently producing an application from unexpected runtime bytes. The current native GUI release gate is runtime v1.3.

The service worker also treats same-origin `/runtimes/` requests as fresh-first. Online builds therefore ask the current deployment for the runtime and integrity manifest, while successfully fetched bytes remain available as an offline fallback.

See [`docs/BETA34.md`](docs/BETA34.md) for the exact historical scope and trust boundary.

## Beta.33: Studio and production-readiness layer

Beta.33 advanced the product layer without widening the beta.32 formal runtime-correspondence claim. Patch Studio introduced a version-2 project bundle that preserved the selected build target and native build mode alongside name, project kind and source. The current project bundle is v3 and adds bounded multi-file Patch sources, deterministic composition/provenance and the source-backed Project Tree.

The source-backed Designer can resize both controls and the Form window itself. A Form may grow beyond the visible Designer viewport and remains reachable through horizontal/vertical scrolling rather than being clamped back to the current pane width.

The public site is split into focused **Studio**, **Language**, **Documentation**, **Downloads** and **Help** pages. Studio remains an IDE instead of doubling as a long project landing page.

Recent production work also includes stable `PATCHxxxx` diagnostics, versioned CLI JSON results, recovery snapshots, local privacy-redacted `.patchreport` diagnostics, build cancel/timeout/retry, tagged-release integrity manifests, CodeQL/security gates, deterministic grammar fuzzing, Interpreter/direct-Wasm/C99 differential testing, Change/Undo property tests and logical artifact reproducibility checks.

## Beta.32: independently reconstructed invocation frames

Beta.31 connected beta.30 finite exact call trees to an actually executed direct-Wasm trace, but deliberately rejected repeated indistinguishable call traces because scoped-slice attribution was ambiguous.

Beta.32 removes that restriction without adding trusted call-enter/call-exit markers to the backend. The independent Change-IR validator reconstructs every concrete `DO` invocation frame with:

```text
frameId
parentFrameId
callerScope
callee
dynamic invocation ordinal
depth
exact argument values
exact parameter BindingList
transitionStart / transitionEndExclusive
```

Every independently validated transition/effect also carries its active frame stack. Runtime correspondence therefore selects effects by **concrete frame identity**, rather than requiring a globally unique effect sequence.

The assurance pipeline is:

```text
Patch source
  -> existing direct-Wasm compiler
  -> execute real Wasm module
  -> raw target/before/after transitions
  -> independent Change-IR execution + complete trace validation
  -> independently reconstructed concrete invocation frames
  -> frame-selected observed semantic effects
  -> Lean: runtime frame BindingList = beta.30 exact BindingList
  -> Lean: evalCallTreeStmtEqBool exactCallTree observedEffects = true
  -> observed trace refines caller semantic signature
```

`examples/formal-transitive-calls-repeated.patch` executes two identical `do caller(1)` calls. Beta.32 reconstructs different concrete frames for both and generates separate certifiable observations rather than rejecting them as ambiguous.

### Lean bridge

`formal/PatchCallRuntime.lean` retains:

```text
checkedObservedTransitiveRuntimeRefinesCallerSignature
```

The beta.32 generated certificate adds a mechanically checked equality between each independently reconstructed runtime-frame `BindingList` and the corresponding beta.30 exact callee binding before re-evaluating the frame-selected observed effect list against `CallTreeStmt`.

Reproducible certificates:

```bash
npm run transitive-runtime-certify:example
npm run transitive-runtime-certify:repeated
```

Generated files:

```text
GeneratedTransitiveRuntimeCertificate.lean
GeneratedRepeatedTransitiveRuntimeCertificate.lean
```

Standard Formal CI verifies both with pinned Lean. Standard Windows/macOS/Linux CI executes the direct-Wasm programs and regenerates the evidence.

### Exact beta.32 boundary

Covered:

- actual execution of the existing direct-Wasm backend;
- complete raw transition validation against the independent Change-IR executor;
- independently reconstructed semantic operation identity, recipe scope and concrete invocation frames;
- exact safe-integer frame parameter bindings;
- repeated identical finite calls distinguished by dynamic frame identity;
- frame-selected observed effects re-evaluated against beta.30 exact call trees in Lean;
- caller-signature refinement for the accepted observed lists.

Still explicit proof-free/trust boundaries:

- runtime trace capture;
- correctness/completeness of the independent JavaScript validator and invocation-frame reconstruction;
- production parser/extractor correctness outside independently cross-checked supported fragments;
- JavaScript-to-Wasm lowering correctness;
- Wasm engine correctness.

Beta.32 **does not claim full compiler/runtime simulation or full compiler verification**.

## Earlier assurance milestones

- **Beta.31:** first conservative call-aware direct-Wasm correspondence, requiring one globally unambiguous scoped trace.
- **Beta.30:** finite transitive exact call-tree semantics with nested binding, rank decrease and edge-by-edge signature import.
- **Beta.29:** exact `GuardExpr` branch selection under exact recipe-parameter bindings.
- **Beta.28:** exact direct quantitative sequence/static-repeat callee traces.
- **Beta.25-27:** finite abstract call composition, exact positional binding and integer `RangeExpr` coverage.
- **Beta.23:** conservative guard-aware direct-runtime/capability correspondence.

## Studio and builds

Patch Studio provides source editing, Console/Window Run, Change Contract/IR views, source-backed Designer editing, multi-file project export/import/recovery, a source-backed Project Tree and ready desktop builds. The Studio, Language, Documentation, Downloads and Help surfaces are separate web pages sharing one navigation bar.

Windows, macOS and Linux default to **Ready app download (no token)**. Current Window builds use Native GUI IR 1.2, sealed payload v12 and runtime v1.3, including hierarchical TreeView. Every browser-consumed runtime template used by that path is SHA-256 verified before packaging. FreeBSD Console uses the portable C99 backend. The optional cloud/AOT route is explicitly separate and does not persist its GitHub token.

GUI input remains semantic: Input/ComboBox/Radio and text-backed ListBox expose transient text `value`; Checkbox exposes transient Boolean `value`; list-backed ListBox exposes transient text-list `value`; Table exposes the selected row as transient list-valued `value`; TreeView exposes the selected root-to-node display path as transient text-list `value`. Persistent state changes only through explicit Patch `change`.

## Change IR 0.10

The current Native GUI IR 1.2 TreeView extension, like the earlier Table/List/Menu work, does not change the production Change IR schema. Invocation frames and runtime certificates remain separate assurance artifacts reconstructed from the existing Change IR execution model.

## Research boundary

Patch does not claim novelty for effects, capabilities, procedure semantics, invocation frames, call graphs, transitive traces, runtime validation, proof-carrying evidence, WebAssembly or GUI packaging.

The primary candidate contribution remains:

> **ordinary persistent mutation is factored through a mandatory semantic Change representation, and operation-/magnitude-aware semantic authority is derived from that same mutation substrate.**
