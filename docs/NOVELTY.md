# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo/history, effects, capabilities, range analysis, provenance, source calculi, procedure-call substitution, arithmetic expression evaluation, structured execution traces, guard semantics, refinement relations, execution witnesses, translation validation, proof-carrying evidence, verified checkers, interprocedural effect summaries, ranked/well-founded call graphs, WebAssembly/C generation or GUI packaging. All have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.28 checks complete exact semantic-effect traces for a conservative sequence/static-repeat callee-body fragment. This is supporting assurance, not a new novelty headline.**

## Prior-art discipline

Patch must continue to compare against Plaid/first-class state change, Worlds/scoped state, classical/graded/quantitative/refinement effect systems, capability/permission/typestate work, abstract interpretation, interprocedural effect analysis, procedure-call operational semantics/substitution, structured operational semantics, call-graph analyses, well-founded/ranked restrictions, translation validation, Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages, CRDTs and provenance/Whyline-style debugging.

Do not claim invention of effect inference, quantitative effects, concrete parameter binding, arithmetic substitution, structured trace semantics, interprocedural effect composition, effect refinement, call-graph ranking, runtime path witnesses, translation validation, refinement checking or proof-carrying evidence.

## Machine-checked status

Current formal results include, among others:

```text
State-Change Factorization
Mutation Transparency
Change Signature Soundness
verified semantic policy checker
integer rangeAnalysisSound
EffectRefines / TraceRefines soundness
checkedConcreteRuntimeCannotEscape
GuardShape / GuardPathValid
checkedGuardedConcreteRuntimeCannotEscape
checkRecipeEnv_sound
callSignatureSoundness
checkedRecipeExecutionCannotEscape
concreteCallBinding_sound
valueFitsWithin
concreteArgsFitThroughAbstract
concreteThroughAbstractBool_sound
evalBoundQuantitativeEffectEqBool_sound
evalBoundQuantitativeEffect_sound
checkedConcreteBoundEffectRefinesCallerSignature
evalBoundStmt_sound
effectListEqBool_sound
evalBoundStmtEqBool_sound
boundBodyCoveredBool_sound
boundExecRefinesSignature
checkedEvaluatedBoundBodyRefinesSignature
checkedConcreteCallBodyRefinesCallerSignature
```

For the effect-only core:

```text
RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt)
```

For beta.25 abstract calls:

```text
checked finite recipe environment
+ modeled rank-decreasing call execution
------------------------------------------------
effect trace ⊆ caller semantic signature
```

For beta.26/27's direct quantitative leaf case:

```text
exact caller RangeExpr evaluation
+ exact positional callee binding
+ concrete value through abstract/declaration intervals
+ exact bound quantitative RangeExpr effect
+ beta.25 callee → caller signature containment
------------------------------------------------
concrete effect refines an effect in caller semantic signature
```

For beta.28's supported structured body:

```text
exact caller → callee binding
+ Lean-evaluated direct quantitative emits
+ sequence/static-repeat body execution
+ exact proof-free trace equality check
+ callee signature coverage
+ callee → caller SignatureCovers
------------------------------------------------
whole concrete callee trace refines caller semantic signature
```

## Beta.23–27 supporting assurance

Beta.23 checks proof-free direct-runtime branch witnesses against normalized safe-integer guards and Change Capabilities. Beta.25 adds finite abstract call-aware signature composition. Beta.26 adds exact concrete inter-recipe binding and direct leaf-effect refinement. Beta.27 carries the already-mechanized integer `RangeExpr` grammar through the production certificate boundary.

These layers strengthen the implementation/formal connection but remain explicit fragments rather than end-to-end compiler verification.

## Beta.28 structured trace coverage

The new production artifact reconstructs a deliberately conservative callee body from direct quantitative Change blocks, sequence and literal non-negative repeat. Branches, nested calls, dynamic repeats, returns/creation and unsupported operations are rejected instead of flattened.

For:

```patch
make award(amount number 1..5):
  change score:
    add amount
  repeat 2:
    change coins:
      add amount * 2

make caller(bonus number 0..4):
  do award(bonus + 1)
```

with `bonus = 2`, the proof-free producer claims:

```text
score increase [3,3]
coins increase [6,6]
coins increase [6,6]
```

`GeneratedConcreteCallBodyCertificate.lean` does not accept the list as proof. Lean independently evaluates the encoded `BoundStmt`, compares the actual and claimed lists through verified `effectEqBool`, checks callee body coverage and imports the whole trace into the caller signature through `checkedConcreteCallBodyRefinesCallerSignature`.

This result should be described as **machine-checked whole-trace refinement for one conservative exact callee-body fragment**, not as arbitrary procedure semantics, general interprocedural verification or production-Wasm equivalence.

## Exact beta.28 boundary

Supported:

- bounded safe-integer inter-recipe arguments from the beta.27 expression fragment;
- exact positional binding;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal/static repeat;
- exact complete trace for that body;
- callee signature coverage and caller signature import.

Still excluded:

- branch/guard choices in the structured certificate;
- nested recipe calls in the certified body;
- dynamic repeats;
- arbitrary state-dependent amounts;
- root-program concrete call certification;
- complete transitive nested-call traces;
- recursion/floating-point call semantics;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

## Primary vs supporting contribution

Primary candidate claim:

> Patch factors ordinary persistent mutation through a structured semantic Change representation and derives operation- and magnitude-aware semantic authority from that same mandatory mutation substrate.

Supporting assurance/evaluation mechanisms, not novelty headlines:

- source/range and GuardTree translation validation;
- verified semantic policy checker and machine-checked integer range fragment;
- RuntimePath/GuardPath checking and concrete runtime capability containment;
- finite rank-decreasing recipe-call signature composition;
- exact safe-integer and arithmetic call binding for explicit subsets;
- direct bound quantitative effect refinement into caller signatures;
- exact structured sequence/static-repeat callee traces;
- production-generated Lean certificates;
- independent runtime transition/effect validation;
- C99/FreeBSD and Window artifacts;
- provenance/undo/preview/replay tooling.

## Candidate beta.28 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For mechanized fragments we prove Change Signature Soundness, semantic policy containment and integer range-analysis soundness. For finite acyclic recipe environments, Lean checks abstract argument-interval and semantic-signature composition. Generated proof-free concrete call evidence is re-evaluated for exact positional binding and arithmetic effects. For a conservative direct quantitative sequence/static-repeat callee-body fragment, Lean independently evaluates the complete semantic-effect trace, checks exact trace equality and proves the whole concrete trace is represented by the caller semantic signature. These results do not establish branch-aware or nested-call exact callee execution, production-Wasm call equivalence or full compiler verification.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. retain State-Change Factorization + quantitative semantic authority as the primary claim;
2. add branch/guard-aware exact callee traces;
3. extend to nested/transitive concrete call traces;
4. connect call-aware concrete formal traces to observed direct-Wasm execution;
5. build semantic-security/plugin cases where bounded semantic authority matters;
6. measure analysis/validation/certificate/checker/backend overhead and complete systematic related-work/reproducibility passes.

Patch remains plausible as an OOPSLA/ECOOP-style direction, but is not yet submission-ready. The next gains should come from guard/nested-call runtime correspondence and evaluation rather than unrelated feature accumulation.
