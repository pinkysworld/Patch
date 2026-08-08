# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)

**Current development beta: `0.2.0-beta.17`** · **Change IR: `0.7`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Language spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is an experimental general-purpose language built around one deliberately simple rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0

change score:
  add 1

show score
```

The source stays small while the compiler/runtime can derive history, undo/redo, preview, provenance, semantic **Change Signatures**, magnitude-aware **Change Capabilities**, range evidence and formal certificates from the same structured change model.

## Status at a glance

| Area | Beta.17 status |
|---|---|
| Language | Working interpreter and compiler front end; Change IR 0.7 |
| Semantic contracts | Change Signatures, optional Change Capabilities, numeric magnitude bounds |
| Formal work | Lean 4 factorization, signature soundness, policy containment, source/evidence checks and integer range soundness for explicit fragments |
| Direct backend | Numeric state, arithmetic, conditions, literal loops and non-recursive numeric recipes lowered directly to WebAssembly |
| Backend validation | Interpreter differential tests plus independent transition and semantic-effect validation |
| Patch Studio | Browser-first PWA, editor, Run, first Window Designer, Changes and IR views |
| Browser builds | `.patchapp`, standalone single-file Web App, direct Wasm and bootstrap Wasm |
| Desktop builds | Windows, macOS and Linux Console **and Window/GUI packages** initiated from Patch Studio |

## Try Patch

Node.js 22+ is required for the current command-line toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm install

node src/cli.js run examples/score.patch
npm test
```

Useful commands:

```bash
patch run examples/score.patch
patch check examples/score.patch
patch changes examples/change-capabilities.patch
patch formal examples/range-soundness.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch run-wasm examples/direct-wasm-recipes.patch
```

## Build from Patch Studio

Patch Studio is the easiest way to experiment with the language. It runs in a modern browser and can be installed as a PWA on desktop, iPhone and iPad.

| Target | Where it builds | Current result |
|---|---|---|
| Standalone Web App | Locally in Studio | One `.html` file with direct Patch Wasm + tiny browser host |
| Direct WebAssembly | Locally in Studio | Real directly lowered `.wasm`; uses the small Patch host ABI |
| Portable Patch app | Locally in Studio | `.patchapp` bundle |
| Windows Console | GitHub Actions Windows runner | `.exe` package |
| Windows Window/GUI | GitHub Actions Windows runner | Standalone packaged GUI app |
| macOS Console | GitHub Actions macOS runner | `.app` package |
| macOS Window/GUI | GitHub Actions macOS runner | Standalone packaged GUI app |
| Linux Console | GitHub Actions Linux runner | Native executable package |
| Linux Window/GUI | GitHub Actions Linux runner | Standalone packaged GUI app |

For desktop cloud builds, select the operating system in Studio, set **Project Type** to **Console** or **Window**, and press **Build**. The current editor source is submitted to the repository's `Patch Native Apps` workflow and does not have to be committed first.

A fine-grained GitHub token with Actions read/write permission is currently required. Studio keeps the token only in the current page and does not save it to the Patch project or `localStorage`.

See [Patch Studio](docs/PATCH_STUDIO.md) and [Native application builds](docs/NATIVE_APPS.md).

## WebAssembly: two different targets

Patch deliberately distinguishes the old compatibility carrier from the direct compiler backend:

```text
--target wasm
  bootstrap carrier
  Patch source + Change IR embedded for a Patch host

--target wasm-direct
  supported Patch instructions lowered directly to Wasm
  imports the tiny Patch host ABI
```

The direct module currently imports:

```text
patch.show_number(f64)
patch.change_number(i32 targetId, f64 before, f64 after)
```

So a raw `.direct.wasm` is executable WebAssembly, but **not yet a standalone WASI command module**. For the simplest standalone experience, build a Web App or desktop application, or use:

```bash
patch run-wasm program.patch
```

## Direct compiler boundary

Currently lowered directly to Wasm:

```text
top-level numeric create
numeric set/add/remove/clear
numeric show
+ - * /
comparisons and boolean conditions
if / else
literal repeat + 1-based count
non-recursive / acyclic numeric recipes
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

Unsupported direct-backend constructs fail explicitly instead of silently falling back.

**Window/GUI desktop packages use a separate generated desktop player for the current Patch Window model. They are standalone applications, but not yet native AppKit/Win32/GTK widget code generation.**

## Semantic Change Contracts

Patch can infer what a recipe may change and constrain that authority semantically rather than merely saying that it can write a location:

```patch
allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

