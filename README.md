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

Current development beta: **0.2.0-beta.10**

Implemented now:

- working interpreter and compiler front end;
- normalized Change IR 0.7 preserving semantic `change` operations;
- automatically inferred semantic **Change Signatures**;
- compile-time operation- and magnitude-aware **Change Capabilities**;
- ranged numeric parameters, production interval analysis and runtime range guards;
- causal source/recipe/event provenance and `why` queries;
- Lean 4 State-Change Factorization, Mutation Transparency, Change Signature Soundness and end-to-end capability containment;
- formal Source core preserving source-level `add` / `remove` / `set` / `clear` before semantic normalization;
- proof-free semantic evidence decoded and checked by Lean;
- **machine-checked integer range-analysis soundness for the beta.9 formal expression fragment**;
- independent production `RangeExpr` extraction and range-agreement checking before certification;
- `patch formal` coverage reporting and `patch certify` Lean certificates;
- portable `.patchapp` bundles and valid bootstrap WebAssembly modules;
- **first directly executable Change IR to WebAssembly backend for the numeric console core**;
- differential interpreter vs direct-Wasm execution tests;
- console programs and first GUI/Designer slice;
- Windows/macOS/Linux JavaScript CI plus explicit Lean range/source/evidence/certificate CI.

## The core research idea

Patch does not perform an ordinary write and then record what happened. The semantic change is the route through which persistent state changes:

```text
construct delta
      ↓
apply delta
      ↓
new persistent state
```

There is no ordinary persistent reassignment escape hatch for an existing Patch binding. This is the basis of **State-Change Factorization**.

## Semantic Change Contracts

Patch can infer what a recipe may change and constrain that authority:

```patch
allow reward:
  player.score may increase up to 10

make reward(player, bonus number 0..5):
  change player:
    add bonus * 2 to score
```

The normal production analyzer infers `bonus * 2` as `0..10`, so the capability is accepted. A `set score = 999` is not accepted as an `increase`, even though both write the same path.

## Beta 9: machine-checked integer range analysis

`formal/PatchRange.lean` defines a compact integer expression language:

```text
integer literal
ranged variable
addition
subtraction
negation
multiplication by a non-negative integer constant
```

It defines both:

```text
analyzeRange : RangeExpr -> RangeEnv -> Option Interval
evalRangeExpr : RangeExpr -> IntEnv -> Option Int
```

and proves the general theorem `rangeAnalysisSound`:

```text
EnvRespects(ranges, values)
analyzeRange(expr, ranges) = some inferred
evalRangeExpr(expr, values) = some concrete
------------------------------------------------
concrete is inside inferred
```

So for the motivating example:

```text
bonus in [0,5]
bonus * 2
```

Lean proves every modeled concrete result is inside `[0,10]`.

### Conservative verification boundary

The production expression analyzer supports more than the beta.9 verified fragment. That does **not** mean all production arithmetic is now formally verified.

Beta 9 certification deliberately refuses currently unmodeled cases such as:

- division;
- decimal/floating-point semantics;
- general variable-by-variable multiplication.

`src/formal-range.js` independently parses supported production expression text into `RangeExpr`. It independently computes the corresponding range and compares it with the ordinary production analyzer result before a formal range claim is accepted.

This gives three deliberately separate paths:

```text
production expression -> normal production range analyzer

production expression -> independent formal RangeExpr extractor -> formal-style range

RangeExpr -> Lean analyzeRange -> machine-checked range-soundness theorem
```

A disagreement or unsupported formal expression prevents certification instead of silently receiving a verification claim.

## Formal source and semantic evidence chain

Beta 8 introduced a proof-free `SourceStmt` retaining `add`, `remove`, `set` and `clear`. Lean performs semantic direction normalization itself. For example:

```patch
change player:
  add -5 to score
```

is preserved as source `add [-5,-5]`, then Lean normalizes it to semantic `decrease [5,5]`.

Beta 9 extends the certificate chain to quantitative expressions:

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

Formal CI explicitly builds all six modules and compiles a certificate generated from a real `bonus * 2` Patch example.

## Beta 10: first directly executable WebAssembly core

Beta 10 adds a second WebAssembly target alongside the existing bootstrap carrier.

```text
--target wasm
Patch source -> Change IR -> embedded payload -> Patch host

--target wasm-direct
Patch source -> Change IR -> Wasm instructions -> WebAssembly VM
```

The first direct backend is intentionally narrow. It currently supports console programs containing:

```text
create number
change number: set / add / remove / clear
show numeric-expression
numeric literals and earlier numeric bindings
+  -  *  /
```

