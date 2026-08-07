# Research and Evaluation Plan

Patch should not be submitted to a high venue until the formal claim, executable artifact and evaluation line up. Beta 4 closes an important theorem gap by proving Change Signature Soundness and end-to-end capability containment for a structured Lean core. The production JavaScript compiler is still not formally verified.

## Central question

Can a low-complexity general-purpose language make semantic change the exclusive route for persistent mutation, infer the semantic changes a component may produce, constrain them with operation- and magnitude-aware capabilities, and reuse the same representation for explanation/tooling without making ordinary programming harder?

## RQ1: State-Change Factorization

Formal target:

```text
persistent state transition S -> S'
=> exists delta such that apply(delta, S) = S'
and the transition commits through delta
```

This property is machine checked for the current Lean machine model. Next, relate production Change IR commits to the formal change witness.

## RQ2: Change Signature Soundness

Target:

```text
RuntimeChanges(f) subset-of Signature(f)
```

Beta 4 proves this for a structured formal core with sequencing, branch choice and bounded repetition. Static branch signatures over-approximate untaken alternatives but cannot omit an emitted runtime effect.

The next step is **production correspondence**: prove that the JavaScript analyzer/lowering for a useful Patch subset implements the formal effect vocabulary and signature judgments, or validate its output with a small verified checker.

Measure both missed effects and conservative over-approximation.

## RQ3: Change Capability Soundness

Target:

```text
RuntimeChanges(f) subset-of Signature(f)
Signature(f) admitted-by Capability(f)
----------------------------------------
RuntimeChanges(f) admitted-by Capability(f)
```

This end-to-end chain is now machine checked for the formal structured core. The production checker still needs correspondence to that model.

Security cases should include bounded rewards, balances, inventory operations, UI handlers, plugin-like modules and nested helpers.

## RQ4: Range-analysis soundness and precision

Patch supports ranged parameters such as:

```patch
make reward(player, bonus number 0..10):
```

and interval propagation through a small arithmetic fragment.

Formal target:

> If the analyzer returns interval `I` for expression `e` under range environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies in `I`.

Evaluate how many safe bounded programs become provable, how many remain conservatively rejected, and analysis cost.

## RQ5: Provenance and `why`

Patch records source, recipe and GUI-event context on committed changes. Evaluate:

- whether `why value` identifies the useful change chain;
- whether `why predicate` identifies the first recorded false-to-true transition;
- how much explicit logging/instrumentation JavaScript/Python baselines need;
- where historical provenance is insufficient for true counterfactual causation.

Do not market history replay as general causal inference.

## RQ6: Derived change laws

Establish/prove/test:

- Mutation Transparency;
- inverse correctness;
- preview non-interference and preview/commit agreement;
- deterministic replay consistency;
- composition laws;
- commutation/conflict soundness.

These support the core result but should not replace the primary paper claim.

## RQ7: Killer security/engineering cases

Build two or three examples where operation- or magnitude-sensitive authority is visibly useful and a conventional implementation needs explicit validation/plumbing. Candidate cases:

- plugin reward API: may increase score by at most a bounded amount but may never replace/decrease it;
- wallet/account logic: may debit within a declared bound but may never arbitrarily overwrite a balance;
- GUI/game extension: a handler may modify only specific state paths and semantic operations.

Measure prevented policy violations, annotations, validation code, logging/audit code and runtime overhead.

## RQ8: Expressiveness and infrastructure reduction

Implement representative programs in Patch and conventional baselines. Measure source size and extra infrastructure required for history, undo, preview, semantic auditing, capability enforcement and provenance.

Do not let this become a feature-count contest. The paper should center the formal mutation-contract contribution.

## RQ9: Comparison to prior systems

Systematically compare against:

- Plaid and typestate/state-transition languages;
- Worlds and reified program-state systems;
- classical type-and-effect systems;
- graded/quantitative/refinement effects;
- Effects as Capabilities/Effekt;
- object-capability, permission and refinement systems;
- range/abstract-interpretation systems;
- provenance and why-oriented debugging;
- ChEOPS/COPE/Edit Transactions;
- edit lenses/change structures/patch theory;
- event sourcing, reversible programming and CRDTs.

The goal is to falsify overbroad novelty claims before reviewers do.

## RQ10: Performance

Separate:

1. change construction/history overhead;
2. Change Signature + range + capability analysis cost;
3. JavaScript interpreter performance;
4. future direct Change IR-to-Wasm performance;
5. native host packaging overhead.

## RQ11: Novice comprehension

If accessibility remains part of the paper, preregister a controlled study comparing Patch with conventional mutable syntax. Keep advanced capability questions separate from the basic state-mutation comparison.

Measure correctness, completion time, edit/error count, confidence and cognitive load.

## RQ12: Cross-platform artifact

Evaluate the same language/Change IR across browser/PWA, Windows/macOS/Linux CI, portable `.patchapp`, direct Wasm when available, and at least one native GUI host before making a systems-heavy portability claim.

## Current milestone: 0.2.0-beta.4

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
- Patch Studio/PWA, GUI preview/Designer, `.patchapp`, bootstrap Wasm;
- Windows/macOS/Linux CI and dedicated formal-verification CI.

## Next formal milestone

1. define a formal correspondence between production Change IR effects and Lean `Effect` values;
2. produce a machine-readable compiler conformance corpus;
3. formalize the ranged expression fragment and prove interval analyzer soundness;
4. formalize non-recursive recipes/simple calls and parameter substitution;
5. prove analyzer correspondence for that executable fragment;
6. extend end-to-end capability soundness across the compiler boundary;
7. then move to inverse/replay/commutation proofs.

## Paper strategy

Primary claim:

> Persistent mutation is forced through a semantic Change IR, and operation-/magnitude-aware semantic Change Contracts inferred from that same representation can be proved to constrain runtime semantic changes.

Supporting claims:

- the surface syntax can remain small;
- the same Change IR supports undo/history/provenance/preview;
- quantitative policies can prevent useful classes of state-update bugs;
- the model can support console/GUI artifacts without exposing platform complexity.

Avoid making GUI, undo, `why`, Wasm or mobile IDE support the novelty headline.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level attempt, require:

1. systematic related-work review;
2. meaningful production/formal correspondence or verified-checker boundary;
3. direct compiled execution;
4. two or three convincing security/engineering case studies;
5. benchmark evidence;
6. a reproducible artifact;
7. no unsupported firstness claims;
8. controlled user evidence only if novice simplicity remains a headline empirical claim.
