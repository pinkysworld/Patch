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

Current development beta: **0.2.0-beta.12**

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
- **directly executable Change IR to WebAssembly for a numeric console core**;
- **direct Wasm `if` / `else` and literal `repeat` with Patch `count`**;
- **direct non-recursive numeric `make` / `do` recipes as real Wasm functions**;
- **Wasm runtime guards for ranged numeric recipe parameters**;
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
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

The production analyzer infers `bonus * 2` as `0..10`, so the capability is accepted. A `set score = 999` is not accepted as an `increase`, even though both technically write the same persistent location.

Beta 12 can now execute this kind of protected numeric recipe through the direct Wasm backend as well:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
show score
```

The capability is still checked by the production compiler before lowering. The ranged `bonus` parameter is also guarded inside the generated Wasm function.

## Beta 9: machine-checked integer range analysis

`formal/PatchRange.lean` defines a compact integer expression language with integer literals, ranged variables, addition, subtraction, negation, and multiplication by a non-negative integer constant.

It defines:

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

So for:

```text
bonus in [0,5]
bonus * 2
```

Lean proves every modeled concrete result is inside `[0,10]`.

The production expression analyzer supports more than this verified fragment. Division, decimal/floating-point semantics and general variable-by-variable multiplication are not silently presented as covered by the Lean range theorem.

`src/formal-range.js` independently parses supported production expression text into `RangeExpr`, independently reconstructs the corresponding range and compares it with the ordinary production analyzer before a formal range claim is accepted.

## Formal source and semantic evidence chain

Beta 8 introduced a proof-free `SourceStmt` retaining `add`, `remove`, `set` and `clear`. Lean performs semantic direction normalization itself. Beta 9 adds the quantitative range layer:

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

## Direct WebAssembly execution

Patch has two deliberately distinct WebAssembly targets:

```text
--target wasm
Patch source -> Change IR -> embedded payload -> Patch host/interpreter

--target wasm-direct
Patch source -> Change IR -> direct lowering -> Wasm instructions -> WebAssembly VM
```

The bootstrap target remains useful for broader language/browser coverage. The direct target never silently falls back to interpretation for unsupported constructs.

### Beta 10 numeric core

The first direct backend added:

```text
create number at top level
change number: set / add / remove / clear
show numeric-expression
numeric literals and earlier numeric bindings
+  -  *  /
```

Numeric persistent bindings are mutable Wasm `f64` globals. Output uses the minimal host ABI:

```text
patch.show_number(f64) -> void
```

### Beta 11 structured control flow

Beta 11 added real WebAssembly control flow:

```text
if / else
true / false
numeric == != < > <= >=
not / and / or
literal repeat 0..100000
Patch repeat local count
nested repeat count shadowing
```

A repeat is executed through Wasm `block`, `loop`, `br_if` and `br`, not by a Patch interpreter host.

Patch's 1-based `count` is represented by a real Wasm local. Nested repeats allocate independent locals so the inner `count` shadows the outer value just as it does in the interpreter.

Bare numeric truthiness such as `if score:` and dynamic `repeat times:` remain deliberately outside the current direct backend.

### Beta 12 recipes and ranged guards

Beta 12 adds non-recursive numeric recipes as actual Wasm functions:

```patch
create number score = 0

make add_points(amount):
  change score:
    add amount

do add_points(3)
show score
```

The Wasm module now contains `run()` plus one function for each supported recipe. `do` becomes a real Wasm `call`. Recipe parameters are Wasm `f64` parameters and can participate in arithmetic, comparisons, `if`, and calls to other acyclic recipes.

Acyclic recipe-to-recipe calls are supported:

```patch
make add_points(amount):
  change score:
    add amount

make twice(amount):
  do add_points(amount)
  do add_points(amount)
```

Ranged parameters receive generated runtime guards:

```patch
make reward(bonus number 0..5):
  change score:
    add bonus * 2
```

If a statically known call is outside the range, the production compiler rejects it before Wasm generation. If the argument cannot be proven statically and reaches the function outside the range at runtime, the generated Wasm guard traps before the recipe body executes.

This gives a useful two-stage enforcement path:

```text
Patch Change Capability / call-range analysis
                  ↓
           compile-time checks
                  ↓
           direct Wasm lowering
                  ↓
      ranged parameter runtime guard
                  ↓
         Wasm recipe function body
