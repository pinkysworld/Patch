# Research and Evaluation Plan

Patch should not be submitted to a high venue until the formal claim, executable artifact and evaluation line up. Beta 4 closed the abstract Change Signature Soundness gap for a structured Lean core. Beta 5 begins the next gap: connecting the production compiler to that model with a conservative, reproducible validation boundary.

## Central question

Can a low-complexity general-purpose language make semantic change the exclusive route for persistent mutation, infer the semantic changes a component may produce, constrain them with operation- and magnitude-aware capabilities, and connect those guarantees to a real implementation without making ordinary programming harder?

## RQ1: State-Change Factorization

Formal target:

```text
persistent state transition S -> S'
=> exists delta such that apply(delta, S) = S'
and the transition commits through delta
```

This property is machine checked for the current Lean machine model. Production work must relate Change IR commits and runtime execution to the same formal witness.

## RQ2: Change Signature Soundness

Target:

```text
RuntimeChanges(f) subset-of Signature(f)
```

Beta 4 proves this for a structured formal core with sequencing, branch choice and bounded repetition.

Beta 5 adds a production-to-formal validation bridge. For a conservative supported subset, the real AST is independently translated into a Lean-like `CoreStmt` representation and a second signature is reconstructed. That signature is compared to the production analyzer's Change Signature; a supported mismatch is a compiler error.

This is useful correspondence evidence but not yet a machine-checked JavaScript-to-Lean theorem because both translation paths currently execute in JavaScript.

Measure:

- percentage of production corpus entries inside the bridge subset;
- signature agreement/mismatch rate;
- conservative over-approximation;
- unsupported reasons by language construct;
- false confidence risk, which must remain zero by never labeling unsupported code as covered.

## RQ3: Change Capability Soundness

Target:

```text
RuntimeChanges(f) subset-of Signature(f)
Signature(f) admitted-by Capability(f)
----------------------------------------
RuntimeChanges(f) admitted-by Capability(f)
```

This end-to-end chain is machine checked for the formal structured core. Beta 5 carries formal bridge evidence inside production Change IR, `.patchapp`, and bootstrap Wasm payloads, but the production checker still requires a mechanized correspondence/checker boundary before its soundness can inherit the Lean theorem.

Security cases should include bounded rewards, balances, inventory operations, UI handlers, plugin-like modules and nested helpers.

## RQ4: Verified bridge / translation validation

This is now a dedicated research question rather than a vague implementation task.

Current beta-5 bridge:

```text
production AST -> independently reconstructed CoreStmt/signature
production AST -> production Change Signature
                         |
                         v
                      compare
```

Next target:

> A small verified checker, or equivalent mechanized validation relation, accepts production semantic evidence only when it corresponds to the Lean effect/signature model.

Candidate route:

1. define a stable JSON evidence schema for normalized effects and control flow;
2. write a very small checker corresponding closely to Lean definitions;
3. prove/check the checker against Lean;
4. make compiler output pass through that checker in CI and release builds;
5. extend coverage incrementally.

This may be more tractable and auditable than attempting to verify the entire JavaScript compiler.

## RQ5: Range-analysis soundness and precision

Patch supports ranged parameters such as:

```patch
make reward(player, bonus number 0..10):
```

and interval propagation through a small arithmetic fragment.

Formal target:

> If the analyzer returns interval `I` for expression `e` under range environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies in `I`.

Evaluate how many safe bounded programs become provable, how many remain conservatively rejected, and analysis cost.

## RQ6: Provenance and `why`

Patch records source, recipe and GUI-event context on committed changes. Evaluate:

- whether `why value` identifies the useful change chain;
- whether `why predicate` identifies the first recorded false-to-true transition;
- how much explicit logging/instrumentation conventional baselines need;
- where historical provenance is insufficient for counterfactual causation.

Do not market history replay as general causal inference.

## RQ7: Derived change laws

Establish/prove/test:

- Mutation Transparency;
- inverse correctness;
- preview non-interference and preview/commit agreement;
- deterministic replay consistency;
- composition laws;
- commutation/conflict soundness.

These support the core result but should not replace the primary paper claim.

## RQ8: Killer security/engineering cases

Build two or three examples where operation- or magnitude-sensitive authority is visibly useful and a conventional implementation needs explicit validation/plumbing. Candidate cases:

