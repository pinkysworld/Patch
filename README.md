# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![Sealed Table Runtime](https://github.com/pinkysworld/Patch/actions/workflows/native-sealed-table-runtime.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-sealed-table-runtime.yml)

**Current development beta: `0.2.0-beta.33`** · **Change IR: `0.10`** · **Native GUI IR: `0.7` stable / `0.8` Table extension**

[Open Patch Studio](https://minh.systems/Patch/) · [Language](https://minh.systems/Patch/language.html) · [Documentation](https://minh.systems/Patch/docs.html) · [Downloads](https://minh.systems/Patch/downloads.html) · [Help](https://minh.systems/Patch/help.html) · [Spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

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
| Patch Studio | Browser IDE, source editor, Console/Window Run, source-backed Designer, recovery, diagnostics and ready desktop builds |
| Window UI | Forms, Text/Button/Input/Checkbox/ComboBox/ListBox/Radio/Tabs/Table, menus and result-bearing dialogs |
| Native Table | Native GUI IR 0.8 / direct backend 0.9 with Win32 `WC_LISTVIEWW`, AppKit `NSTableView` and GTK3 `GtkTreeView` |
| Ready Window ABI | Sealed payload v9 / runtime v1.0 on Windows, macOS and Linux; v8/runtime v0.9 remains a frozen compatibility line |
| Desktop | Ready Windows/macOS/Linux Console and Window downloads; FreeBSD Console via C99 |

## Patch Studio and the native Table line

Patch Studio keeps visual UI structure source-backed in `.patch` code. Form dimensions, control geometry, Table columns/rows, Tabs pages and Menu structure are not stored in a second hidden form format.

Table selection follows the same semantic rule as the rest of Patch GUI input: a Table `changed` event exposes the selected row as a transient list-valued `value`. Toolkit or browser selection itself does not mutate persistent Patch state. Persistent state still changes only through an explicit `change`.

The current native Table path is deliberately versioned instead of silently redefining older formats:

- **Native GUI IR 0.7** remains the stable base control surface;
- **Native GUI IR 0.8** is the explicit Table extension;
- direct Win32/AppKit/GTK Table backends are **backend 0.9**;
- token-free Ready Window and supported offline-linked Window apps use sealed payload **v9** with native runtime **v1.0**;
- payload **v8** / runtime **v0.9** remains the frozen responsive Native GUI IR 0.7 compatibility line.

The dedicated sealed-runtime workflow independently gates the shared payload contract and then compiles, seals, links and smoke-runs the Table example on Windows, macOS and Linux. The ordinary offline compiler matrix separately exercises local `patch link` output.

## Beta.33: Studio and production-readiness layer

Beta.33 advances the product layer without widening the beta.32 formal runtime-correspondence claim. Patch Studio has a version-2 project bundle that preserves the selected build target and native build mode alongside name, project kind and source. Version-1 projects migrate explicitly to v2 with documented defaults.

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
- production parser/extractor correctness;
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

Patch Studio provides source editing, Console/Window Run, Change Contract/IR views, source-backed Designer editing, project export/import/recovery and ready desktop builds. The Studio, Language, Documentation, Downloads and Help surfaces are separate web pages sharing one navigation bar.

Windows, macOS and Linux default to **Ready app download (no token)**. FreeBSD Console uses the portable C99 backend. The optional cloud/AOT route is explicitly separate and does not persist its GitHub token.

GUI input remains semantic: Input/ComboBox/ListBox/Radio expose transient text `value`, Checkbox exposes transient Boolean `value`, and Table exposes the selected row as transient list-valued `value`. Persistent state changes only through explicit Patch `change`.

## Change IR 0.10

Beta.33 and the Native GUI IR 0.8 Table extension do not change the production Change IR schema. Invocation frames and runtime certificates remain separate assurance artifacts reconstructed from the existing Change IR execution model.

## Research boundary

Patch does not claim novelty for effects, capabilities, procedure semantics, invocation frames, call graphs, transitive traces, runtime validation, proof-carrying evidence, WebAssembly or GUI packaging.

The primary candidate contribution remains:

> **ordinary persistent mutation is factored through a mandatory semantic Change representation, and operation-/magnitude-aware semantic authority is derived from that same mutation substrate.**
