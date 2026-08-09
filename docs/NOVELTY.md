# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo/history, effects, capabilities, range analysis, provenance, source calculi, procedure-call substitution, arithmetic expression evaluation, guard semantics, refinement relations, execution witnesses, translation validation, proof-carrying evidence, verified checkers, interprocedural effect summaries, ranked/well-founded call graphs, WebAssembly/C generation or GUI packaging. All have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.27 broadens production-generated concrete-call certificates to the already mechanized safe-integer `RangeExpr` fragment. This is supporting assurance, not a new novelty headline.**

## Prior-art discipline

Patch must continue to compare against Plaid/first-class state change, Worlds/scoped state, classical/graded/quantitative/refinement effect systems, capability/permission/typestate work, abstract interpretation, interprocedural effect analysis, procedure-call operational semantics/substitution, call-graph analyses, well-founded/ranked restrictions, translation validation (including Necula), Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages, CRDTs and provenance/Whyline-style debugging.

Do not claim invention of effect inference, quantitative effects, concrete parameter binding, arithmetic substitution, interprocedural effect composition, effect refinement, call-graph ranking, runtime path witnesses, translation validation, refinement checking or proof-carrying evidence.

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

For beta.26/27's supported concrete direct leaf case:

```text
exact caller RangeExpr evaluation
+ exact positional callee binding
+ concrete value through abstract/declaration intervals
+ exact bound quantitative RangeExpr effect
+ beta.25 callee → caller signature containment
------------------------------------------------
concrete effect refines an effect in caller semantic signature
```

## Beta.23–26 supporting assurance

Beta.23 checks proof-free direct-runtime branch witnesses against normalized safe-integer guards and Change Capabilities. Beta.25 adds finite abstract call-aware signature composition. Beta.26 adds exact concrete inter-recipe binding and direct leaf-effect refinement for a variable-pass-through production certificate subset.

These layers strengthen the implementation/formal connection but remain explicit fragments rather than end-to-end compiler verification.

## Beta.27 arithmetic certificate coverage

The formal `PatchRange.lean` semantics already covered integer literals, variables, addition, subtraction, negation and multiplication by a non-negative integer literal. Beta.26's production concrete-call encoder intentionally exposed only variables.

Beta.27 recursively preserves the already-proved formal `RangeExpr` tree in generated certificates. For:

```patch
make leaf(amount number 1..6):
  change score:
    add amount * 2

make caller(bonus number 0..5):
  do leaf(bonus + 1)
```

the generated certificate encodes both `bonus + 1` and `amount * 2` as formal expressions. JavaScript's exact values remain proof-free claims; Lean independently re-evaluates the expressions under exact environments, reconstructs the positional binding and checks the exact direct leaf effect through the existing refinement/signature theorems.

`GeneratedArithmeticCallCertificate.lean` is generated from a real Patch program and accepted by pinned Lean. Standard Formal CI checks it in addition to the older variable-only certificate, and a dedicated workflow checks the arithmetic artifact separately.

This result should be described as **certificate coverage of an existing mechanized arithmetic fragment**, not as invention of arithmetic substitution, abstract interpretation or interprocedural analysis.

## Exact beta.27 boundary

The concrete certificate supports:

- bounded safe-integer inter-recipe arguments with literals, variables, addition, subtraction, unary negation and non-negative constant scaling;
- exact positional binding;
- beta.25 abstract interval → declaration checks;
- a direct quantitative leaf `add`/`remove` amount using the same formal arithmetic fragment;
- exact singleton effect refinement into the caller semantic signature.

Still excluded:

- division and decimals;
- general variable-by-variable multiplication;
- root-program concrete call certification;
- arbitrary structured callee bodies and complete concrete call traces;
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
- production-generated Lean certificates;
- independent runtime transition/effect validation;
- C99/FreeBSD and Window artifacts;
- provenance/undo/preview/replay tooling.

## Candidate beta.27 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For mechanized fragments we prove Change Signature Soundness, semantic policy containment and integer range-analysis soundness. For a finite acyclic recipe fragment, Lean checks abstract argument-interval and semantic-signature composition. Generated proof-free concrete call evidence is re-evaluated by Lean for exact positional binding; the production certificate now preserves the existing formal integer expression fragment including addition, subtraction, negation and non-negative constant scaling. For direct quantitative leaf Changes, the exact evaluated effect is proved to refine an effect admitted by the caller semantic signature. These results do not constitute arbitrary callee-body substitution correctness, production-Wasm call equivalence or full compiler verification.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. retain State-Change Factorization + quantitative semantic authority as the primary claim;
2. extend from a single direct leaf effect to **structured concrete callee-body execution under exact bindings**;
3. connect call-aware concrete formal traces to observed direct-Wasm execution;
4. build semantic-security/plugin cases where bounded semantic authority matters;
5. measure analysis/validation/certificate/checker/backend overhead and complete systematic related-work/reproducibility passes.

Patch remains plausible as an OOPSLA/ECOOP-style direction, but is not yet submission-ready. The next gains should come from structured concrete call/runtime correspondence and evaluation rather than unrelated feature accumulation.
