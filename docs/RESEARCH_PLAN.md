# Research and Evaluation Plan

Status: living plan for Patch **0.2.0-beta.35** / Change IR **0.10**, with formal runtime-correspondence milestone **beta.32**. This is not a performance result and does not widen the Lean theorem.

Patch should not be submitted to a high venue until the formal claim, executable artifact and evaluation line up. Product and Studio work after beta.32 does not change that rule.

## Central question

Can a low-complexity general-purpose language make semantic change the exclusive route for persistent mutation, infer operation- and magnitude-aware state-transition authority from that representation, and connect those guarantees to an executable implementation without forcing that complexity into ordinary source code?

## RQ1: State-Change Factorization

Formal target:

```text
persistent state transition S -> S'
=> exists delta such that apply(delta, S) = S'
and the transition commits through delta
```

Machine checked for the current formal state-changing machine step. Production work must still connect actual runtime commits to this formal semantics.

## RQ2: Change Signature Soundness

Target:

```text
RuntimeChanges(f) subset-of Signature(f)
```

Machine checked for the structured formal `CoreStmt` with sequence, branch choice and bounded repetition.

Beta 8 now provides a longer checked correspondence chain for the certifiable subset:

```text
formal SourceStmt
 -> Lean semantic normalization
 -> EvidenceStmt
 -> CoreStmt
 -> inferSignature
 -> compare separate production signature claim
```

Measure source-core coverage, semantic-bridge coverage, unsupported reasons, claim agreement, conservative over-approximation and false-confidence rate.

## RQ3: Change Capability Soundness

Target:

```text
RuntimeChanges(f) subset-of Signature(f)
Signature(f) admitted-by Capability(f)
----------------------------------------
RuntimeChanges(f) admitted-by Capability(f)
```

This is machine checked for the formal `CoreStmt` model. Beta 8 additionally proves a source-core version:

```text
SourceExecutes(source, runtime)
checkSourceProtected(source, policy) = true
------------------------------------------------
every runtime semantic effect is admitted by policy
```

The formal `SourceExecutes` relation is defined through successful Lean source lowering, evidence decoding and the existing `Executes` relation. It is not yet a theorem about the JavaScript runtime.

## RQ4: Production frontend correspondence

This is now one of the two central formal gaps.

Current beta-8 pipeline:

```text
Patch source bytes
   -> JavaScript parser / AST                         [trusted today]
   -> formal SourceStmt extraction                    [trusted today]
   -> SourceStmt                                      [formal boundary]
   -> Lean source semantic normalization
   -> separately emitted EvidenceStmt equality check
   -> CoreStmt decoding
   -> formal inferSignature
   -> separate production Change Signature check
   -> verified policy check
   -> formal source-runtime policy containment
```

Next target:

> For the supported production AST fragment, the production extractor emits the corresponding formal `SourceStmt` without omitting, changing or inventing committed source mutations/control-flow structure.

Candidate routes:

1. define a stable serializable AST subset independent of the full parser;
2. define its `SourceStmt` extraction in Lean or a tiny independently checked component;
3. validate producer output against that definition;
4. then connect parser output to the stable AST subset.

The whole JavaScript compiler need not be verified if the assurance boundary is small enough and producer claims are independently checked.

## RQ5: Range-analysis soundness and precision

This is the other central formal gap because quantitative contracts are part of the strongest novelty story.

Patch supports:

```patch
make reward(player, bonus number 0..10):
  change player:
    add bonus to score
```

and interval propagation through a small arithmetic fragment.

Formal target:

> If the production range analyzer returns interval `I` for expression `e` under environment `Gamma`, every supported concrete evaluation of `e` satisfying `Gamma` lies in `I`.

Beta 8 verifies raw interval ordering and uses Lean to normalize the source mutation direction, but it still trusts the producer's claim that the interval is a sound abstraction of the expression.

Evaluate precision, conservative rejection rate and analysis cost. Include seeded unsafe cases and arithmetic edge cases, especially negative ranges, zero-crossing ranges and division.

## RQ6: Production runtime correspondence

After frontend extraction and range analysis are formalized, connect actual production traces to the formal semantics.

Target form:

```text
production execution of supported component emits trace R
---------------------------------------------------------
exists formal trace Rf such that
  SourceExecutes(sourceCore, Rf)
  and production/formal semantic effects correspond
```

This is required before claiming a true source-to-production-runtime end-to-end theorem.

## RQ7: Provenance and `why`

Evaluate whether recorded semantic change provenance helps answer practical debugging questions and reduces manual instrumentation. Keep historical provenance clearly separate from counterfactual causation.

## RQ8: Derived change laws

Later mechanize/test:

- inverse correctness;
- preview non-interference and preview/commit agreement;
- deterministic replay consistency;
- composition laws;
- commutation/conflict soundness.

These support the central contribution but are not the novelty headline.

## RQ9: Killer security/engineering cases

Build at least two or three cases where semantic operation/magnitude authority matters:

- reward/plugin component that may increase score only within a bound;
- wallet/account component with bounded debit authority but no arbitrary replacement;
- game/UI extension restricted to selected semantic changes.

At least one case must fit entirely inside the beta-8 source-certified fragment. Measure prevented violations, required annotations, validation code, audit/logging infrastructure and runtime/checking overhead.

## RQ10: Evidence and checking cost

Measure separately:

- SourceStmt size;
- EvidenceStmt size;
- certificate generation time/size;
- Lean source/evidence equality checking;
- formal signature checking;
- policy checking;
- build/checker latency with cold and cached Lean environments;
- scaling with effects, branches, repeats and policy rules.

The goal is practical assurance, not faster compilation than conventional languages.

## RQ11: Conventional baselines

Compare Patch with conventional implementations using explicit validation, command/event objects, logging or policy wrappers. Measure engineering infrastructure and defect prevention, not only lines of code.

## RQ12: Related-work falsification

Systematically compare against:

- Plaid and typestate/state-transition languages;
- Worlds and reified-state systems;
- classical, graded, quantitative and refinement effect systems;
- Effects as Capabilities and other capability systems;
- behavioral/refinement types;
- abstract interpretation and range analyses;
- translation validation;
- verified/certifying compilers;
- Proof-Carrying Code;
- source/intermediate semantic correspondence systems;
- provenance/Whyline;
- ChEOPS/COPE/Edit Transactions;
- Edit Lenses/change structures/patch theory;
- event sourcing, reversible systems and CRDTs.

The goal is to discover a collision before reviewers do.

## RQ13: Runtime/compiler performance

Separate change-construction/history overhead, static contract analysis, formal-source extraction, semantic bridge extraction, certificate generation/checking, JavaScript execution, future direct Wasm execution and host/runtime packaging overhead.

## RQ14: Novice comprehension

Only if simplicity remains a headline empirical claim, preregister a controlled study comparing basic mutation comprehension/modification with conventional mutable syntax. Keep formal/capability tasks separate from beginner syntax evaluation.

## RQ15: Cross-platform artifact

Before systems-heavy portability claims, evaluate browser/PWA, Windows/macOS/Linux CI, portable `.patchapp`, future direct Wasm and at least one native host.

## Current milestone: 0.2.0-beta.35 product / beta.32 assurance

Implemented relative to the working manuscript:

- Change IR **0.10**;
- State-Change Factorization, Mutation Transparency, signature/capability soundness and integer `RangeExpr` soundness for explicit fragments;
- independent JavaScript source/range, guard and static call-site identity validation (not a verified parser);
- finite ranked calls through beta.30 exact call trees and beta.32 independently reconstructed invocation frames, including mixed-guard repeated identities;
- eight-case semantic-authority ablation plus internally authored checkout/loyalty and usage/quota cases;
- process-isolated `development` / `hosted-ci` / `controlled` measurement protocol and commit-bound reproducibility bundle;
- public `paper.html` reading copy with Lean/trust/measurement tables;
- product artifact including Patch Studio bundle v3 and current/frozen native contracts (IR 1.3 / v13 / v1.4 current; IR 1.2 / v12 / v1.3 frozen), **outside** the Lean theorem.

## Next research gates

These remain open because they need data or external participation, not another product control:

1. collect the fixed-machine controlled overhead/scaling dataset;
2. analyze that dataset, review it, then synchronize measured results into `paper/main.tex` by hand;
3. a genuine external/third-party extension or integration study;
4. expert/venue feedback on whether the architectural conjunction is distinct and useful;
5. further reductions of parser/lowering/runtime trust that materially strengthen the central claim without overstating full compiler verification.

Range soundness and runtime-frame correspondence are now supporting assurance. They are not novelty headlines and they are not an end-to-end compiler theorem.

## Paper strategy

Primary claim:

> Persistent mutation is forced through a semantic Change representation, and operation-/magnitude-aware semantic Change Contracts derived from that representation can constrain modeled runtime changes.

Do not make certificates, GUI, undo, `why`, Wasm, Studio or native packaging the novelty headline. They are evidence/artifact consequences. Do not copy hosted-CI timing into the manuscript.

## High-venue gate

Before an OOPSLA/PLDI/ICFP-level attempt, require:

1. systematic related-work review (structured 2025–2026 follow-up exists; continue surveillance);
2. production AST/source extraction assurance for a useful subset (independent JS validators exist; not a verified parser);
3. mechanized interval-analysis soundness if magnitude-aware contracts remain central (Lean `RangeExpr` fragment exists);
4. production runtime/formal trace correspondence (beta.32 invocation frames on accepted evidence);
5. direct compiled execution (direct Wasm, with named trust boundaries);
6. two or three convincing semantic-security/engineering case studies (artifact corpus exists; not third-party);
7. benchmark and certificate/checker overhead measurements (**not collected** on controlled hardware);
8. reproducibility bundle (exists; excludes paper performance results);
9. no unsupported firstness claims;
10. controlled user evidence only if novice simplicity remains a headline empirical claim (it does not).
