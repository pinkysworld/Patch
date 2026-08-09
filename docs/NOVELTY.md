# Novelty Boundary

Patch is **not** novel merely because it has patches, first-class changes, undo/history, effects, capabilities, range analysis, provenance, source calculi, procedure-call substitution, arithmetic expression evaluation, structured execution traces, guard semantics, refinement relations, execution witnesses, translation validation, proof-carrying evidence, verified checkers, interprocedural effect summaries, ranked/well-founded call graphs, finite transitive call trees, WebAssembly/C generation or GUI packaging. All have substantial prior art.

The research hypothesis remains centered on two linked ideas:

> **State-Change Factorization:** ordinary post-creation persistent mutation is forced through a structured semantic Change representation rather than ordinary assignment plus later logging.

> **Semantic Change Contracts:** Patch derives operation- and magnitude-aware summaries and authority policies from that same mandatory mutation substrate.

**Beta.30 mechanically checks finite transitive exact call-tree traces for a conservative safe-integer/rank-decreasing fragment. This is supporting assurance, not a new novelty headline.**

## Prior-art discipline

Patch must continue to compare against Plaid/first-class state change, Worlds/scoped state, classical/graded/quantitative/refinement effect systems, capability/permission/typestate work, abstract interpretation, interprocedural effect analysis, procedure-call operational semantics/substitution, structured operational semantics, call-graph analyses, well-founded/ranked restrictions, translation validation, Proof-Carrying Code/certifying compilation, verified compiler/refinement/simulation work, ChEOPS/COPE/Edit Transactions, event sourcing, edit lenses, patch theory, reversible languages, CRDTs and provenance/Whyline-style debugging.

Do not claim invention of effect inference, quantitative effects, concrete parameter binding, arithmetic substitution, structured trace semantics, guard evaluation, branch semantics, transitive call semantics, interprocedural effect composition, effect refinement, call-graph ranking, runtime path witnesses, translation validation, refinement checking or proof-carrying evidence.

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
concreteThroughAbstractBool_sound
evalBoundQuantitativeEffect_sound
checkedConcreteBoundEffectRefinesCallerSignature
evalBoundStmt_sound
effectListEqBool_sound
evalBoundStmtEqBool_sound
boundBodyCoveredBool_sound
boundExecRefinesSignature
checkedEvaluatedBoundBodyRefinesSignature
checkedConcreteCallBodyRefinesCallerSignature
evalCallTreeStmt_sound
callTreeCoveredBool_sound
callTreeExecRefinesSignature
evalCallTreeStmtEqBool_sound
checkedEvaluatedCallTreeRefinesSignature
checkedConcreteTransitiveCallTreeRefinesCallerSignature
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

For beta.26/27 direct quantitative leaf calls:

```text
exact caller RangeExpr evaluation
+ exact positional callee binding
+ concrete value through abstract/declaration intervals
+ exact bound quantitative RangeExpr effect
+ beta.25 callee → caller signature containment
------------------------------------------------
concrete effect refines an effect in caller semantic signature
```

For beta.28/29 structured guarded bodies:

```text
exact caller → callee binding
+ Lean-evaluated direct quantitative emits
+ sequence/static-repeat execution
+ formal GuardExpr evaluated under exact envOfBindings
+ exact selected-trace equality check
+ static callee-signature coverage for all supported arms
+ callee → caller SignatureCovers
------------------------------------------------
selected concrete callee trace refines caller semantic signature
```

For beta.30 finite transitive call trees:

```text
exact outer binding
+ concrete values through beta.25 abstract intervals
+ strict outer rank decrease
+ recursive exact nested RangeExpr binding
+ strict rank decrease at every nested edge
+ exact GuardExpr/static-repeat/direct-effect execution
+ nested body coverage by nested callee signature
+ edge-by-edge SignatureCovers import
+ exact complete selected transitive trace equality
------------------------------------------------
finite selected transitive trace refines caller semantic signature
```

## Beta.23–29 supporting assurance

Beta.23 checks proof-free direct-runtime branch witnesses against normalized safe-integer guards and Change Capabilities. Beta.25 adds finite abstract call-aware signature composition. Beta.26 adds exact concrete inter-recipe binding and direct leaf-effect refinement. Beta.27 carries the already-mechanized integer `RangeExpr` grammar through the production certificate boundary.