For the supported range fragment, the compiler infers `bonus * 2` as `0..10`. A `set score = 999` is not treated as an `increase`, even though both operations write the same persistent location.

A protected numeric recipe can execute through the direct Wasm backend with declared parameter ranges enforced again at the Wasm function boundary.

## Formal assurance

Patch is **not a fully verified compiler**. The repository keeps that boundary explicit.

For the structured formal core, Lean proves the containment chain:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

therefore:

```text
RuntimeChanges(stmt) ⊆ Capability(stmt)
```

The certificate path keeps several claims separate:

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

Key modules:

```text
PatchFormal.lean      factorization, intervals, effects, policies
PatchSignature.lean   structured execution + signature soundness
PatchChecker.lean     executable verified semantic policy checker
PatchEvidence.lean    proof-free evidence decoder + correspondence
PatchSource.lean      source verbs, normalization + source containment
PatchRange.lean       integer evaluation + range-analysis soundness
```

JavaScript source/AST extraction and complete production-runtime-to-formal-execution correspondence remain explicit proof obligations.

## Direct runtime validation

The direct Wasm runtime reports a deliberately small observation:

```text
patch.change_number(i32 targetId, f64 before, f64 after)
```

An independent validator executes the supported Change IR semantics separately, reconstructs expected transitions and concrete semantic effects, then compares those effects with the static Change Signature and, where present, the Change Capability.

This is **translation/runtime validation evidence**, not a theorem that the entire compiler is correct. See [direct trace validation](docs/DIRECT_TRACE_VALIDATION.md) and [semantic-effect validation](docs/DIRECT_EFFECT_VALIDATION.md).

## Documentation

| Document | Purpose |
|---|---|
| [SPEC](docs/SPEC.md) | Language syntax and semantics |
| [COMPILER](docs/COMPILER.md) | Parser → AST → Change IR and backend architecture |
| [PATCH_STUDIO](docs/PATCH_STUDIO.md) | Browser IDE, Designer and cross-platform Build workflow |
| [NATIVE_APPS](docs/NATIVE_APPS.md) | Windows/macOS/Linux packaging details |
| [FORMAL_MODEL](docs/FORMAL_MODEL.md) | Formal definitions, theorems and trust boundaries |
| [NOVELTY](docs/NOVELTY.md) | Contribution boundary and prior-art discipline |
| [DIRECT_TRACE_VALIDATION](docs/DIRECT_TRACE_VALIDATION.md) | Independent Change-IR transition validation |
| [DIRECT_EFFECT_VALIDATION](docs/DIRECT_EFFECT_VALIDATION.md) | Runtime semantic-effect / contract validation |
| [ROADMAP](docs/ROADMAP.md) | Completed milestones and next priorities |
| [paper/](paper/) | Research manuscript source |

## What comes next

The highest-value next steps are deliberately narrower than adding more surface syntax:

1. reduce the remaining trust gap from production source/AST to formal `RangeExpr` / `SourceStmt`;
2. connect direct runtime effect occurrences to the Lean execution model;
3. move the Window backend from the current packaged player toward native AppKit/Win32/portable Unix widgets;
4. extend the Designer with selection, properties, drag/resize and richer controls;
5. add signing/notarization and installer-quality desktop artifacts.

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, interval analysis, abstract interpretation, provenance, translation validation, verified checkers, Proof-Carrying Code, reversible computation, WebAssembly compilation or native packaging are individually new.

The candidate contribution is the combination of mandatory semantic mutation, operation/magnitude-aware semantic contracts, formal containment for a structured core, source/evidence separation, quantitative range assurance, and an executable backend whose runtime transitions can be independently checked against the same semantic contracts.

## Repository map

```text
src/                    language, compiler, analyses, certificates, Wasm and app builders
formal/                 Lean factorization, signatures, checker, evidence, source, ranges
web/                    Patch Studio PWA and public project site
scripts/                smoke checks, native packaging and deterministic site build
tests/                  language, compiler, formal bridge, Wasm and app-build tests
examples/               runnable .patch programs
docs/                   specification, research, compiler and platform docs
paper/                   manuscript draft and references
.github/workflows/       CI, formal verification, native builds and Pages deployment
```

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.