For example:

```patch
create number base = 2
create number score = base * 3 + 1

change score:
  add base * (4 - 1)

show score
```

can now be compiled into a Wasm module whose `run()` function performs the Patch state updates directly. Numeric persistent bindings are exported as mutable Wasm globals and output uses the minimal host ABI `patch.show_number(f64)`.

```bash
patch build examples/direct-wasm.patch --kind console --target wasm-direct --out DirectScore.wasm
patch run-wasm examples/direct-wasm.patch
```

CI executes the same supported Patch programs through both the interpreter and direct Wasm and compares output and final state. Unsupported language features fail explicitly with `DirectWasmUnsupportedError`; they do not silently fall back to interpretation.

This is direct compiled execution for a useful core, not yet full-language direct compilation and not yet a compiler-correctness theorem. Recipes/calls, structured control flow, strings/lists, things/fields, history operations and GUI lowering remain open backend work.

See `docs/DIRECT_WASM.md` for the exact boundary.

## Remaining trust boundary

Beta 10 is **not full compiler verification**.

Still trusted/unproved:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> independent RangeExpr / SourceStmt extraction

production runtime / direct backend
   -> correspondence with formal evalRangeExpr / SourceExecutes
```

Within the certified fragment, Lean machine-checks the range-analysis theorem, source semantic normalization, evidence correspondence, formal signature reconstruction and policy containment. The direct backend currently adds differential execution evidence rather than a lowering correctness proof.

The next strongest formal target is a theorem or independently validated relation connecting the supported production AST directly to `RangeExpr` / `SourceStmt`, followed by production/direct-runtime trace correspondence.

## Compiler status

The compiler is already functional as a beta compiler and artifact pipeline:

```text
Patch source
   -> parser / AST                         [implemented]
   -> Change Signature + capability checks [implemented]
   -> formal RangeExpr / SourceStmt views  [implemented]
   -> Change IR 0.7                        [implemented]
   -> portable .patchapp                   [implemented]
   -> bootstrap WebAssembly .wasm          [implemented]
   -> direct numeric Change IR -> Wasm     [implemented, beta.10 subset]
   -> structured control-flow/call Wasm    [next backend stage]
   -> native .exe / .app packaging         [not yet]
```

The bootstrap target remains useful for broader Patch/browser coverage. The new direct target executes the supported numeric console subset as real WebAssembly instructions without a Patch interpreter host.

## CLI

Node.js 22+ for the current JavaScript beta toolchain:

```bash
patch run examples/score.patch
patch run-wasm examples/direct-wasm.patch
patch check examples/score.patch
patch changes examples/change-capabilities.patch
patch formal examples/range-soundness.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch build examples/score.patch --kind console --target portable
patch build examples/score.patch --kind console --target wasm
patch build examples/direct-wasm.patch --kind console --target wasm-direct
```

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, interval analysis, abstract interpretation, provenance, translation validation, verified checkers, Proof-Carrying Code, source calculi, undo, event logs, lenses, CRDTs, reversible computation or WebAssembly compilation are individually new.

The candidate contribution is the combination:

1. **State-Change Factorization**: persistent mutation must execute through a semantic change.
2. **Semantic Change Contracts**: operation- and magnitude-aware signatures/policies are derived from that mandatory mutation representation.
3. **Formal runtime containment**: Lean proves the runtime-signature-policy chain for a structured core.
4. **Source-to-semantic assurance**: Lean performs source-operation normalization before semantic evidence checking.
5. **Quantitative assurance for a useful fragment**: Lean proves soundness of the formal integer interval analyzer, while production extraction and unsupported arithmetic remain explicit boundaries.
6. **Executable backend path**: a first Change IR subset now lowers directly to Wasm and is differentially checked against interpreter behavior.

A high-venue submission still needs systematic related work, stronger AST/source correspondence, runtime/lowering correspondence, broader direct compiled execution, convincing security/engineering case studies and measured overhead/effectiveness.

## Repository map

```text
src/                    parser, interpreter, analyses, formal extractors, certificates, compiler, bootstrap Wasm, direct Wasm, Designer
formal/                 Lean factorization, signatures, checker, evidence, source core, range soundness
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, range/source/bridge/certificate, compiler, UI, Designer, bootstrap/direct Wasm
examples/               runnable .patch programs including range-soundness.patch and direct-wasm.patch
docs/                   specification, formal model, novelty, research, compiler, direct Wasm, Studio, targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal verification, Pages deployment
```

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.