```

Build and run the beta-12 example:

```bash
patch build examples/direct-wasm-recipes.patch --kind console --target wasm-direct --out DirectRecipes.wasm
patch run-wasm examples/direct-wasm-recipes.patch
```

See `docs/DIRECT_WASM.md` for the detailed backend boundary.

## Differential backend validation

For the direct subset, the same Patch source is executed through both implementations:

```text
same supported Patch source
      |                    |
      v                    v
Patch interpreter     direct Wasm
      |                    |
      +---- compare output + final state ----+
```

The suite covers linear mutation, multiple numeric bindings, decimal arithmetic, branches, boolean composition, repeat/count, nested repeats, branches inside loops, protected ranged recipes, acyclic recipe calls, recipe parameters, and runtime range enforcement.

Cross-platform CI builds and executes the direct backend on Windows, macOS and Linux with Node 22 and 24.

This is meaningful executable evidence, but it is **not** claimed as a compiler-correctness proof.

## Remaining trust boundary

Beta 12 is **not full compiler verification**.

Still trusted/unproved:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> independent RangeExpr / SourceStmt extraction

production interpreter / direct Wasm backend
   -> correspondence with formal evalRangeExpr / SourceExecutes / Executes
```

Within the certified fragment, Lean machine-checks the range-analysis theorem, source semantic normalization, evidence correspondence, formal signature reconstruction and policy containment. The direct backend currently adds differential execution and explicit runtime checks rather than a lowering-correctness theorem.

A particularly strong next research step is an explicit semantic change-trace ABI for direct execution plus translation validation or a theorem connecting supported Change IR operations and calls to Wasm effects.

## Direct backend boundary

Not directly lowered yet include:

```text
dynamic repeat counts
create inside control-flow bodies
recursive recipe cycles
return-valued recipes
things and field access
text and lists
%
watch / history / undo / redo / why / preview
window / controls / events
```

Unsupported constructs fail explicitly with `DirectWasmUnsupportedError` rather than silently falling back to the bootstrap backend.

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
   -> direct numeric Change IR -> Wasm     [implemented]
   -> direct if/literal-repeat Wasm         [implemented]
   -> direct non-recursive recipe/call Wasm [implemented, beta.12]
   -> ranged recipe Wasm runtime guards     [implemented, beta.12]
   -> semantic direct change-trace ABI     [next research/backend stage]
   -> typed expression/core IR             [next compiler stage]
   -> native .exe / .app packaging         [not yet]
```

## CLI

Node.js 22+ for the current JavaScript beta toolchain:

```bash
patch run examples/score.patch
patch run-wasm examples/direct-wasm-recipes.patch
patch check examples/score.patch
patch changes examples/change-capabilities.patch
patch formal examples/range-soundness.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch build examples/score.patch --kind console --target portable
patch build examples/score.patch --kind console --target wasm
patch build examples/direct-wasm-recipes.patch --kind console --target wasm-direct
```

## Research identity

Patch does **not** claim that patches, first-class state change, effect systems, capabilities, interval analysis, abstract interpretation, provenance, translation validation, verified checkers, Proof-Carrying Code, source calculi, undo, event logs, lenses, CRDTs, reversible computation or WebAssembly compilation are individually new.

The candidate contribution is the combination:

1. **State-Change Factorization**: persistent mutation must execute through a semantic change.
2. **Semantic Change Contracts**: operation- and magnitude-aware signatures/policies are derived from that mandatory mutation representation.
3. **Formal runtime containment**: Lean proves the runtime-signature-policy chain for a structured core.
4. **Source-to-semantic assurance**: Lean performs source-operation normalization before semantic evidence checking.
5. **Quantitative assurance for a useful fragment**: Lean proves soundness of the formal integer interval analyzer, while production extraction and unsupported arithmetic remain explicit boundaries.
6. **Executable backend path**: a growing Change IR subset lowers directly to Wasm, now including branches, literal loops, non-recursive recipe calls, and ranged-parameter guards, and is differentially checked against interpreter behavior.

A high-venue submission still needs systematic related work, stronger AST/source correspondence, direct-runtime/formal correspondence, explicit semantic trace preservation through lowering, convincing semantic-security/engineering case studies and measured overhead/effectiveness.

## Repository map

```text
src/                    parser, interpreter, analyses, formal extractors, certificates, compiler, bootstrap Wasm, direct Wasm, Designer
formal/                 Lean factorization, signatures, checker, evidence, source core, range soundness
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, range/source/bridge/certificate, compiler, UI, Designer, bootstrap/direct Wasm
examples/               runnable .patch programs including range-soundness.patch and direct-wasm-recipes.patch
docs/                   specification, formal model, novelty, research, compiler, direct Wasm, Studio, targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal verification, Pages deployment
```

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.
