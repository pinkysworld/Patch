# Research and Evaluation Plan

Patch should not be submitted to a high venue until the formal claim, executable artifact and evaluation line up. Beta 3 has crossed an important milestone by adding a real Lean 4 core, but the production compiler is not yet formally verified.

## Central question

Can a low-complexity general-purpose language make semantic change the exclusive route for persistent mutation, infer the semantic changes a component may produce, constrain them with operation-aware capabilities, and reuse the same representation for explanation/tooling without making ordinary programming harder?

## RQ1: State-Change Factorization

Formal target:

```text
persistent state transition S -> S'
=> exists delta such that apply(delta, S) = S'
and the transition commits through delta
```

Beta 3 now mechanizes this property for the small Lean machine model. Next, prove a correspondence result for a useful executable Patch core.

## RQ2: Change Signature soundness

Target:

```text
RuntimeChanges(f) subset-of Signature(f)
```

The executable compiler already infers direct and simple transitive effects. The next mechanized model must include recipes/calls and prove that no supported runtime change is omitted.

Measure both soundness failures and conservative over-approximation.

## RQ3: Change Capability soundness

Target:

```text
Signature(f) subset-of Capability(f)
```

combined with RQ2 gives:

```text
RuntimeChanges(f) subset-of Capability(f)
```

Beta 3's Lean model proves the composition step once signature coverage is assumed. The production checker still needs formal correspondence.

Security cases should include bounded rewards, balances, inventory operations, UI handlers, plugin-like modules and nested helpers.

## RQ4: Range-analysis soundness and precision

Beta 3 supports ranged parameters such as:

```patch
make reward(player, bonus number 0..10):
```

and interval propagation through a small arithmetic fragment.

Formal target:

> If the analyzer returns interval `I` for expression `e` under range environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies in `I`.

Evaluate how many safe bounded programs become provable, how many remain conservatively rejected, and analysis cost.

## RQ5: Provenance and `why`

Patch now records source, recipe and GUI-event context on committed changes. Evaluate:

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

## RQ7: Expressiveness and infrastructure reduction

Implement at least 50 representative programs in Patch and conventional baselines. Measure source size and extra infrastructure required for history, undo, preview, semantic auditing, capability enforcement and provenance.

## RQ8: Comparison to prior systems

Systematically compare against:

- Plaid and typestate/state-transition languages;
- Worlds and reified program-state systems;
- classical type-and-effect systems;
- Effects as Capabilities/Effekt;
- object-capability, permission and refinement systems;
- range/abstract-interpretation systems;
- provenance and why-oriented debugging;
- ChEOPS/COPE/Edit Transactions;
- edit lenses/change structures/patch theory;
- event sourcing, reversible programming and CRDTs.

The goal is to falsify overbroad novelty claims before reviewers do.

## RQ9: Performance

Separate:

1. change construction/history overhead;
2. Change Signature + range + capability analysis cost;
3. JavaScript interpreter performance;
4. future direct Change IR-to-Wasm performance;
5. native host packaging overhead.

## RQ10: Novice comprehension

If accessibility remains part of the paper, preregister a controlled study comparing Patch with conventional mutable syntax. Keep advanced capability questions separate from the basic state-mutation comparison.

Measure correctness, completion time, edit/error count, confidence and cognitive load.

## RQ11: Cross-platform artifact

Evaluate the same language/Change IR across browser/PWA, Windows/macOS/Linux CI, portable `.patchapp`, direct Wasm when available, and at least one native GUI host before making a systems-heavy portability claim.

## Current milestone: 0.2.0-beta.3

Implemented:

- Change IR and semantic change runtime;
- Semantic Change Signatures and Change Capabilities;
- ranged parameters and interval analysis;
- runtime range guards;
- causal provenance and initial `why` queries;
- Lean 4 formal project;
- machine-checked factorization, Mutation Transparency, interval containment and contract-composition results;
- Patch Studio/PWA, GUI preview/Designer, `.patchapp`, bootstrap Wasm;
- Windows/macOS/Linux CI and dedicated formal-verification CI.

## Next formal milestone

1. formalize the ranged expression fragment in Lean;
2. prove interval analyzer soundness;
3. formalize recipes and simple calls;
4. prove executable Change Signature soundness for a non-recursive core;
5. derive end-to-end Change Capability soundness;
6. establish compiler-to-formal correspondence or a small verified checker boundary.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level attempt, require:

1. systematic related-work review;
2. meaningful executable/formal correspondence, not only an abstract toy theorem;
3. direct compiled execution;
4. benchmark/security evidence;
5. a reproducible artifact;
6. no unsupported firstness claims;
7. controlled user evidence if novice simplicity remains a headline claim.
