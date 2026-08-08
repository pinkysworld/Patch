# Patch

> **A tiny change-oriented programming language with one IDE for everywhere.**

Patch is an experimental general-purpose language built around one deliberately simple idea:

**persistent state does not mutate invisibly. Every ordinary post-creation mutation is an explicit semantic change.**

```patch
create number score = 0

change score:
  add 1

show score
```

The beginner-facing language stays small while the compiler/runtime derives history, undo/redo, preview, semantic Change Signatures, optional Change Capabilities, range evidence, provenance and formal evidence from the same structured change model.

## Patch Studio

Public Patch Studio / project website:

**https://pinkysworld.github.io/Patch/**

Patch Studio is browser-first and installable as a PWA, with desktop and iPhone/iPad layouts.

## Current status

Current development beta: **0.2.0-beta.17**

Implemented now:

- working interpreter and compiler front end;
- normalized Change IR 0.7;
- semantic **Change Signatures** and magnitude-aware **Change Capabilities**;
- ranged numeric parameters, interval analysis and runtime guards;
- provenance and `why` queries;
- Lean 4 factorization, signature, policy and integer range results for explicit formal fragments;
- `patch formal` and `patch certify`;
- portable `.patchapp` bundles;
- bootstrap Wasm compatibility carrier;
- **direct executable numeric Patch-to-WebAssembly lowering**;
- direct Wasm control flow, literal loops and non-recursive numeric recipes;
- independent direct-Wasm transition and semantic-effect validation;
- **standalone single-file Web App builds**;
- **native macOS `.app`, Windows `.exe` and Linux executable builds for the direct numeric console subset**;
- **Patch Studio cloud builds for Windows, macOS and Linux from the source currently open in the editor**;
- **standalone packaged Window/GUI applications on Windows, macOS and Linux**;
- first Patch Window/Designer slice in Studio;
- Windows/macOS/Linux JavaScript CI plus explicit Lean verification CI.

## Build an application

The build names are deliberately explicit.

### Easiest portable executable experience

```bash
patch build hello.patch --target web --out Hello.html
```

This emits one HTML file containing the directly compiled Patch Wasm module and its tiny browser host. Open the file in a modern browser.

Patch Studio exposes this as **Standalone Web App (.html)**.

### Build desktop applications directly from Patch Studio

Choose **Windows / macOS / Linux desktop** in Patch Studio and press **Build**.

Studio opens a small cloud-build dialog where you can choose:

```text
Target: Windows / macOS / Linux / all three
Type:   Console / Window GUI
```

The Patch source currently in the editor is sent as a workflow input to the repository's **Patch Native Apps** GitHub Actions workflow, so the source does not need to be committed first. Studio follows the workflow run and exposes the resulting artifacts.

A GitHub token is required to dispatch and inspect the Actions run. Patch Studio keeps the token only in memory in the current browser tab and does not save it in the Patch project or `localStorage`.

Console desktop builds use the direct Patch Wasm native host. Window projects are packaged as standalone desktop GUI applications with a generated Electron player. The GUI package is standalone, but the Patch Window model is **not yet lowered to native AppKit/Win32/GTK widgets**.

This makes it possible to edit a Patch program on an iPhone or in any modern browser and request a Windows, macOS or Linux build from the same Studio UI.

See [`docs/PATCH_STUDIO.md`](docs/PATCH_STUDIO.md) and [`docs/NATIVE_APPS.md`](docs/NATIVE_APPS.md).

### Native desktop package from the CLI

```bash
patch build hello.patch --target app --name Hello
```

On the machine performing the build this creates:

```text
macOS   -> Hello.app
Windows -> Hello.exe
Linux   -> Hello
```

The Patch programmer does not write Rust. Patch compiles the supported program to direct Wasm, embeds it into a small native host, and invokes Cargo for final platform packaging. Rust/Cargo is currently required once on the native build machine.

For a terminal-style native binary:

```bash
patch build hello.patch --target native --out Hello
```

For all three desktop OSes from one repository, the **Patch Native Apps** GitHub Actions workflow builds and uploads separate macOS, Windows and Linux artifacts. Beta.17 lets Patch Studio dispatch that workflow with the unsaved source currently in the editor.

## WebAssembly targets

Patch now distinguishes the two Wasm outputs clearly:

```text
--target wasm
  bootstrap carrier
  Patch source + Change IR embedded for a Patch host

--target wasm-direct
  supported Patch instructions lowered directly to Wasm
  requires the tiny Patch host ABI
```

Direct Wasm currently imports:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

