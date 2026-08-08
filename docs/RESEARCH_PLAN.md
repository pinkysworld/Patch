# Research and Evaluation Plan

Patch should not be submitted to a high venue until the formal claim, executable artifact and evaluation line up. Beta 4 proved Change Signature Soundness for a structured Lean core. Beta 5 introduced production-to-formal translation validation. **Beta 6 adds a small executable Lean checker whose successful policy decisions are machine-checked to imply runtime policy containment for the formal core.**

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

This end-to-end chain is machine checked for the formal structured core.

Beta 6 additionally implements an executable Lean policy checker and proves:

```text
checkProtected(stmt, policy) = true
=> PolicyAllows(inferSignature(stmt), policy)
```

so an actual checker result, not merely an assumed relational premise, is sufficient to derive runtime policy containment for formal executions.

Security cases should include bounded rewards, balances, inventory operations, UI handlers, plugin-like modules and nested helpers.

## RQ4: Verified checker / production boundary

Beta 6 changes this from a planned architecture into an implemented research artifact.

Current pipeline:

```text
Patch source
   -> production JavaScript parser/analyzer
   -> formal bridge CoreStmt + policy
   -> generated Lean certificate
   -> verified PatchChecker
   -> formal policy-containment theorem
```

`patch certify` emits a source-bound Lean artifact for bridge-supported protected recipes. Formal CI generates that artifact using the production compiler, explicitly compiles all Lean proof modules, and then compiles the generated certificate.

The remaining critical trust gap is **translation correctness**:

> Does the JavaScript bridge-generated `CoreStmt` faithfully represent the semantics of the supported Patch source/Change IR?

Candidate routes:

1. formalize a stable semantic evidence schema and prove a decoder/checker over it;
2. prove correspondence between supported Change IR and `CoreStmt`;
3. generate both semantic evidence and dynamic traces and validate them against formal execution;
4. eventually move the small bridge encoder into a more readily verified component if necessary.

The whole JavaScript compiler need not be verified if a sufficiently small, auditable boundary can be justified.

## RQ5: Range-analysis soundness and precision

Patch supports ranged parameters such as:

```patch
make reward(player, bonus number 0..10):
```

and interval propagation through a small arithmetic fragment.

Formal target:

> If the analyzer returns interval `I` for expression `e` under range environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies in `I`.

Beta 6's verified checker proves its **own** interval-containment decision is sound. It does not yet prove the production expression analyzer's inferred interval is correct. That distinction must remain explicit.

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

At least one case study must fit entirely inside the beta-6 certifiable subset so the formal theorem, generated certificate and practical example form one reproducible path.

## RQ9: Certificate and checker cost

Measure separately:

- certificate generation time and size;
- Lean checker/build time;
- size of the checker trusted code/proof base;
- effect of number of changes, branches, repetition and policy rules;
- incremental/cached verification opportunities.

The goal is not to outperform conventional compilation. It is to show that stronger semantic assurance is practical for useful program components.

## RQ10: Expressiveness and infrastructure reduction

Implement representative programs in Patch and conventional baselines. Measure source size and extra infrastructure required for history, undo, preview, semantic auditing, capability enforcement and provenance.

Do not let this become a feature-count contest. The paper should center the formal mutation-contract contribution.

## RQ11: Comparison to prior systems

Systematically compare against:

- Plaid and typestate/state-transition languages;
- Worlds and reified program-state systems;
- classical type-and-effect systems;
- graded/quantitative/refinement effects;
- Effects as Capabilities/Effekt;
- object-capability, permission and refinement systems;
- range/abstract-interpretation systems;
- translation validation and certifying compilers;
- Proof-Carrying Code and small proof-checker architectures;
- provenance and why-oriented debugging;
- ChEOPS/COPE/Edit Transactions;
- edit lenses/change structures/patch theory;
- event sourcing, reversible programming and CRDTs.

The goal is to falsify overbroad novelty claims before reviewers do.

## RQ12: Runtime and compiler performance

Separate:

1. change construction/history overhead;
2. Change Signature + range + production capability analysis cost;
3. formal-bridge cost;
4. certificate generation/checking cost;
5. JavaScript interpreter performance;
6. future direct Change IR-to-Wasm performance;
7. native host packaging overhead.

## RQ13: Novice comprehension

If accessibility remains part of the paper, preregister a controlled study comparing Patch with conventional mutable syntax. Keep advanced capability/formal questions separate from the basic state-mutation comparison.

## RQ14: Cross-platform artifact

Evaluate the same language/Change IR across browser/PWA, Windows/macOS/Linux CI, portable `.patchapp`, direct Wasm when available, and at least one native GUI host before making a systems-heavy portability claim.

## Current milestone: 0.2.0-beta.6

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
- production-to-formal translation-validation bridge;
- `patch formal` coverage reporting;
- automatic compiler failure on supported production/formal signature mismatch;
- **Lean-verified executable semantic policy checker**;
- **`patch certify` generated Lean certificates** for protected bridge-supported recipes;
- formal CI that generates a certificate from production source, explicitly builds all Lean modules, and verifies the generated certificate;
- formal bridge evidence embedded in Change IR / portable artifacts;
- Patch Studio/PWA, GUI preview/Designer, `.patchapp`, bootstrap Wasm;
- Windows/macOS/Linux JavaScript CI.

## Next formal milestone

1. prove or verify the source/Change-IR-to-`CoreStmt` translation boundary for a useful subset;
2. formalize the ranged expression fragment and prove interval analyzer soundness;
3. extend the bridge/certifier to non-recursive recipe calls and parameter substitution;
4. connect production execution traces to formal `Executes` traces;
5. derive a stronger source-level end-to-end capability theorem;
6. then move to inverse/replay/commutation proofs.

## Paper strategy

Primary claim:

> Persistent mutation is forced through a semantic Change IR, and operation-/magnitude-aware semantic Change Contracts derived from that same representation can be proved to constrain runtime semantic changes. For a conservative production subset, semantic evidence is translation-validated and accepted by a small Lean-verified policy checker.

Supporting claims:

- the surface syntax can remain small;
- the same Change IR supports undo/history/provenance/preview;
- quantitative policies can prevent useful classes of state-update bugs;
- the model can support console/GUI artifacts without exposing platform complexity.

Avoid making GUI, undo, `why`, Wasm, certificates, or mobile IDE support the novelty headline. Certificates are assurance machinery, not the semantic novelty.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level attempt, require:

1. systematic related-work review;
2. stronger source/IR-to-formal correspondence for a useful subset;
3. mechanized production interval-analysis soundness if magnitude-aware contracts remain central;
4. direct compiled execution;
5. two or three convincing security/engineering case studies, with at least one inside the certified subset;
6. benchmark and certificate-overhead evidence;
7. a reproducible artifact;
8. no unsupported firstness claims;
9. controlled user evidence only if novice simplicity remains a headline empirical claim.