- plugin reward API: may increase score by at most a bounded amount but may never replace/decrease it;
- wallet/account logic: may debit within a declared bound but may never arbitrarily overwrite a balance;
- GUI/game extension: a handler may modify only specific state paths and semantic operations.

Measure prevented policy violations, annotations, validation code, logging/audit code and runtime overhead.

At least one case study should fit entirely inside the verified/validated subset so the formal claim and practical example are connected.

## RQ9: Expressiveness and infrastructure reduction

Implement representative programs in Patch and conventional baselines. Measure source size and extra infrastructure required for history, undo, preview, semantic auditing, capability enforcement and provenance.

Do not let this become a feature-count contest. The paper should center the formal mutation-contract contribution.

## RQ10: Comparison to prior systems

Systematically compare against:

- Plaid and typestate/state-transition languages;
- Worlds and reified program-state systems;
- classical type-and-effect systems;
- graded/quantitative/refinement effects;
- Effects as Capabilities/Effekt;
- object-capability, permission and refinement systems;
- range/abstract-interpretation systems;
- translation-validation / verified-checker approaches;
- provenance and why-oriented debugging;
- ChEOPS/COPE/Edit Transactions;
- edit lenses/change structures/patch theory;
- event sourcing, reversible programming and CRDTs.

The goal is to falsify overbroad novelty claims before reviewers do.

## RQ11: Performance

Separate:

1. change construction/history overhead;
2. Change Signature + range + capability analysis cost;
3. formal-bridge / verification cost;
4. JavaScript interpreter performance;
5. future direct Change IR-to-Wasm performance;
6. native host packaging overhead.

## RQ12: Novice comprehension

If accessibility remains part of the paper, preregister a controlled study comparing Patch with conventional mutable syntax. Keep advanced capability/formal questions separate from the basic state-mutation comparison.

## RQ13: Cross-platform artifact

Evaluate the same language/Change IR across browser/PWA, Windows/macOS/Linux CI, portable `.patchapp`, direct Wasm when available, and at least one native GUI host before making a systems-heavy portability claim.

## Current milestone: 0.2.0-beta.5

Implemented:

- Change IR and semantic change runtime;
- Semantic Change Signatures and Change Capabilities;
- ranged parameters and interval analysis;
- runtime range guards;
- causal provenance and initial `why` queries;
- Lean 4 formal project;
- machine-checked State-Change Factorization and Mutation Transparency;
- machine-checked Change Signature Soundness for the structured formal core;
- machine-checked end-to-end capability containment for that formal core;
- first production-to-formal translation-validation artifact;
- `patch formal` coverage reporting;
- automatic compiler failure on supported production/formal signature mismatch;
- formal bridge evidence embedded in Change IR / portable artifacts;
- Patch Studio/PWA, GUI preview/Designer, `.patchapp`, bootstrap Wasm;
- Windows/macOS/Linux CI and dedicated formal-verification CI.

## Next formal milestone

1. stabilize the formal evidence schema;
2. implement a small Lean-related verified checker or equivalent mechanized validator;
3. extend the bridge to non-recursive recipe calls and parameter substitution;
4. formalize the ranged expression fragment and prove interval analyzer soundness;
5. connect production execution traces to formal `Executes` traces;
6. derive end-to-end production capability soundness for the validated subset;
7. then move to inverse/replay/commutation proofs.

## Paper strategy

Primary claim:

> Persistent mutation is forced through a semantic Change IR, and operation-/magnitude-aware semantic Change Contracts inferred from that same representation can be proved to constrain runtime semantic changes. A conservative production validation boundary makes the implementation-to-proof gap explicit and progressively checkable.

Supporting claims:

- the surface syntax can remain small;
- the same Change IR supports undo/history/provenance/preview;
- quantitative policies can prevent useful classes of state-update bugs;
- the model can support console/GUI artifacts without exposing platform complexity.

Avoid making GUI, undo, `why`, Wasm or mobile IDE support the novelty headline.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level attempt, require:

1. systematic related-work review;
2. meaningful machine-checked production/formal correspondence or verified-checker boundary for a useful subset;
3. direct compiled execution;
4. two or three convincing security/engineering case studies, with at least one inside the validated subset;
5. benchmark evidence;
6. a reproducible artifact;
7. no unsupported firstness claims;
8. controlled user evidence only if novice simplicity remains a headline empirical claim.
