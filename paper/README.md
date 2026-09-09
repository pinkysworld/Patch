# Patch journal manuscript

The current Science of Computer Programming manuscript is built from `paper/journal.tex`, which intentionally contains only `\input{main.tex}`. The complete submission manuscript, including the public real-code mutation audit, now lives in the canonical `paper/main.tex`. It uses Elsevier `elsarticle` formatting and is developed as a **journal submission only; no conference submission is planned**.

## Current scientific framing

The paper is centered on a deliberately narrow architectural claim:

> Patch makes structured semantic Change the mandatory modeled route for post-creation application-state mutation and connects that semantic mutation lineage to operation- and magnitude-aware contracts, provenance, history, and scoped assurance.

`Application state` means Patch state retained across statements/events during execution; it does not imply durable storage across process restarts. `Same substrate` / `same lineage` means a shared mandatory semantic mutation route/vocabulary with distinct compile-time/runtime representations derived from it, not one literal object shared unchanged by every phase.

## Core research questions

The integrated manuscript now uses four explicit research questions:

1. **RQ1, Contract linkage:** can a supported committed numeric Change be connected formally to a contract-level operation/magnitude effect and the actual state delta?
2. **RQ2, Assurance and implementation correspondence:** which contract, range, finite-call, and runtime-correspondence properties are machine checked, and where does the proof-free implementation boundary remain?
3. **RQ3, Mechanism isolation:** which authority distinctions disappear when operation and magnitude are erased while reachable write targets are retained?
4. **RQ4, External mutation stress test:** across a small commit-pinned purposive audit of existing JavaScript/TypeScript systems, which retained-state mutation observations fit the current Patch surface directly, which require adapters or restructuring, and which have the shape of the narrow Lean Change-to-contract bridge?

RQ4 is descriptive rather than representative. It does not estimate ecosystem prevalence, migration effort, developer productivity, or comparative superiority.

## Evidence currently in the manuscript

- State-Change Factorization as a by-construction machine-checked design invariant;
- Mutation Transparency;
- a direct Lean Change-to-contract bridge for supported singleton numeric Changes;
- proof that a bounded allowed Change effect constrains the actual committed before/after magnitude;
- fail-closed bounded unknown magnitude in the relational semantics;
- executable/relational policy equivalence (`allowsBool_iff`, `policyAllowsBool_iff`) for the modeled Effect/Rule fragment;
- normalized signature/capability and integer-range results for explicit fragments;
- finite ranked and transitive exact call-tree reasoning tied to semantic-authority propagation;
- accepted-evidence runtime-frame correspondence for selected direct-WebAssembly executions;
- repeated-identical and mixed-guard invocation-frame evidence;
- an explicitly defined eight-case target-only mechanism-isolation ablation;
- checkout/loyalty and usage/quota multi-state application cases;
- a purposive public real-code mutation audit with 18 retained-state observations from six commit-pinned independently authored projects;
- artifact-level semantic-lineage reuse across compiler analysis and interpreter history/undo/provenance paths;
- commit-bound reproducibility tooling.

The public audit intentionally reports mixed evidence: 5 observations are direct local current-surface fits, 11 require adapters, 2 require source restructuring, and only 3 have the same narrow singleton numeric directional shape as the present Lean bridge. Context coding records 7 standalone observations, 4 coupled multi-target observations, 2 external-persistence cases, 2 sequential-same-target cases, 2 dynamic-target cases, and 1 batched-dynamic-target case. These counts describe the purposive corpus only.

The manuscript does **not** claim end-to-end compiler verification, complete sandboxing, production source-to-effect verification, representative ecosystem validation, a controlled performance result, a usability result, atomic multi-target Change, or superiority over modern effect/capability systems.

## Research frontier from the current backlog

The external audit now gives the next research work a concrete empirical motivation:

- coupled multi-target observations motivate **Relational Atomic ChangeSets**;
- representation and host-state boundaries motivate **Certified Change Adapters**;
- current capability declarations motivate **least-authority inference** from inferred signatures.

Relational ChangeSets and least-authority inference currently exist only as isolated Stage-0 research prototypes on `research/relational-changesets`. They are not wired into the stable parser/interpreter/Change IR and do not have the required Lean atomicity, invariant-preservation, or minimality theorems. They are therefore presented only as follow-on hypotheses, not as contributions of the current paper.

## Review status

Four earlier internal reviewer-perspective rounds are documented in `INTERNAL_REVIEW.md`. Round 5 is documented in `INTERNAL_REVIEW_ROUND5.md` and `INTERNAL_REVIEW_ROUND5_RESPONSE.md`. Round 6 is documented in `INTERNAL_REVIEW_ROUND6.md` and focuses on empirical-transfer validity, source provenance, strict direct-fit coding, and claim discipline. An author-supplied Claude Opus referee-style AI review and its disposition are documented in `EXTERNAL_REVIEW_RESPONSE.md`; none of these internal/AI reviews is described as journal peer review.

The strongest formal issues identified across the reviews have been addressed by the direct Change-to-Effect/Rule bridge, consistent fail-closed magnitude semantics, and formal equivalence between relational and executable policy checks. The former all-internal external-validity gap is now partially addressed by the public mutation-shape audit; broader and independently coded evidence remains future work.

## Submission metadata currently known

- Author: Michél Nguyen
- Affiliation: University of the People
- Funding: none
- Competing interests: none declared
- Intended venue: Science of Computer Programming, Research Papers track
- Submission route: journal only

The exact originality/concurrent-submission declaration and any remaining Editorial Manager fields should be confirmed at actual submission time rather than inferred.

## Supporting submission files

- `journal.tex`, thin journal root for the canonical manuscript;
- `main.tex`, complete integrated manuscript;
- `real-code-study.tex`, retained Round-6 source module for audit history/reference but no longer separately injected by `journal.tex`;
- `related-work.tex`;
- `references.bib` and `related-extra.bib`;
- `highlights.txt`;
- `cover-letter.md`;
- `SCP_SUBMISSION.md`;
- internal review/disposition files including `INTERNAL_REVIEW_ROUND6.md`.

The audit artifact lives under `studies/real-code-mutations/` with `corpus.json`, `results.json`, and its protocol material. `scripts/evaluate-real-code-mutations.js` deterministically validates/regenerates the counts; `scripts/verify-real-code-sources.js` optionally checks source anchors at the exact public commit pins.

## CI

`.github/workflows/paper.yml` checks the frozen real-code corpus/result consistency, compiles `journal.tex`, rejects unresolved citations/references and `Overfull \hbox`, and uploads the generated PDF artifact. The network source-anchor check is intentionally optional so temporary GitHub availability cannot break manuscript compilation. Formal CI separately regenerates and verifies the Lean/certificate assurance stack when formal or implementation paths change.

The formal-policy/bridge state is pinned to commit `2518a1522461319454449eb6ad85d1ffeeaab53b`, whose complete formal workflow passed with the checker-equivalence theorems and generated certificates.

## Remaining high-value strengthening work

1. archive/tag the final source/evidence snapshot under an immutable identifier/DOI before submission if appropriate;
2. expand the public audit into a larger independently coded or preregistered corpus and/or behavior-preserving translation cases;
3. collect fixed-machine controlled assurance-cost measurements;
4. implement or formally compare a representative modern effect/capability approach;
5. develop Relational ChangeSets, Certified Change Adapters, and least-authority inference as separate follow-on research with their own formal obligations.
