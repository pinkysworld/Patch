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

Current development beta: **0.2.0-beta.13**

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
- machine-checked integer range-analysis soundness for the beta.9 formal expression fragment;
- independent production `RangeExpr` extraction and range-agreement checking before certification;
- `patch formal` coverage reporting and `patch certify` Lean certificates;
- portable `.patchapp` bundles and bootstrap WebAssembly modules;
- directly executable numeric Change IR to WebAssembly;
- direct Wasm `if` / `else` and literal `repeat` with Patch `count`;
- direct non-recursive numeric `make` / `do` recipes as real Wasm functions;
- Wasm runtime guards for ranged numeric recipe parameters;
- **direct block-level numeric semantic transition trace**;
- differential interpreter vs direct-Wasm validation of output, final state **and ordered transition history**;
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

A protected numeric recipe can now be executed directly as Wasm:

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

The production compiler checks the Change Capability before lowering, and the generated Wasm recipe also guards the declared parameter range at runtime.

## Formal assurance

### State-Change Factorization

The Lean formal machine proves that every modeled persistent state-changing step is witnessed by a well-formed semantic `Change` and commits through the modeled change path. Mutation Transparency follows by showing the witness is present in resulting history.

### Change Signatures and capabilities

For the structured formal core Lean proves the containment chain:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

and therefore:

```text
RuntimeChanges(stmt) ⊆ Capability(stmt)
```

### Formal source and evidence boundary

Generated protected certificates keep several claims separate:

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

Formal CI explicitly builds all six modules with Lean 4.30 and compiles a certificate generated from production Patch source.

## Machine-checked integer range analysis

For the beta.9 formal integer fragment Lean defines:

```text
analyzeRange : RangeExpr -> RangeEnv -> Option Interval
evalRangeExpr : RangeExpr -> IntEnv -> Option Int
```

and proves `rangeAnalysisSound`:

```text
EnvRespects(ranges, values)
analyzeRange(expr, ranges) = some inferred
evalRangeExpr(expr, values) = some concrete
------------------------------------------------
concrete is inside inferred
```

The formal fragment includes integer literals, ranged variables, addition, subtraction, negation and multiplication by a non-negative integer constant. It does **not** silently cover division, decimals or general multiplication.

## Direct WebAssembly execution

Patch has two deliberately distinct Wasm targets:

```text
--target wasm
Patch source -> Change IR -> embedded payload -> Patch host/interpreter

--target wasm-direct
Patch source -> Change IR -> direct lowering -> Wasm instructions -> WebAssembly VM
```

The bootstrap target remains useful for broader language/browser coverage. The direct target never silently falls back to interpretation for unsupported constructs.

### Numeric state

The current direct backend represents supported persistent Patch numbers as mutable Wasm `f64` globals and imports:

```text
patch.show_number(f64) -> void
```

It directly supports numeric `create`, `change`, `show`, arithmetic and explicit comparisons/boolean conditions.

### Structured control flow

`if` / `else` lowers to Wasm structured conditionals. Literal `repeat 0..100000` lowers to Wasm `block`, `loop`, `br_if` and `br`. Patch's 1-based `count` is a real Wasm local and nested repeats preserve `count` shadowing.

### Direct recipes

Supported non-recursive numeric `make` definitions become real Wasm functions. `do` becomes a Wasm `call`. Recipe parameters are `f64` parameters and can participate in arithmetic, conditions and acyclic calls to other supported recipes.

Ranged parameters receive direct runtime guards. A statically known bad call is rejected by the production compiler; a value whose range is not statically known is checked again at the Wasm function boundary.

## Beta 13: direct semantic transition trace

Direct execution now exposes the same numeric transition boundary used by Patch history.

The direct module imports a second host function:

```text
patch.change_number(i32 targetId, f64 before, f64 after) -> void
```

Every supported `change` block emits exactly one event after its operations complete.

For:

```patch
create number score = 1

change score:
  add 2
  add 3
  remove 1
```

Patch history contains one transition:

```text
score: 1 -> 5
```

and direct Wasm emits one corresponding event:

```text
{ target: "score", before: 1, after: 5 }
```

This is deliberately block-level rather than operation-level because one Patch `change` block is one committed semantic Change in the interpreter model.

The differential backend suite now validates three observables:

```text
1. output
2. final persistent numeric state
3. ordered (target, before, after) transition trace
```

So the comparison has become:

```text
same supported Patch source
        |                         |
        v                         v
Patch interpreter            direct Wasm
        |                         |
 output / state / history    output / state / trace
        |                         |
        +--------- exact comparison ---------+
```

This matters because two programs can reach the same final state through different intermediate state transitions.

See `docs/DIRECT_WASM_TRACE.md` for the exact trace boundary and limitations.

## What beta 13 still does not prove

Patch is **not a fully verified compiler**.

Still trusted/unproved include:

```text
Patch source bytes
   -> JavaScript parser / AST
   -> RangeExpr / SourceStmt extraction
```

and:

```text
production interpreter / direct Wasm execution
   -> formal evalRangeExpr / SourceExecutes / Executes
```

The new trace is differential validation evidence, not a machine-checked lowering theorem. It currently records numeric target/before/after transitions but not the full semantic operation list, source provenance, versions, inverses or capability evidence.

That narrower boundary is intentional.

## Direct backend boundary

Currently direct:

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

Unsupported constructs fail explicitly with `DirectWasmUnsupportedError`.

## Compiler status

```text
Patch source
   -> parser / AST                          [implemented]
   -> Change Signature + capability checks  [implemented]
   -> formal RangeExpr / SourceStmt views   [implemented]
   -> Change IR 0.7                         [implemented]
   -> portable .patchapp                    [implemented]
   -> bootstrap WebAssembly .wasm           [implemented]
   -> direct numeric Change IR -> Wasm      [implemented]
   -> direct if/literal-repeat Wasm          [implemented]
   -> direct non-recursive recipe/call Wasm [implemented]
   -> ranged recipe Wasm runtime guards     [implemented]
   -> direct numeric transition trace       [implemented, beta.13]
   -> typed expression/core IR              [next compiler stage]
   -> lowering translation validation       [next research stage]
   -> native .exe / .app packaging          [not yet]
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
5. **Quantitative assurance for a useful fragment**: Lean proves soundness of the formal integer interval analyzer, while production extraction remains an explicit boundary.
6. **Executable backend path**: a growing Change IR subset lowers directly to Wasm, including control flow, recipes and ranged guards.
7. **Transition-level backend validation**: direct Wasm now emits an ordered committed-transition trace that is differentially compared with interpreter history.

A high-venue submission still needs systematic related work, stronger AST/source correspondence, formal or independently checked direct-lowering correspondence, convincing semantic-security/engineering case studies and measured overhead/effectiveness.

## Repository map

```text
src/                    parser, interpreter, analyses, formal extractors, certificates, compiler, bootstrap/direct Wasm, Designer
formal/                 Lean factorization, signatures, checker, evidence, source core, range soundness
web/                    Patch Studio PWA and public project site
scripts/                smoke checks and deterministic site build
tests/                  language, range/source/bridge/certificate, compiler, UI, Designer, bootstrap/direct Wasm
examples/               runnable .patch programs including range-soundness.patch and direct-wasm-recipes.patch
docs/                   specification, formal model, novelty, research, compiler, direct Wasm and trace, Studio, targets
paper/                   manuscript draft and references
.github/workflows/       cross-platform CI, formal verification, Pages deployment
```

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.
