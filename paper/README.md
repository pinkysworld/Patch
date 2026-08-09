# Paper

Working manuscript:

**Patch: State-Change Factorization and Semantic Change Contracts for Transparent Mutable Programs**

## Current artifact status

The implementation/research artifact is **Patch 0.2.0-beta.30 / Change IR 0.10**. The manuscript remains working research text, not yet a submission-ready top-venue paper.

The assurance story now includes:

1. **Lean semantic core**: factorization, Mutation Transparency, Change Signature Soundness, verified policy containment and integer range-analysis soundness.
2. **Source/guard translation validation**: separate production and raw-source artifact paths for explicit fragments.
3. **Direct-runtime validation/correspondence**: concrete semantic effects and guard-aware path evidence for a conservative direct-Wasm subset.
4. **Abstract call composition**: finite acyclic `formalCalls` environments checked by `PatchCalls.lean`.
5. **Exact concrete call binding**: exact safe-integer call arguments re-evaluated and positionally bound by Lean.
6. **Direct leaf-effect refinement**: exact bound quantitative effects refined into caller semantic signatures.
7. **Arithmetic certificate coverage**: production concrete-call certificates preserve the already mechanized integer `RangeExpr` fragment.
8. **Beta.28 exact structured callee traces**: complete semantic-effect traces for direct quantitative sequence/static-repeat bodies.
9. **Beta.29 guard-aware exact structured traces**: Lean independently evaluates formal branch truth under exact callee bindings while both arms remain statically covered.
10. **Beta.30 finite transitive exact call-tree traces**: Lean recursively checks nested exact bindings, rank decrease, selected execution and edge-by-edge signature import.

None of these is described as complete compiler verification.

## Beta.30 finite transitive exact call-tree milestone

The reproducible example is `examples/formal-transitive-calls.patch` and has the finite call chain:

```text
caller -> outer -> middle -> leaf
```

The strongest generated certificate covers the concrete `caller -> outer` edge and preserves two nested call levels rather than flattening nested effects in JavaScript.

For the example, the exact selected transitive trace is:

```text
score increase [4,4]
coins increase [3,3]
```

`formal/PatchCallTree.lean` keeps beta.29 `BoundStmt` as the call-free leaf layer and adds structural sequence/static-repeat/GuardExpr branch nodes plus nested call nodes.

Each nested call node carries beta.25 caller/callee ranks, formal `RangeExpr` arguments, parameter names, declaration intervals, nested callee signature and the nested body. Lean independently checks:

- exact outer argument evaluation and positional binding;
- concrete outer values through beta.25 abstract call intervals into declarations;
- strict rank decrease on the outer certified edge;
- exact evaluation/binding of every nested call argument;
- strict rank decrease at every nested edge;
- exact `GuardExpr` choices and static repeats;
- every supported direct quantitative effect;
- nested body coverage by its callee semantic signature;
- edge-by-edge `SignatureCovers` import through the call tree;
- exact equality between the proof-free claimed transitive trace and Lean's recursively evaluated trace.

The certificate-facing theorem is:

```text
checkedConcreteTransitiveCallTreeRefinesCallerSignature
```

`GeneratedTransitiveCallBodyCertificate.lean` is regenerated and verified under pinned Lean by both the focused beta.30 workflow and standard Formal CI.

### Exact beta.30 boundary

Covered:

- finite acyclic/rank-decreasing beta.25 recipe environments;
- bounded safe-integer inter-recipe `RangeExpr` arguments;
- exact outer and nested positional binding;
- strict outer and nested rank checks;
- beta.25 abstract interval fit for concrete outer arguments;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal/static repeat;
- formal Boolean/comparison `GuardExpr` over exact recipe parameters;
- exact selected branch paths;
- complete finite selected transitive semantic-effect traces;
- nested callee-signature coverage and edge-by-edge caller-signature import.

Still outside:

- root-program concrete call certification;
- recursion/cycles;
- dynamic repeats;
- persistent-state exact guard variables;
- returns;
- expressions outside the supported safe-integer/Boolean formal fragments;
- recursive/full floating-point procedure semantics;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

## Beta.29 guard-aware exact callee-trace milestone

Beta.29 extended beta.28 `BoundStmt` with `branch GuardExpr thenBranch elseBranch`. Lean evaluates the already-mechanized formal guard through `evalGuard guard (envOfBindings bindings)`. Concrete execution contains only the selected branch, while `BoundBodyCovered` requires **both** arms to be represented in the callee semantic signature.

`GeneratedGuardedCallBodyCertificate.lean` exercises both a true and false branch and remains beta.30 regression evidence.

## Beta.28 exact structured callee-trace milestone

Beta.28 established the branch-free baseline with direct quantitative emits, sequence and static repeat. `GeneratedConcreteCallBodyCertificate.lean` remains regression evidence.

