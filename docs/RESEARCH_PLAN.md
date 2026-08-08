# Research and Evaluation Plan

Patch should not be submitted to a high venue until the formal claim, executable artifact and evaluation line up. Beta 4 proved Change Signature Soundness for a structured Lean core. Beta 5 introduced production-to-formal translation validation. Beta 6 added an executable Lean policy checker. **Beta 7 adds a proof-free production evidence schema that Lean validates, decodes to `CoreStmt`, and machine-checks against a separately emitted production Change Signature claim.**

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

Beta 5 added a conservative JavaScript production-to-formal bridge. Beta 7 now gives that boundary a machine-checked consumer side: Lean decodes proof-free production evidence into the formal core and independently reconstructs the canonical Change Signature.

Measure:

- percentage of production corpus entries inside the bridge/evidence subset;
- evidence decode success/failure rate;
- production-claim/formal-signature agreement rate;
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

Beta 6 proves executable checker soundness:

```text
checkProtected(stmt, policy) = true
=> PolicyAllows(inferSignature(stmt), policy)
```

Beta 7 lifts this to proof-free evidence:

```text
decodeEvidenceStmt(evidence) = some stmt
checkEvidenceProtected(evidence, policy) = true
Executes(stmt, runtime)
------------------------------------------------
every runtime effect is allowed by policy
```

Security cases should include bounded rewards, balances, inventory operations, UI handlers, plugin-like modules and nested helpers.

## RQ4: Production evidence correspondence

This is now the central implementation/formal research question.

Current beta-7 pipeline:

```text
Patch source
   -> production JavaScript parser/analyzer
   -> proof-free EvidenceStmt
   -> separate production Change Signature claim
   -> declared semantic policy
   -> Lean evidence decoder
   -> CoreStmt
   -> formal inferSignature
   -> signature-correspondence check
   -> verified policy check
   -> formal runtime policy-containment theorem
```

`patch certify` emits a source-bound Lean artifact for bridge-supported protected recipes. Formal CI generates that artifact using the production compiler, explicitly compiles all four Lean proof modules, and then compiles the generated certificate.

The remaining critical trust gap is now narrower:

> Does the JavaScript parser/bridge extract the correct proof-free `EvidenceStmt`, production signature claim and policy from the supported Patch source/AST?

Next candidate routes:

1. define a compact formal source/AST fragment and an evidence-extraction relation in Lean;
2. prove that the intended lowering of each supported source construct yields the corresponding `EvidenceStmt`;
3. compare production-emitted evidence with a second small independent extractor or validated serialized schema;
4. connect production execution traces to decoded formal `Executes` traces.

The whole JavaScript compiler need not be verified if the remaining extraction boundary becomes sufficiently small, explicit and auditable.

## RQ5: Range-analysis soundness and precision

Patch supports ranged parameters such as:

```patch
make reward(player, bonus number 0..10):
```

and interval propagation through a small arithmetic fragment.

Formal target:

> If the production analyzer returns interval `I` for expression `e` under range environment `Gamma`, every supported evaluation of `e` satisfying `Gamma` lies in `I`.

Beta 7 validates the emitted raw interval's internal ordering and the policy containment relation, but it still does not prove that the JavaScript expression analyzer computed a sound interval. That distinction must remain explicit.

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

At least one case study must fit entirely inside the beta-7 evidence-certified subset so the production artifact, machine-checked evidence/signature correspondence, policy theorem and practical example form one reproducible path.

## RQ9: Evidence, certificate and checker cost

Measure separately:

- proof-free evidence size;
- certificate generation time and size;
- Lean evidence decode/signature-check time;
- Lean policy-check/build time;
- size of the verified checker/evidence trusted code and proof base;
- effect of number of changes, branches, repetition and policy rules;
- incremental/cached verification opportunities.

The goal is not to outperform ordinary compilation. It is to show that stronger semantic assurance is practical for useful components.

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
- validated/certified intermediate representations and proof-producing analyses;
- provenance and why-oriented debugging;
- ChEOPS/COPE/Edit Transactions;
- edit lenses/change structures/patch theory;
- event sourcing, reversible programming and CRDTs.