Beta.28 reconstructs complete exact sequence/static-repeat callee traces. Beta.29 extends the same `BoundStmt` semantics with formal `GuardExpr` branch selection under exact recipe-parameter bindings while requiring both branch arms to remain statically represented by the callee signature.

These layers strengthen the implementation/formal connection but remain explicit fragments rather than end-to-end compiler verification.

## Beta.30 finite transitive exact call trees

Beta.30 adds a recursive assurance layer without flattening nested effects in the JavaScript producer.

The production artifact preserves a tree such as:

```text
caller -> outer -> middle -> leaf
```

`PatchCallTree.lean` independently re-evaluates every nested formal argument, constructs each new exact `BindingList`, checks strict rank decrease, evaluates selected guarded/static-repeat/direct-effect subtrees and checks each nested body against its own callee semantic signature before importing the trace one signature edge at a time.

For the focused depth-2 example, Lean checks the exact selected transitive trace:

```text
score increase [4,4]
coins increase [3,3]
```

The generated certificate also exports strict rank decrease for the outer certified edge and concrete-to-beta.25-abstract interval fit for its arguments.

This closes the nested/transitive exact-trace gap in beta.29 for the supported finite fragment. It is **not** evidence that Patch invented transitive procedure semantics, well-founded call graphs, interprocedural effect analysis or proof-carrying call traces.

### Exact beta.30 boundary

Supported:

- finite acyclic/rank-decreasing beta.25 recipe environments;
- bounded safe-integer inter-recipe arguments from the established `RangeExpr` fragment;
- exact outer and nested positional binding;
- strict outer and nested rank checks;
- direct quantitative `add`/`remove` emits;
- sequence;
- literal/static repeat;
- formal Boolean/comparison guards over exact recipe parameters;
- exact selected branch paths;
- exact complete finite selected transitive trace;
- nested callee-signature coverage and edge-by-edge caller-signature import.

Still excluded:

- root-program concrete call certification;
- recursion/cycles;
- dynamic repeats;
- persistent-state exact guard variables;
- returns;
- arbitrary state-dependent amounts/guards outside the formal fragments;
- floating-point call semantics;
- production JavaScript/direct-Wasm call equivalence;
- full compiler verification.

Unsupported cases fail instead of being flattened into stronger claims.

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
- exact structured and guard-aware selected callee traces;
- **finite transitive exact selected call-tree traces with mechanical rank checks**;
- production-generated Lean certificates;
- independent runtime transition/effect validation;
- C99/FreeBSD and Window artifacts;
- provenance/undo/preview/replay tooling.

## Candidate beta.30 paper claim

A defensible working claim is:

> We present Patch, an experimental language in which post-creation persistent mutation is factored through structured semantic Changes and operation-/magnitude-aware Semantic Change Contracts are derived from that mandatory mutation substrate. For mechanized fragments we prove Change Signature Soundness, semantic policy containment and integer range-analysis soundness. For finite acyclic recipe environments, Lean checks abstract argument-interval and semantic-signature composition. Generated proof-free concrete call evidence is re-evaluated for exact safe-integer binding, guarded structured callee traces and finite transitive nested call trees. For the beta.30 call-tree fragment, Lean checks strict rank decrease, recursively reconstructs nested bindings, evaluates the complete selected trace and imports nested semantic signatures edge by edge into the caller signature. These results do not establish production-Wasm call equivalence, root-program certification, recursive/full floating-point semantics or full compiler verification.

This is a contribution hypothesis, not a firstness assertion.

## High-venue path

Highest-value next work:

1. retain State-Change Factorization + quantitative semantic authority as the primary claim;
2. connect beta.30 exact transitive call trees to **observed direct-Wasm call execution**;
3. build semantic-security/plugin cases where bounded semantic authority matters;
4. measure analysis/validation/certificate/checker/backend overhead;
5. complete systematic related-work and reproducibility passes.

Patch remains plausible as an OOPSLA/ECOOP-style direction, but is not yet submission-ready. The next gains should come from production-runtime correspondence and evaluation rather than unrelated feature accumulation.
