# Patch Core Formal Model

Status: **beta.30: mechanized semantic-change contracts, guard-aware runtime correspondence, finite acyclic recipe-call signature composition, exact safe-integer call binding, guard-aware structured callee traces, and finite transitive exact call-tree traces**.

Patch is not a fully verified compiler. Lean covers explicit fragments; the JavaScript frontend, WebAssembly lowering/runtime and implementation-side evidence producers remain named trust or translation-validation boundaries.

## Lean modules

- `PatchFormal.lean`: semantic operations, changes, state, intervals, effects and policies.
- `PatchSignature.lean`: effect-only execution and Change Signature Soundness.
- `PatchChecker.lean`: executable verified semantic policy checker.
- `PatchEvidence.lean`: proof-free evidence decoding/correspondence.
- `PatchSource.lean`: source mutation normalization and `SourceExecutes`.
- `PatchRange.lean`: integer `RangeExpr` evaluator/analyzer and `rangeAnalysisSound`.
- `PatchRuntime.lean`: `EffectRefines`, `TraceRefines`, `RuntimePath` correspondence.
- `PatchRuntimeCapability.lean`: concrete runtime capability containment.
- `PatchGuarded.lean`: `GuardExpr`, `evalGuard`, guard truth and guard-aware RuntimePath validity.
- `PatchCalls.lean`: finite recipe environments, argument-interval fit, rank-decreasing calls and call-aware signature soundness.
- `PatchCallSubstitution.lean`: exact `RangeExpr` argument evaluation, `envOfBindings` and positional callee binding.
- `PatchCallRefinement.lean`: exact concrete values transported through abstract argument intervals into declarations.
- `PatchCallEffect.lean`: exact bound direct quantitative effects refined into imported caller-signature effects.
- `PatchCallBody.lean`: beta.28/29 executable exact callee-body traces for direct emits, sequence, static repeat and exact formal-guard branches.
- `PatchCallBodyImport.lean`: beta.28/29 selected whole-trace import from callee signature to caller signature.
- `PatchCallTree.lean`: beta.30 finite recursive exact call-tree evaluation, nested exact binding, rank checks and edge-by-edge signature import.

Beta.30 does **not** introduce another arithmetic or guard language and does not change Change IR. It composes the existing `RangeExpr`, `GuardExpr`, exact binding and `SignatureCovers` layers into a finite nested-call certificate.

## Core containment

For the effect-only structured core:

```text
Executes(stmt, runtime)
=> RuntimeChanges(runtime) ⊆ inferSignature(stmt)
```

Combined with the verified semantic policy checker:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

## Guard-aware direct runtime

The beta.23 path independently validates supported source/guard extraction and checks proof-free direct-Wasm effects and branch paths against formal source execution, guard truth and Change Capabilities. That theorem remains separate from the call-aware certificate layers.

`PatchGuarded.lean` provides the formal guard language reused by beta.29 and beta.30:

```text
GuardExpr.bool
GuardExpr.eq
GuardExpr.lt
GuardExpr.le
GuardExpr.and
GuardExpr.or
GuardExpr.not
```

`evalGuard` evaluates these guards over an `IntEnv` using the exact integer `RangeExpr` evaluator.

## Beta.25 abstract call layer

`PatchCalls.lean` models finite structured `CallStmt` bodies with direct effects, sequence, branches, literal repeats and calls carrying abstract argument intervals. A `RecipeEnv` stores parameter intervals, a well-founded rank, semantic signature and body.

`checkRecipeEnv` verifies direct-effect membership, lower-rank call resolution, `ArgsFit` and callee-to-caller `SignatureCovers`. `callSignatureSoundness` proves effects from modeled rank-decreasing call execution remain in the caller signature.

## Beta.26–27 exact binding and arithmetic coverage

Serializable production bindings are represented as `BindingList := List (Name × Int)`. `envOfBindings` bridges them to `IntEnv`. `concreteCallBinding_sound` checks exact argument evaluation, declared-range fit and positional binding.

`PatchCallRefinement.lean` connects exact values through beta.25 abstract intervals into declarations. The exact arithmetic fragment is:

```text
RangeExpr.lit Int
RangeExpr.var Name
RangeExpr.add left right
RangeExpr.sub left right
RangeExpr.neg expr
RangeExpr.scale Nat expr
```

`PatchCallEffect.lean` re-evaluates direct quantitative leaf amounts under exact bindings and uses `EffectRefines` to connect them to caller-signature effects.

## Beta.28 exact structured callee traces

Beta.28 established the branch-free `BoundStmt` fragment with `skip`, quantitative `emit`, `seq` and literal/static `repeat`.

`BoundExec bindings stmt trace` is the relational semantics. `evalBoundStmt` is executable, `evalBoundStmt_sound` recovers the relational witness, and `evalBoundStmtEqBool_sound` validates proof-free claimed traces through the verified `effectEqBool` checker.

`BoundBodyCovered` requires every formal expected effect in the body to be represented by the callee signature. `checkedConcreteCallBodyRefinesCallerSignature` composes exact binding, exact body execution, static coverage and beta.25 signature import.

`GeneratedConcreteCallBodyCertificate.lean` remains beta.28 regression evidence.

## Beta.29 guard-aware exact structured callee traces

Beta.29 extends the same `BoundStmt` semantics with:

```text
branch GuardExpr thenBranch elseBranch
```

No JavaScript Boolean is trusted as the branch fact. Lean evaluates:

```text
evalGuard guard (envOfBindings bindings)
```

and executes only the selected branch. Static `BoundBodyCovered` deliberately remains stronger: **both branch arms** must be represented in the callee signature.

`GeneratedGuardedCallBodyCertificate.lean` exercises both true and false branch choices and remains a required regression certificate for beta.30.

## Beta.30 finite transitive exact call-tree traces

Beta.30 keeps beta.29 `BoundStmt` unchanged as the call-free leaf layer and adds:

```text
CallTreeStmt.base BoundStmt
CallTreeStmt.seq
CallTreeStmt.repeat Nat
CallTreeStmt.branch GuardExpr
CallTreeStmt.call callerRank calleeRank argExprs params declared calleeSignature body
```

### Indexed execution environment

`CallTreeExec` is indexed by `BindingList`. This is essential because a nested call intentionally changes the active exact environment:

```text
current bindings
  -> evaluate nested RangeExpr arguments
  -> concreteCallBinding
  -> new callee BindingList
  -> recursively evaluate nested body
```

The executable `evalCallTreeStmt` follows the same structure. `evalCallTreeStmt_sound` proves successful executable evaluation yields the relational `CallTreeExec` witness.

### Indexed signature coverage

`CallTreeCovered` is indexed by semantic signature. A nested call is accepted only when:

1. `calleeRank < callerRank`;
2. the nested body is covered by the nested callee signature; and
3. `SignatureCovers calleeSignature enclosingSignature`.

`callTreeCoveredBool` checks these obligations recursively. Therefore the generated certificate does not rely on the JavaScript producer merely asserting that a nested tree is finite or rank-decreasing.

### Exact transitive trace

For each nested call, Lean re-evaluates the call arguments using the existing safe-integer `RangeExpr` semantics and reconstructs the next positional `BindingList` with `concreteCallBinding`. Direct effects remain grounded in beta.26/27 quantitative refinement. Branches reuse `evalGuard`; repeats remain literal/static.

`callTreeExecRefinesSignature` proves that every effect occurrence in the recursively evaluated selected trace refines the enclosing signature. A nested trace is first checked against its own callee signature and then imported **one signature edge at a time**.

The certificate-facing theorem is:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

The generated certificate additionally exports:

- strict beta.25 rank decrease for the **outer** certified call edge;
- `ConcreteArgsFit` obtained through `concreteThroughAbstractBool_sound` for the outer concrete values and beta.25 abstract intervals;
- exact outer `ConcreteCallBindingSpec`;
- complete selected `TraceRefinesSignature` for the finite transitive trace.

### Generated beta.30 evidence

`GeneratedTransitiveCallBodyCertificate.lean` is regenerated from `examples/formal-transitive-calls.patch` in CI. The example contains:

```text
caller -> outer -> middle -> leaf
```

The strongest certificate has two nested call levels. For the concrete example the exact selected transitive trace is:

```text
score increase [4,4]
coins increase [3,3]
```

Pinned Lean independently checks the outer binding, abstract interval fit, outer rank decrease, every nested argument/binding, every nested rank decrease, selected guards/repeats/effects, nested signature coverage and edge-by-edge signature import.

## Exact beta.30 boundary

Covered:

- finite beta.25-supported acyclic/rank-decreasing recipe environments;
- bounded safe-integer `RangeExpr` arguments;
- exact positional outer and nested bindings;
- direct quantitative `add`/`remove` effects;
- sequence;
- literal/static repeat;
- formal `GuardExpr` over exact recipe parameters;
- exact selected branch paths;
- complete finite selected transitive semantic-effect traces;
- strict rank decrease checked for the outer certified edge and every nested edge;
- beta.25 abstract interval fit for outer concrete arguments;
- nested callee-signature coverage and edge-by-edge caller-signature import.

Still outside:

- root-program concrete call certification;
- recursive/cyclic call trees;
- dynamic repeat counts;
- persistent-state variables inside exact guard certificates;
- returns;
- expressions outside the supported safe-integer `RangeExpr` / Boolean `GuardExpr` fragments;
- floating-point call semantics;
- equivalence to production JavaScript/direct-Wasm call execution;
- full compiler correctness.

Unsupported assurance cases fail closed rather than being flattened into a stronger claim.

## Trust boundaries

Still not machine proved:

- production or independent JavaScript parser correctness;
- correctness/completeness of the proof-free AST/formalCalls/call-tree extraction producers;
- JavaScript → Wasm lowering correctness;
- Wasm engine correctness;
- runtime observation completeness;
- production JavaScript/direct-Wasm call execution equivalence.

The production witnesses remain proof-free inputs. For beta.30, Lean independently recomputes exact bindings, rank obligations, guard truth, structured/nested body evaluation, exact trace equality and signature-containment obligations for the supported fragment.

## Research boundary

Procedure-call semantics, substitution, arithmetic expression evaluation, structured execution traces, guard evaluation, interprocedural effect summaries, interval analysis, effect refinement, proof-carrying evidence, translation validation and verified checkers all have extensive prior art. Beta.30 finite transitive exact call trees are **supporting assurance**, not a standalone firstness claim.

The primary candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from that same mutation substrate**.