So a raw `.direct.wasm` file is real executable Wasm code, but it is **not yet a standalone WASI command module**. Use:

```bash
patch run-wasm program.patch
```

or build a standalone Web App / native app around it.

## Direct backend boundary

Currently directly lowered:

```text
top-level numeric create
numeric set/add/remove/clear changes
numeric show
+ - * /
explicit comparisons and boolean conditions
if / else
literal repeat + count
non-recursive numeric recipes
acyclic recipe calls
ranged numeric parameter guards
block-level numeric transition trace
```

Not directly lowered yet:

```text
dynamic repeat counts
create inside control-flow bodies
recursive recipe cycles
return-valued recipes
things and fields
text and lists
%
watch / history / undo / redo / why / preview
window / controls / events
```

Unsupported constructs fail explicitly instead of silently falling back.

**Important:** the compact native console host uses this same direct numeric subset. Beta.17 adds a separate packaged desktop player for current Patch Window/Designer projects, so GUI projects can be built for Windows, macOS and Linux even though native-widget lowering remains future work.

## Semantic Change Contracts

Patch can infer what a recipe may change and constrain that authority:

```patch
allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

The production analyzer infers `bonus * 2` as `0..10`, so the capability is accepted. A `set score = 999` is not accepted as an `increase`, even though both technically write the same persistent location.

A protected numeric recipe can run directly as Wasm, with declared parameter ranges enforced again at the direct Wasm function boundary.

## Formal assurance

Patch does not perform an ordinary write and then record what happened. In the formal core, the semantic change is the modeled route through which persistent state changes. This is the basis of **State-Change Factorization**.

For the structured formal core Lean proves the containment chain:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

and therefore:

```text
RuntimeChanges(stmt) ⊆ Capability(stmt)
```

Protected certificates keep several claims separate:

```text
formal RangeExpr
      ↓
Lean analyzeRange + rangeAnalysisSound
      ↓
formal SourceStmt
      ↓
Lean source-operation normalization
      ↓
EvidenceStmt
      ↓
CoreStmt
      ↓
formal Change Signature
      ↓
compare independent production signature
      ↓
verified semantic policy check
```

Key Lean modules:

```text
PatchFormal.lean      factorization, intervals, effects, policies
PatchSignature.lean   structured execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
PatchEvidence.lean    proof-free evidence decoder + correspondence
PatchSource.lean      source verbs, normalization + source containment
PatchRange.lean       integer expression evaluation + range-analysis soundness
```

Patch is **not a fully verified compiler**. JavaScript source/AST extraction and full production-runtime-to-formal-execution correspondence remain explicit proof obligations.

## Direct runtime validation

Direct Wasm emits a block-level numeric transition callback:

```text
patch.change_number(i32 targetId, f64 before, f64 after)
```

Independent validators reconstruct the expected Change IR execution and semantic operation/magnitude, then compare the observed direct execution against static Change Signatures and, where present, Change Capabilities.

This is translation/runtime validation evidence, not a machine-checked proof of the complete direct lowering.

## CLI

Node.js 22+ for the current beta toolchain:

```bash
patch run examples/score.patch
patch run-wasm examples/direct-wasm-recipes.patch
patch check examples/score.patch
patch changes examples/change-capabilities.patch
patch formal examples/range-soundness.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean

patch build examples/score.patch --target portable
patch build examples/direct-wasm-recipes.patch --target web --out App.html
patch build examples/direct-wasm-recipes.patch --target wasm-direct --out App.direct.wasm
patch build examples/direct-wasm-recipes.patch --target app --name App
```

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, interval analysis, abstract interpretation, provenance, translation validation, verified checkers, Proof-Carrying Code, undo, event logs, lenses, CRDTs, reversible computation, WebAssembly compilation, Electron packaging or native packaging are individually new.

The candidate contribution is the combination of mandatory semantic mutation, operation/magnitude-aware semantic contracts, formal containment for a structured core, source/evidence separation, quantitative range assurance, and a growing executable backend whose runtime transitions can be independently validated against the same semantic contracts.

## Repository map

```text
src/                    language, compiler, analyses, certificates, Wasm and app builders
formal/                 Lean factorization, signatures, checker, evidence, source, ranges
web/                    Patch Studio PWA and public project site
scripts/                smoke checks, native GUI packaging and deterministic site build
tests/                  language, compiler, formal bridge, Wasm and app-build tests
examples/               runnable .patch programs
docs/                   specification, formal model, compiler, Wasm and native-app docs
paper/                   manuscript draft and references
.github/workflows/       CI, formal verification, native app builds, Pages deployment
```

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.