The theorem chain remains:

```text
evalBoundStmt
→ evalBoundStmtEqBool_sound
→ BoundBodyCovered
→ boundExecRefinesSignature
→ checkedConcreteCallBodyRefinesCallerSignature
→ TraceRefinesSignature exactTrace callerSignature
```

## Beta.25–27 call milestones

Beta.25 checks finite ranked abstract calls and semantic-signature composition. Beta.26 adds exact safe-integer positional binding and direct leaf-effect refinement. Beta.27 carries the already-mechanized integer `RangeExpr` grammar through generated concrete-call certificates.

These are assurance layers, not separate novelty claims.

## Supporting runtime/product milestones

The beta.23 guard-aware runtime path checks concrete direct-Wasm effects and branch witnesses against normalized source guards and Change Capabilities for an explicit safe-integer fragment. Beta.24 shows that editable Window input preserves the single semantic persistent-mutation route: control edits expose transient `value`; only source `change` persists state.

Patch Studio also has source-backed Designer selection/property editing, project-specific sealed Console executables and a sandboxed/validated Window desktop runtime path. These are engineering/artifact improvements, not novelty claims.

## Current formal modules

```text
PatchFormal.lean             factorization, state, intervals, effects, policies
PatchSignature.lean          effect-only execution + signature soundness
PatchChecker.lean            verified semantic policy checker
PatchEvidence.lean           proof-free evidence decoding
PatchSource.lean             source normalization + SourceExecutes
PatchRange.lean              integer evaluator/range soundness
PatchRuntime.lean            EffectRefines + RuntimePath correspondence
PatchRuntimeCapability.lean  concrete runtime capability containment
PatchGuarded.lean            GuardExpr truth + guarded runtime/capability correspondence
PatchCalls.lean              finite ranked calls + abstract signature soundness
PatchCallSubstitution.lean   exact RangeExpr evaluation + positional binding
PatchCallRefinement.lean     concrete values through abstract/declaration intervals
PatchCallEffect.lean         exact bound quantitative effect → caller signature
PatchCallBody.lean           beta.28/29 exact guarded structured body execution
PatchCallBodyImport.lean     beta.28/29 exact selected trace → caller signature
PatchCallTree.lean           beta.30 finite transitive exact call-tree traces
```

## Artifact engineering

Reproducible certificate commands include:

```bash
npm run concrete-call-certify:example
npm run arithmetic-call-certify:example
npm run callee-trace-certify:example
npm run guarded-callee-trace-certify:example
npm run transitive-callee-trace-certify:example
```

The artifact also retains direct numeric Patch→Wasm, portable C99 tested on Linux/macOS/FreeBSD 15.1, Windows/macOS/Linux Console and Window packages, Standalone Window Web Apps and Patch Studio. These engineering features support artifact evaluation but are not novelty claims.

## Current claim boundary

A defensible beta.30 formal/artifact statement is:

> For explicit mechanized fragments, Patch proves semantic Change Signature and policy properties and checks conservative source/guard/runtime evidence. For finite acyclic recipe environments, Lean checks abstract argument-interval and semantic-signature composition. Generated proof-free concrete call evidence is re-evaluated for exact safe-integer positional binding, arithmetic effects and guarded structured traces. For the beta.30 finite call-tree fragment, Lean recursively re-evaluates nested call arguments/bindings, mechanically checks strict rank decrease, evaluates the complete selected transitive semantic-effect trace, checks exact trace equality and imports nested callee signatures edge by edge into the caller signature. These results do not establish production-Wasm call equivalence, root-program certification, recursive/full floating-point semantics or full compiler verification.

Still unverified include parser/extractor correctness, JavaScript→Wasm lowering, Wasm engine correctness and complete call-aware runtime observation/correspondence.

## Remaining high-value gaps

- composition of beta.30 exact transitive certificates with **observed direct-Wasm call execution**;
- semantic-security/plugin case studies;
- measured validation/certificate/checker/backend overhead;
- systematic related-work review and reproducibility bundle;
- empirical usability work only with appropriate study/ethics design.

## Prior-art discipline

Patch does not claim novelty for procedure-call semantics, parameter/arithmetic substitution, structured or transitive trace semantics, guard evaluation, call graphs, well-founded recursion restrictions, interprocedural effect summaries, range analysis, effect refinement, abstract interpretation, translation validation, Proof-Carrying Code, verified checkers, WebAssembly/C generation, provenance, undo, GUI wiring or cross-platform packaging.

The candidate contribution remains **mandatory semantic mutation factorization plus operation-/magnitude-aware semantic authority derived from the same representation**. Beta.30's transitive call-tree layer is supporting assurance, not a firstness assertion.

## Manuscript source

`main.tex` remains the working article source and requires a controlled manuscript synchronization pass before venue submission. No empirical performance or user-study results should be stated until actually collected.
