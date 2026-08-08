# Patch Core Formal Model

Status: **beta.22: mechanized change semantics, independently validated source extraction, path-witnessed runtime correspondence, and Lean-checked concrete runtime capability containment**.

The executable Patch implementation remains larger than the Lean model. The `formal/` directory proves properties of explicit fragments; JavaScript/Wasm layers remain validation/trust boundaries rather than being described as a verified compiler.

## Lean modules

- `PatchFormal.lean` — values, semantic operations, well-formed changes, machine state, intervals, effects and policies.
- `PatchSignature.lean` — effect-only `CoreStmt`, `Executes`, `inferSignature`, Change Signature Soundness.
- `PatchChecker.lean` — executable verified semantic policy checker.
- `PatchEvidence.lean` — proof-free EvidenceStmt decoding/correspondence.
- `PatchSource.lean` — source `add/remove/set/clear`, normalization and `SourceExecutes`.
- `PatchRange.lean` — integer RangeExpr analysis and `rangeAnalysisSound`.
- `PatchRuntime.lean` — concrete `EffectRefines`, `TraceRefines`, proof-free `RuntimePath`, runtime correspondence.
- `PatchRuntimeCapability.lean` — downward-closed authority under refinement and concrete runtime capability containment.

Formal CI builds all modules and compiles generated static/runtime certificates under pinned Lean. Unfinished `sorry`/`admit` proofs are rejected.

## State-Change Factorization

Every modeled mutation of an existing persistent binding is witnessed by a well-formed semantic `Change`; the formal machine has no alternative persistent-write step. Mutation Transparency follows because the witnessing Change is appended to modeled history.

## Signature and capability soundness

For the effect-only structured core:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) ⊆ inferSignature(stmt)
```

and for a protected formal execution:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

The executable policy checker is proved sound with respect to relational `Allows`.

## Source and range correspondence

`SourceStmt` preserves source mutation verbs:

```text
skip | change | seq | branch | repeat
add | remove | set | clear
```

Lean performs semantic normalization, e.g. non-negative source `add` becomes semantic `increase`. The static certificate also checks formal integer range claims with `rangeAnalysisSound`.

The implementation emits an AST-derived `formalSource`, while an **Independent raw-source parser** separately reconstructs the supported SourceStmt/ranges. Exact agreement is required before protected static certification. This is translation validation, not a proof of either JavaScript parser.

## RuntimePath and runtime correspondence

Concrete direct-Wasm transitions are independently reconstructed into proof-free `EvidenceEffect` occurrences. A separate producer proposes an untrusted execution path:

```text
RuntimePath.leaf
RuntimePath.seq
RuntimePath.branchThen
RuntimePath.branchElse
RuntimePath.repeatZero
RuntimePath.repeatSucc
```

Lean checks the path against decoded `CoreStmt` structure. `decodeCorePath_sound` proves:

```text
decodeCorePath path stmt = some trace
=> Executes stmt trace
```

`checkSourceRuntimeEvidence_sound` then establishes:

```text
checkSourceRuntimeEvidence source observed path = true
------------------------------------------------------
exists formalTrace actualTrace,
  SourceExecutes source formalTrace
  and decodeRuntimeTrace observed = some actualTrace
  and TraceRefines actualTrace formalTrace
```

`EffectRefines` requires target/field/kind equality and amount-interval containment where amounts are present. A concrete `increase [8,8]` can therefore refine formal `increase [0,10]`.

Multiple protected recipe invocations are emitted and checked separately; supported branch/repeat paths can differ between invocations.

## Beta.22 concrete runtime capability theorem

The formal policy theorem previously applied directly to formal `SourceExecutes` effects. Beta.22 closes the next composition step.

### Downward-closed authority

`allowsRefinedEffect` proves:

```text
EffectRefines actual expected
Allows rule expected
--------------------------
Allows rule actual
```

For quantitative effects, this uses interval transitivity:

```text
actual ⊆ expected ⊆ permitted
=> actual ⊆ permitted
```

`traceRefinesPreservesPolicy` lifts the result pointwise to complete traces.

### Concrete runtime containment

`checkedConcreteRuntimeCannotEscape` combines:

```text
checkSourceRuntimeEvidence source observed path = true
checkSourceProtected source policy = true
```

and proves that the decoded concrete `actualTrace` exists and every effect in that trace is allowed by a rule in the declared policy.

Schematically:

```text
observed concrete runtime trace
       ↓ TraceRefines
formal SourceExecutes trace
       ↓ checked source policy
formal capability admission
       ↓ downward closure under EffectRefines
concrete runtime capability admission
```

Generated runtime certificates now include the policy and a per-invocation theorem such as `runtime_reward_1_concrete_policy_safe`.

This is stronger than merely checking the concrete occurrence against a production-side JavaScript policy table, but it remains conditional on the proof-free occurrences/path supplied to Lean. It does not verify the Wasm compiler or runtime observer.

## Important branch-condition limitation

The current `CoreStmt` is intentionally effect-only:

```text
CoreStmt.branch thenBranch elseBranch
```

It does **not** retain the original source Boolean condition. Consequently `Executes` admits either `branchThen` or `branchElse` when the chosen branch itself executes. RuntimePath checking therefore proves that the supplied branch choice is structurally a valid formal execution path, but it does not yet prove that the original source guard evaluated to that Boolean.

This limitation matters. The next formal/compiler feature is a **typed, guard-aware execution core** with a small integer/Boolean expression language and explicit environment/state evaluation. The intended proof structure is:

```text
guard-aware typed execution
      ↓ erase conditions/values
existing effect-only CoreStmt Executes
      ↓
existing signature/capability theorems
```

That preserves the simple effect core while strengthening branch correspondence.

## Current covered runtime fragment

When source/static requirements also pass:

- formal add/remove/set/clear;
- sequence;
- structural branch witnesses;
- literal repeat witnesses;
- multiple protected invocations;
- safe-integer concrete magnitudes;
- concrete runtime capability containment.

Still outside the theorem:

- source guard truth correspondence;
- recipe-call/substitution nodes inside protected formal bodies;
- dynamic repeats outside the literal formal core;
- floating-point/non-integer correspondence;
- GUI/event execution correspondence;
- undo/redo/preview and the full language.

## Trust boundaries

A successful certificate does **not** prove:

- production parser correctness;
- independent raw-source parser correctness;
- JavaScript → Wasm lowering correctness;
- Wasm engine correctness;
- completeness/correctness of transition observation outside the supported ABI;
- JavaScript semantic-effect reconstruction correctness;
- JavaScript RuntimePath producer correctness;
- source-guard branch correspondence;
- full Patch semantics.

The correct description is **Lean-checked correspondence and capability containment for accepted proof-free runtime evidence in a restricted fragment**, not end-to-end verified compilation.

## Research boundary

Refinement/simulation relations, Proof-Carrying Code, translation validation, effect/capability systems, source calculi, abstract interpretation and verified checkers have substantial prior art. The new runtime-capability theorem is an assurance composition result, not a standalone novelty claim.

The candidate primary contribution remains mandatory semantic mutation factorization plus operation-/magnitude-aware authority derived from that same mutation substrate.