The goal is to falsify overbroad novelty claims before reviewers do.

## RQ12: Runtime and compiler performance

Separate:

1. change construction/history overhead;
2. Change Signature + range + production capability analysis cost;
3. formal-bridge/evidence extraction cost;
4. evidence/signature and certificate checking cost;
5. JavaScript interpreter performance;
6. future direct Change IR-to-Wasm performance;
7. native host packaging overhead.

## RQ13: Novice comprehension

If accessibility remains part of the paper, preregister a controlled study comparing Patch with conventional mutable syntax. Keep advanced capability/formal questions separate from the basic state-mutation comparison.

## RQ14: Cross-platform artifact

Evaluate the same language/Change IR across browser/PWA, Windows/macOS/Linux CI, portable `.patchapp`, direct Wasm when available, and at least one native GUI host before making a systems-heavy portability claim.

## Current milestone: 0.2.0-beta.7

Implemented:

- Change IR and semantic change runtime;
- Semantic Change Signatures and Change Capabilities;
- ranged parameters and interval analysis;
- runtime range guards;
- causal provenance and initial `why` queries;
- machine-checked State-Change Factorization and Mutation Transparency;
- machine-checked Change Signature Soundness for the structured formal core;
- machine-checked end-to-end capability containment for that formal core;
- production-to-formal translation-validation bridge;
- `patch formal` coverage reporting;
- Lean-verified executable semantic policy checker;
- **proof-free `EvidenceStmt` / `EvidenceEffect` schema**;
- **Lean validation and decoding of production evidence to `CoreStmt`**;
- **machine-checked evidence/formal-signature correspondence via `checkedEvidenceSignatureCorresponds`**;
- **evidence-level runtime policy theorem via `checkedEvidenceExecutionCannotEscape`**;
- `patch certify` certificates containing evidence, a separate production signature claim and policy;
- formal CI that generates a certificate from production source, builds all four Lean modules, and verifies the generated certificate;
- Patch Studio/PWA, GUI preview/Designer, `.patchapp`, bootstrap Wasm;
- Windows/macOS/Linux JavaScript CI.

## Next formal milestone

1. formalize a small supported Patch source/AST fragment and prove its extraction to `EvidenceStmt`;
2. formalize the ranged expression fragment and prove interval analyzer soundness;
3. extend evidence coverage to non-recursive recipe calls and parameter substitution;
4. connect production execution traces to formal `Executes` traces;
5. derive a stronger source-level end-to-end capability theorem;
6. then move to inverse/replay/commutation proofs.

## Paper strategy

Primary claim:

> Persistent mutation is forced through a semantic Change IR, and operation-/magnitude-aware semantic Change Contracts derived from that representation can be proved to constrain runtime semantic changes. For a conservative production subset, the compiler emits proof-free semantic evidence and a separate production signature claim; Lean validates and decodes the evidence, machine-checks signature correspondence, and verifies the semantic policy.

Supporting claims:

- the surface syntax can remain small;
- the same Change IR supports undo/history/provenance/preview;
- quantitative policies can prevent useful classes of state-update bugs;
- the model can support console/GUI artifacts without exposing platform complexity.

Avoid making GUI, undo, `why`, Wasm, certificates, or mobile IDE support the novelty headline. Evidence/certificates are assurance machinery, not the semantic novelty.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level attempt, require:

1. systematic related-work review;
2. a meaningful source/AST-to-evidence correspondence result for a useful subset;
3. mechanized production interval-analysis soundness if magnitude-aware contracts remain central;
4. direct compiled execution;
5. two or three convincing security/engineering case studies, with at least one inside the evidence-certified subset;
6. benchmark and evidence/certificate-overhead measurements;
7. a reproducible artifact;
8. no unsupported firstness claims;
9. controlled user evidence only if novice simplicity remains a headline empirical claim.
