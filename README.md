# Patch

> **A tiny change-oriented programming language with one browser-first IDE for everywhere.**

[![Patch CI](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/ci.yml)
[![Formal Verification](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/formal.yml)
[![Native Apps](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/native-apps.yml)
[![FreeBSD C99](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml/badge.svg)](https://github.com/pinkysworld/Patch/actions/workflows/freebsd-c99.yml)

**Current development beta: `0.2.0-beta.26`** · **Change IR: `0.10`**

[Open Patch Studio](https://pinkysworld.github.io/Patch/) · [Language spec](docs/SPEC.md) · [Compiler](docs/COMPILER.md) · [Formal model](docs/FORMAL_MODEL.md) · [Runtime correspondence](docs/RUNTIME_CORRESPONDENCE.md) · [Roadmap](docs/ROADMAP.md) · [Paper](paper/README.md)

Patch is built around one rule:

> **Existing persistent state does not mutate invisibly. Ordinary post-creation mutation is expressed as a semantic `change`.**

```patch
create number score = 0
change score:
  add 1
show score
```

The same mutation substrate supports history, undo/redo, provenance, semantic Change Signatures, magnitude-aware Change Capabilities, range evidence and formal certificates without making normal source verbose.

## Status

| Area | Current status |
|---|---|
| Language | Working interpreter/compiler frontend; **Change IR 0.10** |
| Semantic contracts | Change Signatures + optional operation/magnitude-aware Change Capabilities |
| Static formal core | State-Change Factorization, signature soundness, policy containment, source/evidence correspondence and integer range soundness in Lean 4 |
| Guard-aware runtime | For a conservative safe-integer recipe-parameter fragment, Lean checks branch truth plus runtime-effect/capability correspondence |
| Abstract recipe calls | Lean-checked finite acyclic recipe environment with rank decrease, argument-interval fit and callee-signature containment |
| **Concrete recipe calls** | **Exact safe-integer variable argument evaluation/binding; direct quantitative leaf effects refine imported caller-signature effects** |
| Window input | `input changed` exposes transient event-local `value`; persistent state changes only through explicit `change` |
| Targets | Web, Windows, macOS, Linux; FreeBSD Console via portable C99 |

## Try Patch

Node.js 22+ is required for the current CLI toolchain.

```bash
git clone https://github.com/pinkysworld/Patch.git
cd Patch
npm install
npm test

patch run examples/score.patch
patch certify examples/range-soundness.patch --out RangeSoundness.patchcert.lean
patch runtime-certify examples/runtime-correspondence.patch --out Runtime.patchcert.lean
patch call-certify examples/formal-calls.patch --out Calls.patchcert.lean
npm run concrete-call-certify:example
```

## State-Change Factorization and semantic authority

Patch does not treat mutation as an ordinary write plus optional logging. Existing persistent state changes through the semantic `change` route. The compiler can therefore distinguish bounded increase from arbitrary replacement:

```patch
create number score = 0

allow reward:
  score may increase up to 10

make reward(bonus number 0..5):
  change score:
    add bonus * 2

do reward(4)
```

For the structured effect core, Lean proves the familiar containment chain:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Beta.26: concrete recipe binding and direct effect refinement

Beta.25 established abstract interprocedural signature composition. Beta.26 adds a concrete safe-integer layer for a deliberately conservative call subset without changing Patch source syntax or Change IR.

Using the existing example:

```patch
create number score = 0

make add_points(amount number 0..5):
  change score:
    add amount

make reward(bonus number 0..5):
  do add_points(bonus)

make double_reward(bonus number 0..5):
  do reward(bonus)
  do reward(bonus)

do double_reward(4)
```

The proof-free production witness records concrete caller environments, formal `RangeExpr` arguments, exact values, expected positional callee bindings and beta.25 abstract argument intervals. Lean then checks the chain rather than trusting the JavaScript producer:

```text
caller BindingList
    ↓ envOfBindings
caller IntEnv
    ↓ evalRangeExpr
exact integer argument
    ↓ bindCallParams
exact callee BindingList
    ↓
concrete value ∈ beta.25 actual interval ⊆ declared callee interval
```

`PatchCallSubstitution.lean` proves successful executable argument evaluation and positional binding are sound. `PatchCallRefinement.lean` proves exact concrete values remain admitted when transported through beta.25's abstract argument intervals.

For the narrower direct quantitative leaf case `reward → add_points`, `PatchCallEffect.lean` evaluates `amount` in the exact bound callee environment. For `bonus = 4`, Lean constructs the exact semantic effect:

```text
score increase [4,4]
```

and checks that it refines the formal callee effect:

```text
score increase [0,5]
```

The theorem `checkedConcreteBoundEffectRefinesCallerSignature` then composes that refinement with beta.25's executable callee-membership and callee-to-caller signature-containment checks. The generated `GeneratedConcreteCallCertificate.lean` is compiled under the pinned Lean toolchain; unfinished `sorry`/`admit` proofs are rejected.

### Exact beta.26 boundary

The current concrete certificate covers **inter-recipe variable pass-through arguments** such as `do add_points(bonus)`. Direct effect certification currently covers a **single direct quantitative leaf Change** whose amount is a bound variable. The following remain explicitly outside the beta.26 result:

- root-program call binding certification;
- richer arithmetic call arguments/substitution;
- arbitrary multi-statement/control-flow callee-body execution under the bound environment;
- concrete recursive calls;
- floating-point call correspondence;
- equivalence between the formal call execution and production JavaScript/direct-Wasm execution.

This is a stronger implementation/formal correspondence result, not a claim of complete compiler verification and not a new primary novelty headline.

## Beta.25: abstract recipe-call composition

Direct Wasm already executes acyclic numeric recipe-to-recipe calls. Beta.25 added a conservative formal layer for that existing subset. The production compiler emits a separate `formalCalls` artifact with a well-founded rank, bounded safe-integer argument intervals and semantic signatures.

`PatchCalls.lean` checks a finite `RecipeEnv`. Each direct effect must occur in the recipe's semantic signature. Each call must resolve to a strictly lower-rank recipe, pass an argument interval contained by the callee parameter interval and import a callee signature contained by the caller signature.

The executable checker is `checkRecipeEnv`; `callSignatureSoundness` proves effects from a modeled finite rank-decreasing call execution remain inside the caller signature. The production-generated `GeneratedCallCertificate.lean` requires `checkRecipeEnv callEnv = true` via `native_decide`.

Unknown callees, recursive/cyclic call graphs, duplicate recipe names, unbounded formal parameters, unsupported argument expressions and unsupported body constructs fail conservatively instead of being labelled verified.

## Beta.24: semantic Window input events

GUI input does not create a second persistent-write path:

```patch
create text name = ""

window "Hello":
  input name
  text "Hello {name}"

when name changed:
  change name:
    set = value
```

`value` is transient event-local data. Editing the control itself does not assign persistent state; only the explicit semantic `change` commits it. Patch Studio, the standalone Window Web runtime and generated Windows/macOS/Linux Window players use the same contract.

## Beta.23: guard-aware runtime correspondence

For supported protected direct-Wasm recipes, proof-free concrete effects, `RuntimePath` and concrete recipe-parameter environments are checked by Lean against `SourceExecutes`, normalized source-guard truth and Change Capability containment. `PatchGuarded.lean` includes `GuardShape`, `GuardPathValid`, `checkGuardedSourceRuntimeEvidence_sound` and `checkedGuardedConcreteRuntimeCannotEscape`.

This remains a restricted formal fragment. Persistent/global state guards, floating-point guard correspondence and other unsupported expressions remain outside the stronger runtime theorem.

## Change IR 0.10

The compiler carries separate assurance artifacts rather than overloading one representation:

```text
instructions
capabilities
changeSignatures
changeCapabilities
formalBridge
formalSource
formalCalls
sourceValidation
guardValidation
```

Beta.26 does **not** bump Change IR. Its concrete call witness/certificate is generated from the existing AST + `formalCalls` boundary and remains a separate proof-free research artifact.

## Window builds

The shared Window preflight supports the portable event pairs button `clicked` and input `changed`, rejects duplicate or missing controls and prevents unsupported event/control combinations from being silently packaged.

| Target | Current result |
|---|---|
| Standalone Window Web App | Single `.html` with generated Patch Window runtime |
| Windows Window/GUI | Standalone packaged GUI application with `.exe` |
| macOS Window/GUI | Standalone `.app` package |
| Linux Window/GUI | Standalone GUI application package |
| FreeBSD Console | Native executable from portable C99 + FreeBSD 15.1 `cc` |

## WebAssembly and C99 boundaries

`--target wasm-direct` is a Console backend for the conservative numeric/control-flow/recipe subset. Raw `.direct.wasm` uses Patch's small host ABI and is **not yet a standalone WASI command module**.

Portable C99 covers the conservative numeric Console subset and is compile/run tested on Linux, macOS and FreeBSD 15.1.

## Formal and implementation modules

```text
src/formal-calls.js                 production-side conservative finite call artifact
src/call-certificate.js             generated abstract-call Lean certificate
src/concrete-call-witness.js        proof-free concrete call/binding witness producer
src/concrete-call-certificate.js    generated concrete binding/effect Lean certificate
src/source-validation.js            independent SourceStmt/range extraction validation
src/guard-validation.js             independent raw-source GuardTree validation
src/runtime-certificate.js          direct execution + guard-aware Lean certificate
src/window-events.js                transient Window event-local payload adapter
formal/PatchFormal.lean             factorization, intervals, effects, policies
formal/PatchSignature.lean          effect-only execution + signature soundness
formal/PatchChecker.lean            verified semantic policy checker
formal/PatchSource.lean             source normalization + SourceExecutes
formal/PatchRange.lean              integer evaluator/range soundness
formal/PatchRuntime.lean            EffectRefines + RuntimePath correspondence
formal/PatchRuntimeCapability.lean  concrete runtime capability containment
formal/PatchGuarded.lean            guard truth + guarded runtime/capability correspondence
formal/PatchCalls.lean              ranked acyclic call composition + call-aware signature soundness
formal/PatchCallSubstitution.lean   exact concrete argument evaluation + positional binding
formal/PatchCallRefinement.lean     concrete value → abstract/declaration interval composition
formal/PatchCallEffect.lean         bound direct quantitative effect → caller-signature refinement
```

## Research boundary

Patch does **not** claim novelty for patches, first-class state change, effects, capabilities, range analysis, procedure-call semantics, parameter substitution, call graphs, well-founded/ranked restrictions, interprocedural effect composition, effect refinement, guard semantics, translation validation, proof-carrying evidence, verified checkers, WebAssembly/C generation or GUI event plumbing.

The primary candidate contribution remains narrower: **ordinary persistent mutation is factored through a mandatory semantic Change substrate, and operation-/magnitude-aware semantic authority is derived from that same substrate**. Beta.26 strengthens the assurance chain showing that concrete values and a conservative concrete leaf effect can respect that semantic authority across a recipe boundary; it is supporting evidence, not a separate firstness claim.

Patch is still **not a fully verified compiler**. Production parser correctness, JavaScript→Wasm lowering, the Wasm engine, proof-free witness extraction, arbitrary call-body substitution and production runtime equivalence remain explicit boundaries.

## Next priorities

Research: expand concrete call certification to richer `RangeExpr` arithmetic and larger callee-body/control-flow fragments; then connect it to observed direct-Wasm call execution, build semantic-security/plugin case studies, measure certificate/checker overhead and harden reproducibility.

Product: richer Designer interaction, native AppKit/Win32/portable Unix GUI lowering, signing/notarization and a less token-dependent build service.

## License

MIT for the implementation. Academic text remains subject to normal scholarly citation expectations.
